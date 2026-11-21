import { Test, TestingModule } from '@nestjs/testing';
import { ProgressService } from './progress.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { LessonProgressStatus } from '@prisma/client';

describe('ProgressService', () => {
  let service: ProgressService;

  const mockPrismaService = {
    lesson: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    lessonProgress: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    courseEnrollment: {
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    student: {
      findUnique: jest.fn(),
    },
    course: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ProgressService>(ProgressService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updatePosition', () => {
    const studentId = 'student-123';
    const lessonId = 'lesson-456';
    const courseId = 'course-789';

    const mockLesson = {
      id: lessonId,
      title: 'Test Lesson',
      duration: 1000, // 1000 seconds
      module: {
        courseId: courseId,
        course: {
          id: courseId,
          title: 'Test Course',
          enrollments: [
            {
              id: 'enrollment-123',
              studentId: studentId,
              status: 'ACTIVE',
            },
          ],
        },
      },
    };

    it('should create new progress record with watchedDuration when updating position for first time', async () => {
      // Arrange
      mockPrismaService.lesson.findUnique.mockResolvedValue(mockLesson);
      mockPrismaService.lessonProgress.findUnique.mockResolvedValue(null);
      mockPrismaService.lessonProgress.upsert.mockResolvedValue({
        id: 'progress-123',
        studentId,
        lessonId,
        status: LessonProgressStatus.IN_PROGRESS,
        lastPosition: 100,
        watchedDuration: 100,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrismaService.courseEnrollment.updateMany.mockResolvedValue({
        count: 1,
      });

      // Act
      const result = await service.updatePosition(lessonId, studentId, {
        position: 100,
      });

      // Assert
      expect(result.lessonProgress.watchedDuration).toBe(100);
      expect(result.lessonProgress.lastPosition).toBe(100);
      expect(result.lessonProgress.status).toBe(LessonProgressStatus.IN_PROGRESS);
      expect(result.autoCompleted).toBe(false);
    });

    it('should increment watchedDuration when position is updated', async () => {
      // Arrange
      const existingProgress = {
        id: 'progress-123',
        studentId,
        lessonId,
        status: LessonProgressStatus.IN_PROGRESS,
        lastPosition: 100,
        watchedDuration: 100,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.lesson.findUnique.mockResolvedValue(mockLesson);
      mockPrismaService.lessonProgress.findUnique.mockResolvedValue(
        existingProgress,
      );
      mockPrismaService.lessonProgress.upsert.mockResolvedValue({
        ...existingProgress,
        lastPosition: 110,
        watchedDuration: 110, // 100 + 10 seconds increment
      });
      mockPrismaService.courseEnrollment.updateMany.mockResolvedValue({
        count: 1,
      });

      // Act
      const result = await service.updatePosition(lessonId, studentId, {
        position: 110,
      });

      // Assert
      expect(result.lessonProgress.watchedDuration).toBe(110);
      expect(result.lessonProgress.lastPosition).toBe(110);
    });

    it('should use provided watchedDuration when explicitly passed', async () => {
      // Arrange
      const existingProgress = {
        id: 'progress-123',
        studentId,
        lessonId,
        status: LessonProgressStatus.IN_PROGRESS,
        lastPosition: 100,
        watchedDuration: 100,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.lesson.findUnique.mockResolvedValue(mockLesson);
      mockPrismaService.lessonProgress.findUnique.mockResolvedValue(
        existingProgress,
      );
      mockPrismaService.lessonProgress.upsert.mockResolvedValue({
        ...existingProgress,
        lastPosition: 120,
        watchedDuration: 115, // 100 + 15 (explicit)
      });
      mockPrismaService.courseEnrollment.updateMany.mockResolvedValue({
        count: 1,
      });

      // Act
      const result = await service.updatePosition(lessonId, studentId, {
        position: 120,
        watchedDuration: 15, // Explicitly pass 15 seconds
      });

      // Assert
      expect(result.lessonProgress.watchedDuration).toBe(115);
    });

    it('should auto-complete lesson at 90% threshold', async () => {
      // Arrange
      mockPrismaService.lesson.findUnique.mockResolvedValue(mockLesson);
      mockPrismaService.lessonProgress.findUnique.mockResolvedValue({
        id: 'progress-123',
        studentId,
        lessonId,
        status: LessonProgressStatus.IN_PROGRESS,
        lastPosition: 850,
        watchedDuration: 850,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrismaService.lessonProgress.upsert.mockResolvedValue({
        id: 'progress-123',
        studentId,
        lessonId,
        status: LessonProgressStatus.COMPLETED,
        lastPosition: 900,
        watchedDuration: 900,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrismaService.lesson.findMany.mockResolvedValue([mockLesson]);
      mockPrismaService.lessonProgress.count.mockResolvedValue(1);
      mockPrismaService.courseEnrollment.update.mockResolvedValue({
        id: 'enrollment-123',
        progressPercentage: 100,
      });

      // Act - position 900 is 90% of 1000 seconds
      const result = await service.updatePosition(lessonId, studentId, {
        position: 900,
      });

      // Assert
      expect(result.autoCompleted).toBe(true);
      expect(result.lessonProgress.status).toBe(LessonProgressStatus.COMPLETED);
    });

    it('should not update position if lesson is already completed', async () => {
      // Arrange
      const completedProgress = {
        id: 'progress-123',
        studentId,
        lessonId,
        status: LessonProgressStatus.COMPLETED,
        lastPosition: 1000,
        watchedDuration: 1000,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.lesson.findUnique.mockResolvedValue(mockLesson);
      mockPrismaService.lessonProgress.findUnique.mockResolvedValue(
        completedProgress,
      );

      // Act
      const result = await service.updatePosition(lessonId, studentId, {
        position: 500,
      });

      // Assert
      expect(result.lessonProgress.status).toBe(LessonProgressStatus.COMPLETED);
      expect(result.autoCompleted).toBe(false);
      expect(mockPrismaService.lessonProgress.upsert).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if lesson does not exist', async () => {
      // Arrange
      mockPrismaService.lesson.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updatePosition(lessonId, studentId, { position: 100 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if student is not enrolled', async () => {
      // Arrange
      const lessonWithoutEnrollment = {
        ...mockLesson,
        module: {
          ...mockLesson.module,
          course: {
            ...mockLesson.module.course,
            enrollments: [],
          },
        },
      };
      mockPrismaService.lesson.findUnique.mockResolvedValue(
        lessonWithoutEnrollment,
      );

      // Act & Assert
      await expect(
        service.updatePosition(lessonId, studentId, { position: 100 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('shouldAutoComplete', () => {
    it('should return true when position is >= 90% of duration', () => {
      expect(service.shouldAutoComplete(900, 1000)).toBe(true);
      expect(service.shouldAutoComplete(950, 1000)).toBe(true);
      expect(service.shouldAutoComplete(1000, 1000)).toBe(true);
    });

    it('should return false when position is < 90% of duration', () => {
      expect(service.shouldAutoComplete(899, 1000)).toBe(false);
      expect(service.shouldAutoComplete(500, 1000)).toBe(false);
      expect(service.shouldAutoComplete(0, 1000)).toBe(false);
    });

    it('should return false when duration is null or zero', () => {
      expect(service.shouldAutoComplete(900, null)).toBe(false);
      expect(service.shouldAutoComplete(900, 0)).toBe(false);
    });
  });

  describe('completeLesson', () => {
    const studentId = 'student-123';
    const lessonId = 'lesson-456';
    const courseId = 'course-789';
    const enrollmentId = 'enrollment-123';

    const mockLesson = {
      id: lessonId,
      title: 'Test Lesson',
      module: {
        courseId: courseId,
        course: {
          id: courseId,
          title: 'Test Course',
          enrollments: [
            {
              id: enrollmentId,
              studentId: studentId,
              status: 'ACTIVE',
            },
          ],
        },
      },
    };

    it('should mark lesson as COMPLETED and update course progress', async () => {
      // Arrange
      mockPrismaService.lesson.findUnique.mockResolvedValue(mockLesson);
      mockPrismaService.lessonProgress.upsert.mockResolvedValue({
        id: 'progress-123',
        studentId,
        lessonId,
        status: LessonProgressStatus.COMPLETED,
        lastPosition: 0,
        watchedDuration: 0,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock course progress calculation: 1 out of 1 lessons completed = 100%
      mockPrismaService.lesson.findMany.mockResolvedValue([
        { id: lessonId },
      ]);
      mockPrismaService.lessonProgress.count.mockResolvedValue(1);
      mockPrismaService.courseEnrollment.update.mockResolvedValue({
        id: enrollmentId,
        progressPercentage: 100,
      });

      // Act
      const result = await service.completeLesson(studentId, lessonId);

      // Assert
      expect(result.lessonProgress.status).toBe(LessonProgressStatus.COMPLETED);
      expect(result.lessonProgress.completedAt).toBeDefined();
      expect(result.courseProgress.courseId).toBe(courseId);
      expect(result.courseProgress.progressPercentage).toBe(100);
      expect(mockPrismaService.courseEnrollment.update).toHaveBeenCalledWith({
        where: { id: enrollmentId },
        data: {
          progressPercentage: 100,
          lastAccessedAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException if lesson does not exist', async () => {
      // Arrange
      mockPrismaService.lesson.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.completeLesson(studentId, lessonId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if student is not enrolled', async () => {
      // Arrange
      const lessonWithoutEnrollment = {
        ...mockLesson,
        module: {
          ...mockLesson.module,
          course: {
            ...mockLesson.module.course,
            enrollments: [],
          },
        },
      };
      mockPrismaService.lesson.findUnique.mockResolvedValue(
        lessonWithoutEnrollment,
      );

      // Act & Assert
      await expect(service.completeLesson(studentId, lessonId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('calculateCourseProgress', () => {
    const studentId = 'student-123';
    const courseId = 'course-789';

    it('should return 0% when course has no published lessons', async () => {
      // Arrange
      mockPrismaService.lesson.findMany.mockResolvedValue([]);

      // Act
      const result = await service.calculateCourseProgress(studentId, courseId);

      // Assert
      expect(result).toBe(0);
    });

    it('should return 0% when no lessons are completed', async () => {
      // Arrange
      mockPrismaService.lesson.findMany.mockResolvedValue([
        { id: 'lesson-1' },
        { id: 'lesson-2' },
        { id: 'lesson-3' },
      ]);
      mockPrismaService.lessonProgress.count.mockResolvedValue(0);

      // Act
      const result = await service.calculateCourseProgress(studentId, courseId);

      // Assert
      expect(result).toBe(0);
    });

    it('should return 33% when 1 out of 3 lessons completed', async () => {
      // Arrange
      mockPrismaService.lesson.findMany.mockResolvedValue([
        { id: 'lesson-1' },
        { id: 'lesson-2' },
        { id: 'lesson-3' },
      ]);
      mockPrismaService.lessonProgress.count.mockResolvedValue(1);

      // Act
      const result = await service.calculateCourseProgress(studentId, courseId);

      // Assert
      expect(result).toBe(33); // Math.round(1/3 * 100) = 33
    });

    it('should return 67% when 2 out of 3 lessons completed', async () => {
      // Arrange
      mockPrismaService.lesson.findMany.mockResolvedValue([
        { id: 'lesson-1' },
        { id: 'lesson-2' },
        { id: 'lesson-3' },
      ]);
      mockPrismaService.lessonProgress.count.mockResolvedValue(2);

      // Act
      const result = await service.calculateCourseProgress(studentId, courseId);

      // Assert
      expect(result).toBe(67); // Math.round(2/3 * 100) = 67
    });

    it('should return 100% when all lessons completed', async () => {
      // Arrange
      mockPrismaService.lesson.findMany.mockResolvedValue([
        { id: 'lesson-1' },
        { id: 'lesson-2' },
        { id: 'lesson-3' },
      ]);
      mockPrismaService.lessonProgress.count.mockResolvedValue(3);

      // Act
      const result = await service.calculateCourseProgress(studentId, courseId);

      // Assert
      expect(result).toBe(100);
    });

    it('should only count published lessons in progress calculation', async () => {
      // Arrange - Only return PUBLISHED lessons
      mockPrismaService.lesson.findMany.mockResolvedValue([
        { id: 'lesson-1' },
        { id: 'lesson-2' },
        // lesson-3 is DRAFT, not included
      ]);
      mockPrismaService.lessonProgress.count.mockResolvedValue(1);

      // Act
      const result = await service.calculateCourseProgress(studentId, courseId);

      // Assert
      expect(result).toBe(50); // 1 out of 2 published lessons = 50%
      expect(mockPrismaService.lesson.findMany).toHaveBeenCalledWith({
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
    });
  });
});
