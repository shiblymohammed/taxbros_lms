import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { assertNoQuizAttempts, deleteAttachedQuizzes } from './attached-quizzes';
import { recalculateCourseProgress } from './course-progress';
import { UpdateLessonDto } from './dto/update-lesson.dto';

/**
 * Lessons Service
 * 
 * Provides business logic for:
 * - Creating lessons within modules
 * - Retrieving lesson details
 * - Updating lesson properties including status
 * - Publishing/unpublishing lessons
 * - Deleting lessons
 * 
 * Requirements:
 * - R18: Lesson creation and management
 * - R19: Lesson publishing control
 */
@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate YouTube URL format
   * 
   * Requirements:
   * - R18.2: Validate YouTube URL format
   * 
   * Accepts:
   * - https://www.youtube.com/watch?v=VIDEO_ID
   * - https://youtu.be/VIDEO_ID
   * - http versions (auto-upgraded to https)
   */
  private validateYouTubeUrl(url: string): void {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
    if (!youtubeRegex.test(url)) {
      throw new BadRequestException(
        'Invalid YouTube URL format. Expected format: https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID'
      );
    }
  }

  /**
   * Create a new lesson within a module
   * 
   * Requirements:
   * - R18.1: Require title and YouTube video URL
   * - R18.2: Validate YouTube URL format
   * - R18.3: Status defaults to DRAFT
   * - R18.4: Support display order for sorting
   * 
   * @param moduleId - Parent module ID
   * @param createLessonDto - Lesson data
   * @returns Created lesson
   */
  async create(moduleId: string, createLessonDto: CreateLessonDto) {
    // Verify module exists
    const module = await this.prisma.courseModule.findUnique({
      where: { id: moduleId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!module) {
      throw new NotFoundException(`Module with ID ${moduleId} not found`);
    }

    // Validate YouTube URL
    this.validateYouTubeUrl(createLessonDto.videoUrl);

    // If displayOrder not provided, set to next available order
    let displayOrder = createLessonDto.displayOrder;
    if (displayOrder === undefined) {
      const maxOrder = await this.prisma.lesson.aggregate({
        where: { moduleId },
        _max: { displayOrder: true },
      });
      displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;
    }

    // Create lesson
    const lesson = await this.prisma.lesson.create({
      data: {
        moduleId,
        title: createLessonDto.title,
        description: createLessonDto.description,
        videoUrl: createLessonDto.videoUrl,
        duration: createLessonDto.duration,
        displayOrder,
        // status defaults to DRAFT as per schema
      },
      include: {
        module: {
          select: {
            id: true,
            title: true,
            courseId: true,
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

    return lesson;
  }

  /**
   * Get lesson by ID
   * 
   * Requirements:
   * - R18: Return lesson details
   * 
   * @param id - Lesson ID
   * @returns Lesson with module and course details
   */
  async findOne(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        module: {
          select: {
            id: true,
            title: true,
            courseId: true,
            course: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }

    return lesson;
  }

  /**
   * Update lesson properties
   * 
   * Requirements:
   * - R18: Support updating all lesson properties
   * - R18.5: Allow updating YouTube URL
   * - R19.1: Support publishing (status → PUBLISHED)
   * - R19.4: Support unpublishing (status → DRAFT)
   * 
   * @param id - Lesson ID
   * @param updateLessonDto - Update data
   * @returns Updated lesson
   */
  async update(id: string, updateLessonDto: UpdateLessonDto) {
    // Verify lesson exists
    const existingLesson = await this.prisma.lesson.findUnique({
      where: { id },
    });

    if (!existingLesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }

    // Validate YouTube URL if provided
    if (updateLessonDto.videoUrl) {
      this.validateYouTubeUrl(updateLessonDto.videoUrl);
    }

    // Update lesson
    const lesson = await this.prisma.lesson.update({
      where: { id },
      data: updateLessonDto,
      include: {
        module: {
          select: {
            id: true,
            title: true,
            courseId: true,
            course: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
    });

    // Publishing or unpublishing changes every enrolled student's course %
    if (updateLessonDto.status && updateLessonDto.status !== existingLesson.status) {
      await recalculateCourseProgress(this.prisma, lesson.module.courseId);
    }

    return lesson;
  }

  /**
   * Publish a lesson
   * 
   * Requirements:
   * - R19.1: Set lesson status to PUBLISHED
   * - R19.2: Make lesson visible when course is also PUBLISHED
   * 
   * @param id - Lesson ID
   * @returns Updated lesson
   */
  async publish(id: string) {
    return this.update(id, { status: 'PUBLISHED' });
  }

  /**
   * Unpublish a lesson
   * 
   * Requirements:
   * - R19.4: Set lesson status to DRAFT
   * - R19.5: Retain all student progress records
   * 
   * @param id - Lesson ID
   * @returns Updated lesson with progress retention info
   */
  async unpublish(id: string) {
    // Check if there's existing progress
    const progressCount = await this.prisma.lessonProgress.count({
      where: { lessonId: id },
    });

    const lesson = await this.update(id, { status: 'DRAFT' });

    return {
      ...lesson,
      progressRetained: progressCount > 0,
      affectedStudents: progressCount,
      warning: progressCount > 0 
        ? `This lesson has progress records from ${progressCount} student(s). Progress data will be retained but the lesson will be hidden from students.`
        : null,
    };
  }

  /**
   * Delete lesson
   * 
   * Requirements:
   * - R18.6: Delete lesson when module is deleted (cascade)
   * - R19.5: Consider student progress before deletion
   * 
   * @param id - Lesson ID
   * @returns Deleted lesson info
   */
  async remove(id: string) {
    // Verify lesson exists and check for progress
    const existingLesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        module: { select: { courseId: true } },
        lessonProgress: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!existingLesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }

    // Warn if there's student progress
    const hasProgress = existingLesson.lessonProgress.length > 0;

    await assertNoQuizAttempts(this.prisma, { lessonIds: [id] }, 'lesson');

    // Delete the lesson's quizzes, then the lesson (progress records cascade)
    const { lesson, deletedQuizzes } = await this.prisma.$transaction(async (tx) => {
      const count = await deleteAttachedQuizzes(tx, { lessonIds: [id] });
      const removed = await tx.lesson.delete({ where: { id } });
      return { lesson: removed, deletedQuizzes: count };
    });
    await recalculateCourseProgress(this.prisma, existingLesson.module.courseId);

    return {
      message: `Lesson "${existingLesson.title}" deleted successfully`,
      deletedLesson: lesson,
      deletedProgressRecords: existingLesson.lessonProgress.length,
      deletedQuizzes,
      warning: hasProgress
        ? `This lesson had ${existingLesson.lessonProgress.length} student progress record(s) which have been deleted.`
        : null,
    };
  }
}
