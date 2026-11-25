import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import { UpdatePositionDto } from './dto/update-position.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

/**
 * Progress Controller
 *
 * Provides endpoints for:
 * - PATCH /lessons/:lessonId/progress - Update video position and track progress
 * - GET /lessons/:lessonId/progress - Get lesson progress for current user
 * - POST /lessons/:lessonId/complete - Manually complete lesson
 * - GET /courses/:courseId/progress - Get all lesson progress in a course for current user
 * - GET /students/:studentId/progress - Get all progress for a student
 *
 * Requirements:
 * - R20: Video playback and position tracking
 * - R21: Lesson progress tracking
 * - R22: Course progress dashboard and calculation
 *
 * Access Control:
 * - Students can only access their own progress
 * - Administrators can view any student's progress
 */
@ApiTags('Progress')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  /**
   * Update video playback position
   *
   * PATCH /lessons/:lessonId/progress
   *
   * Requirements:
   * - R20.3: Update lastPosition field
   * - R20.7: Update at intervals during playback
   * - R20.8: Track watchedDuration
   * - R21.2: Set status to IN_PROGRESS
   * - R21.3: Auto-complete at 90% threshold
   * - R2.11: Validate enrollment before access
   *
   * Access: STUDENT (own progress only)
   */
  @Patch('lessons/:lessonId/progress')
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.OK)
  async updatePosition(
    @Param('lessonId') lessonId: string,
    @CurrentUser('studentId') studentId: string | undefined,
    @Body() updatePositionDto: UpdatePositionDto
  ) {
    if (!studentId) {
      throw new BadRequestException('Student ID not found in user context');
    }
    // Locked lessons (learning order / quiz gate) cannot record progress
    await this.progressService.access.assertLessonOpen(studentId, lessonId);
    return this.progressService.updatePosition(lessonId, studentId, updatePositionDto);
  }

  /**
   * Get lesson progress for current user
   *
   * GET /lessons/:lessonId/progress
   *
   * Requirements:
   * - R20.4: Retrieve lastPosition value
   * - R21.1: Return progress status (NOT_STARTED, IN_PROGRESS, COMPLETED)
   * - R21.9: Display progress status on lesson page
   *
   * Authorization:
   * - Students can only view their own progress
   * - Administrators and staff can view any student's progress (use GET /students/:studentId/progress instead)
   *
   * Response includes:
   * - status: LessonProgressStatus
   * - lastPosition: number (seconds)
   * - watchedDuration: number (seconds)
   * - completedAt: DateTime | null
   * - lesson details (title, duration, course info)
   *
   * Access: STUDENT (own progress only), ADMINISTRATOR, STAFF (if they have student profile)
   */
  @Get('lessons/:lessonId/progress')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.STUDENT)
  @ApiOperation({
    summary: 'Get lesson progress for current user',
    description:
      'Retrieves progress for a specific lesson including status (NOT_STARTED, IN_PROGRESS, COMPLETED), last position, watched duration, and completion timestamp. Returns default NOT_STARTED if no record exists. Students can only view their own progress.',
  })
  @ApiParam({
    name: 'lessonId',
    description: 'UUID of the lesson',
    type: 'string',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Lesson progress retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', nullable: true },
        studentId: { type: 'string' },
        lessonId: { type: 'string' },
        status: { type: 'string', enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] },
        lastPosition: { type: 'number', description: 'Last playback position in seconds' },
        watchedDuration: { type: 'number', description: 'Total watched duration in seconds' },
        completedAt: { type: 'string', format: 'date-time', nullable: true },
        lesson: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            duration: { type: 'number', nullable: true },
            course: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Student not enrolled in course or unauthorized access',
  })
  @ApiResponse({
    status: 404,
    description: 'Lesson or student not found',
  })
  async getLessonProgress(@Param('lessonId') lessonId: string, @Req() req: any) {
    // Get the student ID for the requesting user
    const user = await this.progressService['prisma'].user.findUnique({
      where: { id: req.user.userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      // If the user doesn't have a student profile, they can't have progress
      return {
        id: null,
        studentId: null,
        lessonId: lessonId,
        status: 'NOT_STARTED',
        lastPosition: 0,
        watchedDuration: 0,
        completedAt: null,
        createdAt: null,
        updatedAt: null,
        lesson: null,
      };
    }

    return this.progressService.getLessonProgress(
      lessonId,
      user.studentProfile.id,
      req.user.userId,
      req.user.role
    );
  }

  /**
   * Manually complete a lesson
   *
   * POST /lessons/:lessonId/complete
   *
   * Requirements:
   * - R21.4: Manual completion button
   * - R21.5: Set completedAt timestamp
   * - R21.6: Update course progress percentage
   *
   * Access: STUDENT (own progress only)
   */
  @Post('lessons/:lessonId/complete')
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.OK)
  async completeLesson(
    @Param('lessonId') lessonId: string,
    @CurrentUser('studentId') studentId: string | undefined
  ) {
    if (!studentId) {
      throw new BadRequestException('Student ID not found in user context');
    }
    // Only an open lesson whose video has been watched can be completed by hand
    await this.progressService.access.assertLessonOpen(studentId, lessonId);
    await this.progressService.assertWatchedEnough(studentId, lessonId);
    return this.progressService.completeLesson(studentId, lessonId);
  }

  /**
   * Get all lesson progress for current user in a specific course
   *
   * GET /courses/:courseId/progress
   *
   * Requirements:
   * - R22.3: Display all published modules and lessons ordered by display_order
   * - R22.4: Display lesson progress status for each lesson
   *
   * Authorization:
   * - Students can only view their own progress
   * - Administrators and staff would use the GET /students/:studentId/progress endpoint
   *
   * Response includes:
   * - courseId, courseTitle
   * - enrollmentStatus
   * - progressPercentage (from enrollment)
   * - lessons array with:
   *   - lessonId, lessonTitle, moduleTitle
   *   - status, lastPosition, watchedDuration, completedAt
   *
   * Access: All authenticated users
   */
  @Get('courses/:courseId/progress')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.STUDENT)
  @ApiOperation({
    summary: 'Get all lesson progress in a course for current user',
    description:
      'Retrieves progress for all published lessons in a course, ordered by display order. Includes enrollment status and overall course progress percentage. Students can only view their own progress.',
  })
  @ApiParam({
    name: 'courseId',
    description: 'UUID of the course',
    type: 'string',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Course progress retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        courseId: { type: 'string' },
        courseTitle: { type: 'string' },
        enrollmentStatus: { type: 'string', enum: ['ACTIVE', 'COMPLETED', 'DROPPED'] },
        progressPercentage: { type: 'number', description: 'Overall course completion percentage' },
        lessons: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              lessonId: { type: 'string' },
              lessonTitle: { type: 'string' },
              moduleTitle: { type: 'string' },
              displayOrder: { type: 'number' },
              duration: { type: 'number', nullable: true },
              status: { type: 'string', enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] },
              lastPosition: { type: 'number' },
              watchedDuration: { type: 'number' },
              completedAt: { type: 'string', format: 'date-time', nullable: true },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Student not enrolled in course or unauthorized access',
  })
  @ApiResponse({
    status: 404,
    description: 'Course or student not found',
  })
  async getCourseProgress(@Param('courseId') courseId: string, @Req() req: any) {
    // Get the student ID for the requesting user
    const user = await this.progressService['prisma'].user.findUnique({
      where: { id: req.user.userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      return {
        courseId: courseId,
        courseTitle: null,
        enrollmentStatus: null,
        progressPercentage: 0,
        lessons: [],
      };
    }

    return this.progressService.getCourseProgress(
      courseId,
      user.studentProfile.id,
      req.user.userId,
      req.user.role
    );
  }

  /**
   * Get all lesson progress for a specific student
   *
   * GET /students/:studentId/progress
   *
   * Requirements:
   * - R22.1: Display all course enrollments with status ACTIVE
   * - R22.2: Display course title, cover image, and progress percentage
   * - R22.8: Administrators can view student profile with progress percentage
   *
   * Authorization:
   * - Students can only view their own progress
   * - Administrators and staff can view any student's progress
   *
   * Response includes:
   * - studentId, studentName
   * - courses array with:
   *   - enrollmentId, courseId, courseTitle, courseCoverImage
   *   - enrollmentStatus, progressPercentage
   *   - totalLessons, completedLessons
   *   - lastAccessedAt, enrolledAt
   *   - lessons array with status and completedAt
   *
   * Access: All authenticated users (with authorization check)
   */
  @Get('students/:studentId/progress')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.STUDENT)
  @ApiOperation({
    summary: 'Get all progress for a student',
    description:
      'Retrieves all course enrollments and lesson progress for a student. Includes course metadata, enrollment details, and progress statistics. Students can only view their own progress; administrators and staff can view any student.',
  })
  @ApiParam({
    name: 'studentId',
    description: 'UUID of the student',
    type: 'string',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Student progress retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        studentId: { type: 'string' },
        studentName: { type: 'string' },
        courses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              enrollmentId: { type: 'string' },
              courseId: { type: 'string' },
              courseTitle: { type: 'string' },
              courseCoverImage: { type: 'string', nullable: true },
              enrollmentStatus: { type: 'string', enum: ['ACTIVE', 'COMPLETED', 'DROPPED'] },
              progressPercentage: { type: 'number' },
              totalLessons: { type: 'number' },
              completedLessons: { type: 'number' },
              lastAccessedAt: { type: 'string', format: 'date-time', nullable: true },
              enrolledAt: { type: 'string', format: 'date-time' },
              lessons: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    lessonId: { type: 'string' },
                    lessonTitle: { type: 'string' },
                    moduleTitle: { type: 'string' },
                    status: { type: 'string', enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] },
                    completedAt: { type: 'string', format: 'date-time', nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Unauthorized access to student progress',
  })
  @ApiResponse({
    status: 404,
    description: 'Student not found',
  })
  async getStudentProgress(@Param('studentId') studentId: string, @Req() req: any) {
    return this.progressService.getStudentProgress(studentId, req.user.userId, req.user.role);
  }
}
