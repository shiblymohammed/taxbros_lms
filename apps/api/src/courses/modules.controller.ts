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
import { ModulesService } from './modules.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { StaffPermissionType } from '@prisma/client';

/**
 * Modules Controller
 * 
 * Provides endpoints for:
 * - POST /courses/:courseId/modules - Create module within a course
 * - GET /modules/:id - Get module details with lessons
 * - PATCH /modules/:id - Update module properties
 * - DELETE /modules/:id - Delete module (cascade to lessons)
 * 
 * Requirements:
 * - R17: Module management within courses
 * 
 * Access Control:
 * - POST, PATCH, DELETE: ADMINISTRATOR role required
 * - GET: ADMINISTRATOR, STAFF roles allowed (students access via courses)
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  /**
   * Create a new module within a course
   * 
   * POST /courses/:courseId/modules
   * 
   * Requirements:
   * - R17.1: Require title
   * - R17.2: Associate with parent course
   * - R17.5: Support display order for sorting
   * 
   * Access: ADMINISTRATOR only
   */
  @Post('courses/:courseId/modules')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('courseId') courseId: string,
    @Body() createModuleDto: CreateModuleDto,
  ) {
    return this.modulesService.create(courseId, createModuleDto);
  }

  /**
   * Get module details with lessons
   * 
   * GET /modules/:id
   * 
   * Requirements:
   * - R17.7: Display modules ordered by display_order
   * 
   * Access: ADMINISTRATOR, STAFF
   */
  @Get('modules/:id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  findOne(@Param('id') id: string) {
    return this.modulesService.findOne(id);
  }

  /**
   * Update module properties
   * 
   * PATCH /modules/:id
   * 
   * Requirements:
   * - R17: Support updating title, description
   * - R17.6: Allow reordering modules
   * 
   * Access: ADMINISTRATOR only
   */
  @Patch('modules/:id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  update(@Param('id') id: string, @Body() updateModuleDto: UpdateModuleDto) {
    return this.modulesService.update(id, updateModuleDto);
  }

  /**
   * Delete module (soft delete with cascade to lessons)
   * 
   * DELETE /modules/:id
   * 
   * Requirements:
   * - R17.3: Cascade delete associated lessons
   * 
   * Access: ADMINISTRATOR only
   */
  @Delete('modules/:id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.modulesService.remove(id);
  }
}
