import {
  Controller,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { CoursesService } from '../courses/courses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { StaffPermissionType } from '@prisma/client';

/**
 * Upload Controller
 * 
 * Provides endpoints for:
 * - POST /upload/course-cover/:courseId - Upload course cover image (admin only)
 * - DELETE /upload/course-cover/:courseId - Delete course cover image (admin only)
 * 
 * Requirements:
 * - R15: Course cover image management
 * 
 * Access Control:
 * - All endpoints: ADMINISTRATOR role required
 */
@ApiTags('Uploads')
@ApiBearerAuth('JWT')
@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly coursesService: CoursesService,
  ) {}

  /**
   * Upload course cover image
   * 
   * POST /upload/course-cover/:courseId
   * 
   * Requirements:
   * - R15.3: Validate file size max 2MB
   * - R15.4: Resize images wider than 1200px
   * - R15.5: Store images in /uploads/{year}/{month}/{filename}
   * - R15.6: Update course.coverImage with file path
   * 
   * Access: ADMINISTRATOR only
   */
  @Post('course-cover/:courseId')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Upload course cover image',
    description: 'Upload and process a course cover image. Validates file size (max 2MB), resizes images wider than 1200px, and stores in /uploads/{year}/{month}/ directory.'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (jpg, png, or webp, max 2MB)'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Image uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        coverImage: { type: 'string' },
        course: { type: 'object' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid file or course not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  async uploadCourseCover(
    @Param('courseId') courseId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Verify course exists
    const course = await this.coursesService.findOne(courseId);
    if (!course) {
      throw new BadRequestException('Course not found');
    }

    // Delete old cover image if exists
    if (course.coverImage) {
      await this.uploadService.deleteCourseCover(course.coverImage);
    }

    // Upload and process new image
    const imagePath = await this.uploadService.uploadCourseCover(file);

    // Update course with new image path
    const updatedCourse = await this.coursesService.update(courseId, {
      coverImage: imagePath,
    });

    return {
      message: 'Course cover image uploaded successfully',
      coverImage: imagePath,
      course: updatedCourse,
    };
  }

  /**
   * Delete course cover image
   * 
   * DELETE /upload/course-cover/:courseId
   * 
   * Requirements:
   * - R15.7: Remove file from storage and clear database reference
   * 
   * Access: ADMINISTRATOR only
   */
  @Delete('course-cover/:courseId')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Delete course cover image',
    description: 'Delete the cover image for a course, removing both the file from storage and the database reference.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Image deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - course not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  async deleteCourseCover(@Param('courseId') courseId: string) {
    // Verify course exists
    const course = await this.coursesService.findOne(courseId);
    if (!course) {
      throw new BadRequestException('Course not found');
    }

    if (!course.coverImage) {
      return {
        message: 'No cover image to delete',
      };
    }

    // Delete file from storage
    await this.uploadService.deleteCourseCover(course.coverImage);

    // Update course to remove image reference
    await this.coursesService.update(courseId, {
      coverImage: null,
    });

    return {
      message: 'Course cover image deleted successfully',
    };
  }
}
