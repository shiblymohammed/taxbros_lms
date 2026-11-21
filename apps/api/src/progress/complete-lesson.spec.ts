/**
 * Unit Tests for Manual Lesson Completion (Task 34)
 * 
 * Tests the completeLesson method which is called by:
 * - POST /lessons/:lessonId/complete endpoint (manual completion)
 * - Auto-completion logic when video reaches 90%
 * 
 * Requirements:
 * - R21.4: Manual completion button
 * - R21.5: Set completedAt timestamp
 * - R21.6: Update course progress percentage
 * - R2.5: Student can only access own records
 * - R2.11: Validate enrollment before access
 */

import { ProgressService } from './progress.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { LessonProgressStatus } from '@prisma/client';

describe('ProgressService - completeLesson (Task 34)', () => {
  let service: ProgressService;
  let prisma: PrismaService;

  // Mock data
  const mockStudentId = 'student-123';
  const mockLessonId = 'lesson-456';
  const mockCourseId = 'course-789';
  const mockModuleId = 'module-101';
  const mockEnrollmentId = 'enrollment-202';

  beforeEach(() => {
    prisma = {
      lesson: {
        findUnique: jest.fn(),
      },
      lessonProgress: {
        upsert: jest.fn(),
        count: jest.fn(),
      },
      courseEnrollment: {
        update: jest.fn(),
      },
    } as any;

    service = new ProgressService(prisma);
  });

  describe('Successful Completion', () => {
    it('should complete a lesson and return updated progress', async () => {
      // Arrange
      const mockLesson = {
        id: mockLessonId,
        title: 'Introduction to Tax Filing',
        module: {
          id: mockModuleId,
          course: {
            id: mockCourseId,
            enrollments: [
              {
                id: mockEnrollmentId,
                studentId: mockStudentId,
                status: 'ACTIVE',
              },
            ],
          },
        },
      };

      const mockCompletedProgress = {
        id: 'progress-303',
        studentId: mockStudentId,
        lessonId: mockLessonId,
        status: LessonProgressStatus.COMPLETED,
        completedAt: new Date(),
        lastPosition: 150,
        watchedDuration: 300,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock database responses
      (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(mockLesson);
      (prisma.lessonProgress.upsert as jest.Mock).mockResolvedValue(
        mockCompletedProgress,
      );
      (prisma.lesson.findMany as any) = jest.fn().mockResolvedValue([
        { id: 'lesson-1' },
        { id: 'lesson-2' },
        { id: mockLessonId },
      ]);
      (prisma.lessonProgress.count as jest.Mock).mockResolvedValue(1);
      (prisma.courseEnrollment.update as jest.Mock).mockResolvedValue({
        id: mockEnrollmentId,
        progressPercentage: 33,
      });

      // Act
      const result = await service.completeLesson(mockStudentId, mockLessonId);

      // Assert
      expect(result).toBeDefined();
      expect(result.lessonProgress).toEqual(mockCompletedProgress);
      expect(result.lessonProgress.status).toBe(LessonProgressStatus.COMPLETED);
      expect(result.lessonProgress.completedAt).toBeDefined();
      expect(result.courseProgress).toBeDefined();
      expect(result.courseProgress.courseId).toBe(mockCourseId);

      // Verify R21.5: completedAt timestamp is set
      expect(result.lessonProgress.completedAt).toBeInstanceOf(Date);

      // Verify the upsert was called with correct data
      expect(prisma.lessonProgress.upsert).toHaveBeenCalledWith({
        where: {
          studentId_lessonId: {
            studentId: mockStudentId,
            lessonId: mockLessonId,
          },
        },
        update: {
          status: LessonProgressStatus.COMPLETED,
          completedAt: expect.any(Date),
        },
        create: {
          studentId: mockStudentId,
          lessonId: mockLessonId,
          status: LessonProgressStatus.COMPLETED,
          completedAt: expect.any(Date),
          lastPosition: 0,
          watchedDuration: 0,
        },
      });

      // Verify R21.6: Course enrollment progress was updated
      expect(prisma.courseEnrollment.update).toHaveBeenCalledWith({
        where: { id: mockEnrollmentId },
        data: {
          progressPercentage: expect.any(Number),
          lastAccessedAt: expect.any(Date),
        },
      });
    });

    it('should handle completion of NOT_STARTED lesson', async () => {
      // Test completing a lesson that hasn't been started yet
      const mockLesson = {
        id: mockLessonId,
        module: {
          course: {
            id: mockCourseId,
            enrollments: [{ id: mockEnrollmentId, studentId: mockStudentId, status: 'ACTIVE' }],
          },
        },
      };

      (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(mockLesson);
      (prisma.lessonProgress.upsert as jest.Mock).mockResolvedValue({
        id: 'progress-404',
        studentId: mockStudentId,
        lessonId: mockLessonId,
        status: LessonProgressStatus.COMPLETED,
        completedAt: new Date(),
        lastPosition: 0,
        watchedDuration: 0,
      });
      (prisma.lesson.findMany as any) = jest.fn().mockResolvedValue([{ id: mockLessonId }]);
      (prisma.lessonProgress.count as jest.Mock).mockResolvedValue(1);
      (prisma.courseEnrollment.update as jest.Mock).mockResolvedValue({});

      const result = await service.completeLesson(mockStudentId, mockLessonId);

      expect(result.lessonProgress.status).toBe(LessonProgressStatus.COMPLETED);
    });

    it('should handle completion of IN_PROGRESS lesson', async () => {
      // Test completing a lesson that is already in progress
      const mockLesson = {
        id: mockLessonId,
        module: {
          course: {
            id: mockCourseId,
            enrollments: [{ id: mockEnrollmentId, studentId: mockStudentId, status: 'ACTIVE' }],
          },
        },
      };

      (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(mockLesson);
      (prisma.lessonProgress.upsert as jest.Mock).mockResolvedValue({
        id: 'progress-505',
        studentId: mockStudentId,
        lessonId: mockLessonId,
        status: LessonProgressStatus.COMPLETED,
        completedAt: new Date(),
        lastPosition: 150,
        watchedDuration: 200,
      });
      (prisma.lesson.findMany as any) = jest.fn().mockResolvedValue([{ id: mockLessonId }]);
      (prisma.lessonProgress.count as jest.Mock).mockResolvedValue(1);
      (prisma.courseEnrollment.update as jest.Mock).mockResolvedValue({});

      const result = await service.completeLesson(mockStudentId, mockLessonId);

      expect(result.lessonProgress.status).toBe(LessonProgressStatus.COMPLETED);
      expect(result.lessonProgress.lastPosition).toBe(150);
      expect(result.lessonProgress.watchedDuration).toBe(200);
    });

    it('should be idempotent - completing already completed lesson should work', async () => {
      // R21 allows marking an already-completed lesson as complete again
      const existingCompletedAt = new Date('2024-01-15T10:00:00Z');

      const mockLesson = {
        id: mockLessonId,
        module: {
          course: {
            id: mockCourseId,
            enrollments: [{ id: mockEnrollmentId, studentId: mockStudentId, status: 'ACTIVE' }],
          },
        },
      };

      (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(mockLesson);
      (prisma.lessonProgress.upsert as jest.Mock).mockResolvedValue({
        id: 'progress-606',
        studentId: mockStudentId,
        lessonId: mockLessonId,
        status: LessonProgressStatus.COMPLETED,
        completedAt: existingCompletedAt,
        lastPosition: 500,
        watchedDuration: 500,
      });
      (prisma.lesson.findMany as any) = jest.fn().mockResolvedValue([{ id: mockLessonId }]);
      (prisma.lessonProgress.count as jest.Mock).mockResolvedValue(1);
      (prisma.courseEnrollment.update as jest.Mock).mockResolvedValue({});

      const result = await service.completeLesson(mockStudentId, mockLessonId);

      expect(result.lessonProgress.status).toBe(LessonProgressStatus.COMPLETED);
    });
  });

  describe('Error Handling', () => {
    it('should throw NotFoundException when lesson does not exist', async () => {
      // R21: Proper error handling for non-existent lessons
      (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.completeLesson(mockStudentId, 'non-existent-lesson'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.completeLesson(mockStudentId, 'non-existent-lesson'),
      ).rejects.toThrow('Lesson with ID non-existent-lesson not found');
    });

    it('should throw ForbiddenException when student is not enrolled', async () => {
      // R2.11: Validate enrollment before allowing completion
      // R2.5: Students can only complete their own lessons
      const mockLesson = {
        id: mockLessonId,
        module: {
          course: {
            id: mockCourseId,
            enrollments: [], // No enrollments
          },
        },
      };

      (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(mockLesson);

      await expect(
        service.completeLesson(mockStudentId, mockLessonId),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.completeLesson(mockStudentId, mockLessonId),
      ).rejects.toThrow('You must be enrolled in this course to complete lessons');
    });

    it('should throw ForbiddenException when enrollment is not ACTIVE', async () => {
      // The query only loads ACTIVE enrolments, so a DROPPED student's lesson comes back with none
      const mockLesson = {
        id: mockLessonId,
        module: {
          course: {
            id: mockCourseId,
            enrollments: [],
          },
        },
      };

      (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(mockLesson);

      await expect(
        service.completeLesson(mockStudentId, mockLessonId),
      ).rejects.toThrow(ForbiddenException);

      const query = (prisma.lesson.findUnique as jest.Mock).mock.calls.at(-1)[0];
      expect(query.include.module.include.course.include.enrollments.where).toEqual({
        studentId: mockStudentId,
        status: 'ACTIVE',
      });
      expect(prisma.lessonProgress.upsert).not.toHaveBeenCalled();
    });
  });

  describe('Course Progress Calculation', () => {
    it('should calculate correct progress percentage after completion', async () => {
      // Scenario: 1 out of 3 lessons completed = 33%
      const mockLesson = {
        id: mockLessonId,
        module: {
          course: {
            id: mockCourseId,
            enrollments: [{ id: mockEnrollmentId, studentId: mockStudentId, status: 'ACTIVE' }],
          },
        },
      };

      (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(mockLesson);
      (prisma.lessonProgress.upsert as jest.Mock).mockResolvedValue({
        id: 'progress-707',
        status: LessonProgressStatus.COMPLETED,
        completedAt: new Date(),
      });
      (prisma.lesson.findMany as any) = jest.fn().mockResolvedValue([
        { id: 'lesson-1' },
        { id: 'lesson-2' },
        { id: mockLessonId },
      ]);
      (prisma.lessonProgress.count as jest.Mock).mockResolvedValue(1);
      (prisma.courseEnrollment.update as jest.Mock).mockResolvedValue({
        progressPercentage: 33,
      });

      const result = await service.completeLesson(mockStudentId, mockLessonId);

      // Verify progress percentage is included in response
      expect(result.courseProgress.progressPercentage).toBe(33);
    });

    it('should reach 100% when all lessons are completed', async () => {
      const mockLesson = {
        id: mockLessonId,
        module: {
          course: {
            id: mockCourseId,
            enrollments: [{ id: mockEnrollmentId, studentId: mockStudentId, status: 'ACTIVE' }],
          },
        },
      };

      (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(mockLesson);
      (prisma.lessonProgress.upsert as jest.Mock).mockResolvedValue({
        status: LessonProgressStatus.COMPLETED,
        completedAt: new Date(),
      });
      (prisma.lesson.findMany as any) = jest.fn().mockResolvedValue([
        { id: 'lesson-1' },
        { id: 'lesson-2' },
      ]);
      (prisma.lessonProgress.count as jest.Mock).mockResolvedValue(2);
      (prisma.courseEnrollment.update as jest.Mock).mockResolvedValue({
        progressPercentage: 100,
      });

      const result = await service.completeLesson(mockStudentId, mockLessonId);

      expect(result.courseProgress.progressPercentage).toBe(100);
    });
  });

  describe('Integration with Controller', () => {
    it('should work when called from POST /lessons/:lessonId/complete', () => {
      // This test documents that the controller calls this method
      // Controller endpoint: POST /lessons/:lessonId/complete
      // Controller method: completeLesson(@Param('lessonId'), @CurrentUser('studentId'))
      // Service method: completeLesson(studentId, lessonId)

      expect(service.completeLesson).toBeDefined();
      expect(typeof service.completeLesson).toBe('function');
    });
  });
});
