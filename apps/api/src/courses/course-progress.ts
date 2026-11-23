import { CourseEnrollmentStatus, LessonProgressStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Recalculate the stored progress % of a course's ACTIVE enrolments (R21, R22).
 *
 * The percentage is completed published lessons / published lessons, and is otherwise only
 * updated when a student completes a lesson. Call this when the set of published lessons
 * changes (publish, unpublish, delete). COMPLETED enrolments keep their final % (R5.6).
 */
export async function recalculateCourseProgress(prisma: PrismaService, courseId: string): Promise<number> {
  const [lessons, enrolments] = await Promise.all([
    prisma.lesson.findMany({ where: { module: { courseId }, status: 'PUBLISHED' }, select: { id: true } }),
    prisma.courseEnrollment.findMany({
      where: { courseId, status: CourseEnrollmentStatus.ACTIVE },
      select: { id: true, studentId: true, progressPercentage: true },
    }),
  ]);
  if (enrolments.length === 0) return 0;

  const lessonIds = lessons.map((l) => l.id);
  const completed = lessonIds.length
    ? await prisma.lessonProgress.groupBy({
        by: ['studentId'],
        where: { lessonId: { in: lessonIds }, status: LessonProgressStatus.COMPLETED },
        _count: { _all: true },
      })
    : [];
  const done = new Map(completed.map((c) => [c.studentId, c._count._all]));

  let changed = 0;
  for (const e of enrolments) {
    const pct = lessonIds.length ? Math.round(((done.get(e.studentId) ?? 0) / lessonIds.length) * 100) : 0;
    if (pct !== e.progressPercentage) {
      await prisma.courseEnrollment.update({ where: { id: e.id }, data: { progressPercentage: pct } });
      changed++;
    }
  }
  return changed;
}
