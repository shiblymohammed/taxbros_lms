import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { QueryClassDto } from './dto/query-class.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { StaffPermissionType } from '@prisma/client';

/**
 * Classes Controller
 * 
 * Provides endpoints for:
 * - POST /classes - Create new class
 * - GET /classes - List classes with status filter
 * - GET /classes/:id - Get class details with active enrollments
 * - PATCH /classes/:id - Update class
 * - POST /classes/:id/students - Enroll student
 * - DELETE /classes/:id/students/:studentId - Unenroll student
 * 
 * Requirements:
 * - R4: Class management with enrollment tracking
 * 
 * Access Control:
 * - POST, PATCH: ADMINISTRATOR role required
 * - GET: ADMINISTRATOR, STAFF roles allowed
 * - POST /students, DELETE /students: ADMINISTRATOR role required
 */
@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  /**
   * Create a new class
   * 
   * POST /classes
   * 
   * Requirements:
   * - R4.1: Require unique class name
   * - R4.2: Status defaults to ACTIVE
   * 
   * Access: ADMINISTRATOR only
   */
  @Post()
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_CLASSES)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createClassDto: CreateClassDto) {
    return this.classesService.create(createClassDto);
  }

  /**
   * List all classes with optional status filter
   * 
   * GET /classes?status=ACTIVE&page=1&limit=10
   * 
   * Requirements:
   * - R4: Support status filtering
   * 
   * Access: ADMINISTRATOR, STAFF
   */
  @Get()
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  findAll(@Query() query: QueryClassDto) {
    return this.classesService.findAll(query);
  }

  /**
   * Get single class with active enrollments
   * 
   * GET /classes/:id
   * 
   * Requirements:
   * - R4.7: Return only ACTIVE enrollments
   * 
   * Access: ADMINISTRATOR, STAFF
   */
  @Get(':id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  findOne(@Param('id') id: string) {
    return this.classesService.findOne(id);
  }

  /**
   * Update class details
   * 
   * PATCH /classes/:id
   * 
   * Requirements:
   * - R4: Support updating name, description, status
   * - R4.8: Support archiving classes
   * 
   * Access: ADMINISTRATOR only
   */
  @Patch(':id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_CLASSES)
  update(@Param('id') id: string, @Body() updateClassDto: UpdateClassDto) {
    return this.classesService.update(id, updateClassDto);
  }

  /**
   * Enroll a student in a class
   * 
   * POST /classes/:id/students
   * 
   * Requirements:
   * - R4.3: Create enrollment with ACTIVE status
   * - R4.4: Prevent duplicate enrollments
   * 
   * Access: ADMINISTRATOR only
   */
  @Post(':id/students')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_CLASSES)
  @HttpCode(HttpStatus.CREATED)
  enrollStudent(
    @Param('id') classId: string,
    @Body() enrollStudentDto: EnrollStudentDto,
  ) {
    return this.classesService.enrollStudent(classId, enrollStudentDto);
  }

  /**
   * Unenroll a student from a class (soft delete)
   * 
   * DELETE /classes/:id/students/:studentId
   * 
   * Requirements:
   * - R4.5: Set enrollment status to INACTIVE
   * - R4.6: Retain inactive enrollments for historical reporting
   * 
   * Access: ADMINISTRATOR only
   */
  @Delete(':id/students/:studentId')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_CLASSES)
  @HttpCode(HttpStatus.OK)
  unenrollStudent(
    @Param('id') classId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.classesService.unenrollStudent(classId, studentId);
  }
}
