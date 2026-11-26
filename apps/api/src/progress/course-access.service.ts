import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CourseEnrollmentStatus, CourseStatus, LessonProgressStatus, LessonStatus, QuizAttachmentType, QuizStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeCourseAccess, type AccessQuiz, type CourseAccess } from './course-access';

/** Quizzes that come after videos (attached to a lesson or module) follow the learning-order rules. */
export const isAfterVideoQuiz = (quiz: { attachmentType: QuizAttachmentType | string }) => quiz.attachmentType !== QuizAttachmentType.COURSE;

export interface CourseQuizState {
  quizId: string;
  title: string;
  attachmentType: QuizAttachmentType;
  lessonId: string | null;
  moduleId: string | null;
  passMark: number;
  totalMarks: number;
  attemptCount: number;
  bestScore: number | null;
  passed: boolean;
}

export interface CourseAccessResult {
  access: CourseAccess;
  quizzes: CourseQuizState[];
}

/** Applies the learning order (see course-access.ts) to a student's real progress. */
@Injectable()
export class CourseAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** What is open for this student in this course, plus the state of every published quiz in it. */
  async forCourse(studentId: string, courseId: string): Promise<CourseAccessResult> {
    const modules = await this.prisma.courseModule.findMany({
      where: { courseId },
      orderBy: { displayOrder: 'asc' },
      include: { lessons: { where: { status: LessonStatus.PUBLISHED }, orderBy: { displayOrder: 'asc' }, select: { id: true, title: true } } },
    });
    const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));

    const [progress, quizzes] = await Promise.all([
      this.prisma.lessonProgress.findMany({
        where: { studentId, lessonId: { in: lessonIds }, status: LessonProgressStatus.COMPLETED },
        select: { lessonId: true },
      }),
      this.prisma.quiz.findMany({
        where: {
          status: QuizStatus.PUBLISHED,
          OR: [
            { attachmentType: QuizAttachmentType.COURSE, courseId },
            { attachmentType: QuizAttachmentType.MODULE, moduleId: { in: modules.map((m) => m.id) } },
            { attachmentType: QuizAttachmentType.LESSON, lessonId: { in: lessonIds } },
          ],
        },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, title: true, attachmentType: true, lessonId: true, moduleId: true, passMark: true, totalMarks: true },
      }),
    ]);

    const attempts = quizzes.length
      ? await this.prisma.quizAttempt.findMany({
          where: { studentId, quizId: { in: quizzes.map((q) => q.id) } },
          select: { quizId: true, score: true, passed: true },
        })
      : [];

    const completed = new Set(progress.map((p) => p.lessonId));
    const states: CourseQuizState[] = quizzes.map((q) => {
      const mine = attempts.filter((a) => a.quizId === q.id);
      return {
        quizId: q.id,
        title: q.title,
        attachmentType: q.attachmentType,
        lessonId: q.lessonId,
        moduleId: q.moduleId,
        passMark: q.passMark,
        totalMarks: q.totalMarks,
        attemptCount: mine.length,
        bestScore: mine.length ? Math.max(...mine.map((a) => a.score)) : null,
        passed: mine.some((a) => a.passed),
      };
    });

    const access = computeCourseAccess(
      modules.map((m) => ({ id: m.id, title: m.title, lessons: m.lessons.map((l) => ({ ...l, completed: completed.has(l.id) })) })),
      states.map<AccessQuiz>((s) => ({
        id: s.quizId,
        title: s.title,
        attachmentType: s.attachmentType,
        lessonId: s.lessonId,
        moduleId: s.moduleId,
        passed: s.passed,
      })),
    );
    return { access, quizzes: states };
  }

  /**
   * A student may open a lesson only if it is published in a published course they are enrolled in,
   * and everything before it in the learning order is done.
   */
  async assertLessonOpen(studentId: string, lessonId: string): Promise<void> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { status: true, module: { select: { courseId: true, course: { select: { status: true } } } } },
    });
    if (!lesson) throw new NotFoundException(`Lesson with ID ${lessonId} not found`);

    const courseId = lesson.module.courseId;
    if (lesson.status !== LessonStatus.PUBLISHED || lesson.module.course.status !== CourseStatus.PUBLISHED) {
      throw new ForbiddenException('This lesson is not available');
    }
    await this.assertEnrolled(studentId, courseId);

    const state = (await this.forCourse(studentId, courseId)).access.lessons.get(lessonId);
    if (!state?.open) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'LESSON_LOCKED',
        message: state?.blockedBy
          ? state.blockedBy.kind === 'QUIZ'
            ? `Pass “${state.blockedBy.title}” to unlock this lesson`
            : `Finish “${state.blockedBy.title}” to unlock this lesson`
          : 'This lesson is locked',
        blockedBy: state?.blockedBy ?? null,
        courseId,
      });
    }
  }

  /** Quizzes after videos open only when the student reaches them in the learning order. */
  async assertQuizOpen(
    studentId: string,
    quiz: { id: string; attachmentType: QuizAttachmentType; lessonId: string | null; moduleId: string | null },
  ): Promise<void> {
    if (!isAfterVideoQuiz(quiz)) return;
    const courseId = await this.courseOfQuiz(quiz);
    if (!courseId) throw new ForbiddenException('Quiz is not available');

    const state = (await this.forCourse(studentId, courseId)).access.quizzes.get(quiz.id);
    if (!state?.open) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'QUIZ_LOCKED',
        message: state?.blockedBy
          ? state.blockedBy.kind === 'QUIZ'
            ? `Pass “${state.blockedBy.title}” first`
            : `Watch “${state.blockedBy.title}” first`
          : 'This quiz is not open yet',
        blockedBy: state?.blockedBy ?? null,
        courseId,
      });
    }
  }

  /** Whether the student has ever passed this quiz (answers are shown only after a pass). */
  async hasPassed(studentId: string, quizId: string): Promise<boolean> {
    return (await this.prisma.quizAttempt.count({ where: { studentId, quizId, passed: true } })) > 0;
  }

  /** The lesson to rewatch for a quiz: its lesson, or the first published lesson of its module. */
  async studyTarget(quiz: { attachmentType: QuizAttachmentType; lessonId: string | null; moduleId: string | null; courseId: string | null }) {
    const courseId = await this.courseOfQuiz(quiz);
    if (quiz.attachmentType === QuizAttachmentType.LESSON) return { courseId, lessonId: quiz.lessonId };
    if (quiz.attachmentType === QuizAttachmentType.MODULE && quiz.moduleId) {
      const first = await this.prisma.lesson.findFirst({
        where: { moduleId: quiz.moduleId, status: LessonStatus.PUBLISHED },
        orderBy: { displayOrder: 'asc' },
        select: { id: true },
      });
      return { courseId, lessonId: first?.id ?? null };
    }
    return { courseId, lessonId: null };
  }

  async courseOfQuiz(quiz: { attachmentType: QuizAttachmentType | string; lessonId: string | null; moduleId: string | null; courseId?: string | null }) {
    if (quiz.attachmentType === QuizAttachmentType.LESSON && quiz.lessonId) {
      const l = await this.prisma.lesson.findUnique({ where: { id: quiz.lessonId }, select: { module: { select: { courseId: true } } } });
      return l?.module.courseId ?? null;
    }
    if (quiz.attachmentType === QuizAttachmentType.MODULE && quiz.moduleId) {
      const m = await this.prisma.courseModule.findUnique({ where: { id: quiz.moduleId }, select: { courseId: true } });
      return m?.courseId ?? null;
    }
    return quiz.courseId ?? null;
  }

  private async assertEnrolled(studentId: string, courseId: string) {
    const enrollment = await this.prisma.courseEnrollment.findFirst({
      where: { studentId, courseId, status: { in: [CourseEnrollmentStatus.ACTIVE, CourseEnrollmentStatus.COMPLETED] } },
      select: { id: true },
    });
    if (!enrollment) throw new ForbiddenException('You must be enrolled in this course to open its lessons');
  }
}
