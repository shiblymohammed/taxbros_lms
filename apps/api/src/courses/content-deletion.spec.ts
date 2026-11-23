import { ConflictException, NotFoundException } from '@nestjs/common';
import { CourseStatus } from '@prisma/client';
import { CoursesService } from './courses.service';
import { ModulesService } from './modules.service';
import { LessonsService } from './lessons.service';
import { recalculateCourseProgress } from './course-progress';

/**
 * Deleting courses, modules and lessons (R13–R18): content created by mistake can be removed;
 * quizzes attached to it go too; nothing that students have used is silently destroyed.
 */
function mockPrisma() {
  const prisma: any = {
    course: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    courseModule: { findUnique: jest.fn(), delete: jest.fn() },
    lesson: { findUnique: jest.fn(), delete: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    quiz: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    courseEnrollment: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    lessonProgress: { groupBy: jest.fn().mockResolvedValue([]) },
  };
  prisma.$transaction = jest.fn((fn: (tx: any) => unknown) => fn(prisma));
  return prisma;
}

describe('CoursesService.remove', () => {
  it('deletes a course nobody was ever enrolled in, with its modules, lessons and quizzes', async () => {
    const prisma = mockPrisma();
    prisma.course.findUnique.mockResolvedValue({
      id: 'c1',
      title: 'Oops course',
      _count: { enrollments: 0 },
      modules: [{ id: 'm1', lessons: [{ id: 'l1' }, { id: 'l2' }] }],
    });
    prisma.quiz.deleteMany.mockResolvedValue({ count: 2 });

    const result = await new CoursesService(prisma).remove('c1');

    expect(result).toMatchObject({ action: 'deleted', deletedModules: 1, deletedLessons: 2, deletedQuizzes: 2 });
    expect(prisma.quiz.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ courseId: { in: ['c1'] } }, { moduleId: { in: ['m1'] } }, { lessonId: { in: ['l1', 'l2'] } }] },
    });
    expect(prisma.course.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(prisma.course.update).not.toHaveBeenCalled();
  });

  it('archives instead when students have been enrolled, keeping their history', async () => {
    const prisma = mockPrisma();
    prisma.course.findUnique.mockResolvedValue({ id: 'c1', title: 'Used', _count: { enrollments: 3 }, modules: [] });
    prisma.course.update.mockResolvedValue({ id: 'c1', title: 'Used', status: CourseStatus.ARCHIVED });

    const result = await new CoursesService(prisma).remove('c1');

    expect(result.action).toBe('archived');
    expect(result.message).toMatch(/archived instead of deleted/);
    expect(prisma.course.delete).not.toHaveBeenCalled();
    expect(prisma.quiz.deleteMany).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown course', async () => {
    const prisma = mockPrisma();
    prisma.course.findUnique.mockResolvedValue(null);
    await expect(new CoursesService(prisma).remove('x')).rejects.toThrow(NotFoundException);
  });
});

describe('ModulesService.remove and LessonsService.remove', () => {
  it('deletes a module with its lesson quizzes and refreshes course progress', async () => {
    const prisma = mockPrisma();
    prisma.courseModule.findUnique.mockResolvedValue({ id: 'm1', title: 'GST', courseId: 'c1', lessons: [{ id: 'l1' }] });
    prisma.courseModule.delete.mockResolvedValue({ id: 'm1' });
    prisma.quiz.deleteMany.mockResolvedValue({ count: 1 });

    const result = await new ModulesService(prisma).remove('m1');

    expect(result).toMatchObject({ deletedLessonsCount: 1, deletedQuizzes: 1 });
    expect(prisma.courseModule.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    expect(prisma.courseEnrollment.findMany).toHaveBeenCalled(); // progress recalculated for course c1
  });

  it('refuses to delete a module whose quiz students have taken', async () => {
    const prisma = mockPrisma();
    prisma.courseModule.findUnique.mockResolvedValue({ id: 'm1', title: 'GST', courseId: 'c1', lessons: [] });
    prisma.quiz.findMany.mockResolvedValue([{ title: 'GST Basics Check' }]);

    await expect(new ModulesService(prisma).remove('m1')).rejects.toThrow(ConflictException);
    await expect(new ModulesService(prisma).remove('m1')).rejects.toThrow(/GST Basics Check/);
    expect(prisma.courseModule.delete).not.toHaveBeenCalled();
  });

  it('deletes a lesson with its quizzes and refreshes course progress', async () => {
    const prisma = mockPrisma();
    prisma.lesson.findUnique.mockResolvedValue({
      id: 'l1',
      title: 'Intro',
      module: { courseId: 'c1' },
      lessonProgress: [],
    });
    prisma.lesson.delete.mockResolvedValue({ id: 'l1' });

    const result = await new LessonsService(prisma).remove('l1');

    expect(result).toMatchObject({ deletedQuizzes: 0 });
    expect(prisma.quiz.deleteMany).toHaveBeenCalledWith({ where: { OR: [{ lessonId: { in: ['l1'] } }] } });
    expect(prisma.lesson.delete).toHaveBeenCalledWith({ where: { id: 'l1' } });
  });
});

describe('recalculateCourseProgress (R21, R22)', () => {
  it('updates active enrolments from completed published lessons', async () => {
    const prisma = mockPrisma();
    prisma.lesson.findMany.mockResolvedValue([{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }, { id: 'l4' }]);
    prisma.courseEnrollment.findMany.mockResolvedValue([
      { id: 'e1', studentId: 's1', progressPercentage: 17 },
      { id: 'e2', studentId: 's2', progressPercentage: 50 },
    ]);
    prisma.lessonProgress.groupBy.mockResolvedValue([
      { studentId: 's1', _count: { _all: 1 } },
      { studentId: 's2', _count: { _all: 2 } },
    ]);

    const changed = await recalculateCourseProgress(prisma, 'c1');

    expect(changed).toBe(1);
    expect(prisma.courseEnrollment.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { progressPercentage: 25 } });
    expect(prisma.courseEnrollment.findMany.mock.calls[0][0].where.status).toBe('ACTIVE');
  });
});
