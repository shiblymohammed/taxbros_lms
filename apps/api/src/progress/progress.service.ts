import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, LessonProgressStatus } from '@prisma/client';

/**
 * Progress Service
 * 
 * Handles business logic for:
 * - Retrieving lesson progress for students
 * - Retrieving course progress summaries
 * - Enforcing enrollment and authorization checks
 * - Lesson completion logic (auto and manual)
 * - Course progress percentage calculation
 * 
 * Requirements:
 * - R20: Video playback and position tracking
 * - R21: Lesson progress tracking
 * - R22: Course progress dashboard
 */
@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Complete a lesson and update course progress
   *
   * This is the core completion logic called by both:
   * - Auto-completion (when video reaches 90%)
   * - Manual completion (user clicks "Mark as Complete")
   *
   * Requirements: R21, R22
   * Test Coverage: T4 (Completion calculation)
   *
   * @param studentId - Student completing the lesson
   * @param lessonId - Lesson being completed
   * @returns Updated lesson progress and course progress percentage
   */
  async completeLesson(studentId: string, lessonId: string) {
    // Verify lesson exists and get its details
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: {
              include: {
                enrollments: {
                  where: {
                    studentId,
                    status: 'ACTIVE',
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
    }

    const course = lesson.module.course;

    // Verify student is enrolled in the course
    if (!course.enrollments || course.enrollments.length === 0) {
      throw new ForbiddenException(
        'You must be enrolled in this course to complete lessons',
      );
    }

    const enrollment = course.enrollments[0];

    // Update lesson progress to COMPLETED
    const lessonProgress = await this.prisma.lessonProgress.upsert({
      where: {
        studentId_lessonId: {
          studentId,
          lessonId,
        },
      },
      update: {
        status: LessonProgressStatus.COMPLETED,
        completedAt: new Date(),
      },
      create: {
        studentId,
        lessonId,
        status: LessonProgressStatus.COMPLETED,
        completedAt: new Date(),
        lastPosition: 0,
        watchedDuration: 0,
      },
    });

    // Recalculate course progress percentage
    const progressPercentage = await this.calculateCourseProgress(
      studentId,
      course.id,
    );

    // Update course enrollment with new progress percentage
    await this.prisma.courseEnrollment.update({
      where: { id: enrollment.id },
      data: {
        progressPercentage,
        lastAccessedAt: new Date(),
      },
    });

    return {
      lessonProgress,
      courseProgress: {
        courseId: course.id,
        progressPercentage,
      },
    };
  }

  /**
   * Calculate course progress percentage
   *
   * Formula: 100 × (completed lessons) / (total published lessons in course)
   *
   * Only counts lessons with status PUBLISHED.
   * Handles edge cases like courses with no published lessons.
   *
   * Requirements: R21, R22
   * Test Coverage: T4 (Progress calculation)
   *
   * @param studentId - Student whose progress to calculate
   * @param courseId - Course to calculate progress for
   * @returns Progress percentage (0-100)
   */
  async calculateCourseProgress(
    studentId: string,
    courseId: string,
  ): Promise<number> {
    // Get all published lessons in the course
    const publishedLessons = await this.prisma.lesson.findMany({
      where: {
        module: {
          courseId,
        },
        status: 'PUBLISHED',
      },
      select: {
        id: true,
      },
    });

    const totalPublishedLessons = publishedLessons.length;

    // If no published lessons, progress is 0%
    if (totalPublishedLessons === 0) {
      return 0;
    }

    // Count completed lessons
    const completedLessons = await this.prisma.lessonProgress.count({
      where: {
        studentId,
        lessonId: {
          in: publishedLessons.map((l) => l.id),
        },
        status: LessonProgressStatus.COMPLETED,
      },
    });

    // Calculate percentage
    const percentage = Math.round(
      (completedLessons / totalPublishedLessons) * 100,
    );

    return percentage;
  }

  /**
   * Check if lesson should be auto-completed based on watch progress
   *
   * Requirements: R21
   * Test Coverage: T4 (Auto-completion)
   *
   * @param position - Current playback position in seconds
   * @param duration - Total video duration in seconds
   * @returns true if position >= 90% of duration
   */
  shouldAutoComplete(position: number, duration: number | null): boolean {
    if (!duration || duration <= 0) {
      return false;
    }

    const watchedPercentage = (position / duration) * 100;
    return watchedPercentage >= 90;
  }

  /**
   * Update video playback position
   *
   * Called every 10 seconds during video playback.
   * Checks for auto-completion at 90% threshold.
   *
   * Requirements: R20, R21
   * Test Coverage: T4 (Position tracking)
   *
   * @param lessonId - Lesson being watched
   * @param studentId - Student watching the video
   * @param updateDto - Position and watchedDuration data
   * @returns Updated progress with auto-completion if applicable
   */
  async updatePosition(
    lessonId: string,
    studentId: string,
    updateDto: { position: number; watchedDuration?: number },
  ) {
    const { position, watchedDuration } = updateDto;
    // Verify lesson exists and get duration
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: {
              include: {
                enrollments: {
                  where: {
                    studentId,
                    status: 'ACTIVE',
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
    }

    // Verify student is enrolled
    if (!lesson.module.course.enrollments?.length) {
      throw new ForbiddenException(
        'You must be enrolled in this course to track progress',
      );
    }

    // Get current progress to check if already completed
    const currentProgress = await this.prisma.lessonProgress.findUnique({
      where: {
        studentId_lessonId: {
          studentId,
          lessonId,
        },
      },
    });

    // If already completed, don't update position but return current state
    if (currentProgress?.status === LessonProgressStatus.COMPLETED) {
      return {
        lessonProgress: currentProgress,
        autoCompleted: false,
      };
    }

    // Calculate the incremental watched duration
    // If watchedDuration is provided, use it; otherwise calculate from position difference
    let watchedIncrement = 0;
    if (watchedDuration !== undefined) {
      watchedIncrement = watchedDuration;
    } else if (currentProgress) {
      // Calculate increment as the difference between new and old position (capped at 10 seconds for typical update interval)
      const positionDiff = Math.max(0, position - currentProgress.lastPosition);
      watchedIncrement = Math.min(positionDiff, 10);
    } else {
      // First update - assume watched from 0 to current position
      watchedIncrement = position;
    }

    // Calculate new total watched duration
    const newWatchedDuration = (currentProgress?.watchedDuration || 0) + watchedIncrement;

    // Check if should auto-complete
    const shouldComplete =
      lesson.duration && this.shouldAutoComplete(position, lesson.duration);

    if (shouldComplete) {
      // Auto-complete the lesson
      const result = await this.completeLesson(studentId, lessonId);
      return {
        ...result,
        autoCompleted: true,
      };
    }

    // Update position, watchedDuration, and status to IN_PROGRESS
    const lessonProgress = await this.prisma.lessonProgress.upsert({
      where: {
        studentId_lessonId: {
          studentId,
          lessonId,
        },
      },
      update: {
        lastPosition: position,
        watchedDuration: newWatchedDuration,
        status: LessonProgressStatus.IN_PROGRESS,
      },
      create: {
        studentId,
        lessonId,
        status: LessonProgressStatus.IN_PROGRESS,
        lastPosition: position,
        watchedDuration: newWatchedDuration,
      },
    });

    // Update last accessed time on enrollment
    await this.prisma.courseEnrollment.updateMany({
      where: {
        studentId,
        courseId: lesson.module.courseId,
      },
      data: {
        lastAccessedAt: new Date(),
      },
    });

    return {
      lessonProgress,
      autoCompleted: false,
    };
  }

  /**
   * Get lesson progress for a specific student and lesson
   * 
   * Requirements:
   * - R20.4: Retrieve last position value
   * - R21.1: Return progress status
   * - R21.9: Display progress status for student
   * 
   * Authorization:
   * - Students can only view their own progress
   * - Administrators and staff can view any student's progress
   * 
   * @param lessonId - The lesson ID
   * @param studentId - The student ID
   * @param requestingUserId - The user making the request
   * @param requestingUserRole - The role of the requesting user
   * @returns LessonProgress with lesson and course details
   */
  async getLessonProgress(
    lessonId: string,
    studentId: string,
    requestingUserId: string,
    requestingUserRole: UserRole,
  ) {
    // Verify the lesson exists
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
    }

    // Verify the student exists
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    // Authorization: students can only view their own progress
    if (
      requestingUserRole === UserRole.STUDENT &&
      student.user.id !== requestingUserId
    ) {
      throw new ForbiddenException(
        'You can only view your own lesson progress',
      );
    }

    // Verify student is enrolled in the parent course
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: studentId,
          courseId: lesson.module.course.id,
        },
      },
    });

    if (!enrollment) {
      throw new ForbiddenException(
        `Student is not enrolled in course "${lesson.module.course.title}"`,
      );
    }

    // Get or create progress record
    const progress = await this.prisma.lessonProgress.findUnique({
      where: {
        studentId_lessonId: {
          studentId: studentId,
          lessonId: lessonId,
        },
      },
    });

    // Return default NOT_STARTED if no record exists
    if (!progress) {
      return {
        id: null,
        studentId: studentId,
        lessonId: lessonId,
        status: LessonProgressStatus.NOT_STARTED,
        lastPosition: 0,
        watchedDuration: 0,
        completedAt: null,
        createdAt: null,
        updatedAt: null,
        lesson: {
          id: lesson.id,
          title: lesson.title,
          duration: lesson.duration,
          course: {
            id: lesson.module.course.id,
            title: lesson.module.course.title,
          },
        },
      };
    }

    return {
      ...progress,
      lesson: {
        id: lesson.id,
        title: lesson.title,
        duration: lesson.duration,
        course: {
          id: lesson.module.course.id,
          title: lesson.module.course.title,
        },
      },
    };
  }

  /**
   * Get all lesson progress for a student in a specific course
   * 
   * Requirements:
   * - R22.3: Display all published lessons with progress status
   * - R22.4: Display lesson progress status for each lesson
   * 
   * Authorization:
   * - Students can only view their own progress
   * - Administrators and staff can view any student's progress
   * 
   * @param courseId - The course ID
   * @param studentId - The student ID
   * @param requestingUserId - The user making the request
   * @param requestingUserRole - The role of the requesting user
   * @returns Array of lesson progress with lesson details
   */
  async getCourseProgress(
    courseId: string,
    studentId: string,
    requestingUserId: string,
    requestingUserRole: UserRole,
  ) {
    // Verify the course exists
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          orderBy: { displayOrder: 'asc' },
          include: {
            lessons: {
              where: { status: 'PUBLISHED' },
              orderBy: { displayOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    // Verify the student exists
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    // Authorization: students can only view their own progress
    if (
      requestingUserRole === UserRole.STUDENT &&
      student.user.id !== requestingUserId
    ) {
      throw new ForbiddenException(
        'You can only view your own course progress',
      );
    }

    // Verify student is enrolled in the course
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: studentId,
          courseId: courseId,
        },
      },
    });

    if (!enrollment) {
      throw new ForbiddenException(
        `Student is not enrolled in course "${course.title}"`,
      );
    }

    // Get all lesson IDs from the course
    const lessonIds = course.modules.flatMap((module) =>
      module.lessons.map((lesson) => lesson.id),
    );

    // Get all progress records for this student and these lessons
    const progressRecords = await this.prisma.lessonProgress.findMany({
      where: {
        studentId: studentId,
        lessonId: { in: lessonIds },
      },
    });

    // Create a map for quick lookup
    const progressMap = new Map(
      progressRecords.map((p) => [p.lessonId, p]),
    );

    // Build response with all lessons and their progress
    const result = course.modules.flatMap((module) =>
      module.lessons.map((lesson) => {
        const progress = progressMap.get(lesson.id);
        return {
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          moduleTitle: module.title,
          displayOrder: lesson.displayOrder,
          duration: lesson.duration,
          status: progress
            ? progress.status
            : LessonProgressStatus.NOT_STARTED,
          lastPosition: progress ? progress.lastPosition : 0,
          watchedDuration: progress ? progress.watchedDuration : 0,
          completedAt: progress ? progress.completedAt : null,
        };
      }),
    );

    return {
      courseId: course.id,
      courseTitle: course.title,
      enrollmentStatus: enrollment.status,
      progressPercentage: enrollment.progressPercentage,
      lessons: result,
    };
  }

  /**
   * Get all lesson progress for a student across all enrolled courses
   * 
   * Requirements:
   * - R22.1: Display all course enrollments with status ACTIVE
   * - R22.2: Display course title, cover image, and progress percentage
   * 
   * Authorization:
   * - Students can only view their own progress
   * - Administrators and staff can view any student's progress
   * 
   * @param studentId - The student ID
   * @param requestingUserId - The user making the request
   * @param requestingUserRole - The role of the requesting user
   * @returns Array of course enrollments with lesson progress details
   */
  async getStudentProgress(
    studentId: string,
    requestingUserId: string,
    requestingUserRole: UserRole,
  ) {
    // Verify the student exists
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    // Authorization: students can only view their own progress
    if (
      requestingUserRole === UserRole.STUDENT &&
      student.user.id !== requestingUserId
    ) {
      throw new ForbiddenException(
        'You can only view your own progress',
      );
    }

    // Get all course enrollments for this student
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: {
        studentId: studentId,
      },
      include: {
        course: {
          include: {
            modules: {
              orderBy: { displayOrder: 'asc' },
              include: {
                lessons: {
                  where: { status: 'PUBLISHED' },
                  orderBy: { displayOrder: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: {
        enrolledAt: 'desc',
      },
    });

    // Get all lesson progress for this student
    const allProgress = await this.prisma.lessonProgress.findMany({
      where: {
        studentId: studentId,
      },
    });

    const progressMap = new Map(
      allProgress.map((p) => [p.lessonId, p]),
    );

    // Build response with course enrollments and lesson progress
    const result = enrollments.map((enrollment) => {
      const lessons = enrollment.course.modules.flatMap((module) =>
        module.lessons.map((lesson) => {
          const progress = progressMap.get(lesson.id);
          return {
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            moduleTitle: module.title,
            status: progress
              ? progress.status
              : LessonProgressStatus.NOT_STARTED,
            completedAt: progress ? progress.completedAt : null,
          };
        }),
      );

      const totalLessons = lessons.length;
      const completedLessons = lessons.filter(
        (l) => l.status === LessonProgressStatus.COMPLETED,
      ).length;

      return {
        enrollmentId: enrollment.id,
        courseId: enrollment.course.id,
        courseTitle: enrollment.course.title,
        courseCoverImage: enrollment.course.coverImage,
        enrollmentStatus: enrollment.status,
        progressPercentage: enrollment.progressPercentage,
        totalLessons,
        completedLessons,
        lastAccessedAt: enrollment.lastAccessedAt,
        enrolledAt: enrollment.enrolledAt,
        lessons,
      };
    });

    return {
      studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      courses: result,
    };
  }
}
