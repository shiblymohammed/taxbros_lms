import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { StaffPermissionType } from '@prisma/client';

/**
 * Lessons Controller
 * 
 * Provides endpoints for:
 * - POST /modules/:moduleId/lessons - Create lesson within a module
 * - GET /lessons/:id - Get lesson details
 * - PATCH /lessons/:id - Update lesson properties
 * - PATCH /lessons/:id/publish - Publish lesson
 * - PATCH /lessons/:id/unpublish - Unpublish lesson
 * - DELETE /lessons/:id - Delete lesson
 * 
 * Requirements:
 * - R18: Lesson creation and management
 * - R19: Lesson publishing control
 * 
 * Access Control:
 * - POST, PATCH, DELETE: ADMINISTRATOR role required
 * - GET: ADMINISTRATOR, STAFF roles allowed (students access via courses)
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  /**
   * Create a new lesson within a module
   * 
   * POST /modules/:moduleId/lessons
   * 
   * Requirements:
   * - R18.1: Require title and YouTube video URL
   * - R18.2: Validate YouTube URL format
   * - R18.3: Status defaults to DRAFT
   * - R18.4: Support display order for sorting
   * 
   * Access: ADMINISTRATOR only
   */
  @Post('modules/:moduleId/lessons')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('moduleId') moduleId: string,
    @Body() createLessonDto: CreateLessonDto,
  ) {
    return this.lessonsService.create(moduleId, createLessonDto);
  }

  /**
   * Get lesson details
   * 
   * GET /lessons/:id
   * 
   * Requirements:
   * - R18: Return lesson with module and course details
   * - R20: Students need access to lesson details for video player
   * 
   * Access: All authenticated users
   * Note: Students can access published lessons they are enrolled in
   */
  @Get('lessons/:id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.STUDENT)
  findOne(@Param('id') id: string) {
    return this.lessonsService.findOne(id);
  }

  /**
   * Update lesson properties
   * 
   * PATCH /lessons/:id
   * 
   * Requirements:
   * - R18: Support updating all lesson properties
   * - R18.5: Allow replacing YouTube URL
   * - R19: Support status changes for publishing/unpublishing
   * 
   * Access: ADMINISTRATOR only
   */
  @Patch('lessons/:id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  update(@Param('id') id: string, @Body() updateLessonDto: UpdateLessonDto) {
    return this.lessonsService.update(id, updateLessonDto);
  }

  /**
   * Publish a lesson
   * 
   * PATCH /lessons/:id/publish
   * 
   * Requirements:
   * - R19.1: Set lesson status to PUBLISHED
   * - R19.2: Make lesson visible when course is also PUBLISHED
   * 
   * Access: ADMINISTRATOR only
   */
  @Patch('lessons/:id/publish')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  publish(@Param('id') id: string) {
    return this.lessonsService.publish(id);
  }

  /**
   * Unpublish a lesson
   * 
   * PATCH /lessons/:id/unpublish
   * 
   * Requirements:
   * - R19.4: Set lesson status to DRAFT
   * - R19.5: Retain all student progress records
   * - R19.3: Hide from students regardless of course status
   * 
   * Access: ADMINISTRATOR only
   */
  @Patch('lessons/:id/unpublish')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  unpublish(@Param('id') id: string) {
    return this.lessonsService.unpublish(id);
  }

  /**
   * Delete lesson
   * 
   * DELETE /lessons/:id
   * 
   * Requirements:
   * - R18.6: Delete lesson (cascade deletes progress)
   * - Warn about existing student progress
   * 
   * Access: ADMINISTRATOR only
   */
  @Delete('lessons/:id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.lessonsService.remove(id);
  }
}
