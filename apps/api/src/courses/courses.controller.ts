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
  Req,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { QueryCourseDto } from './dto/query-course.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { QueryEnrollmentDto } from './dto/query-enrollment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, CourseStatus } from '@prisma/client';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { StaffPermissionType } from '@prisma/client';
import { StaffAccessService } from '../auth/staff-access.service';
import { ForbiddenException } from '@nestjs/common';

/**
 * Courses Controller
 * 
 * Provides endpoints for:
 * - POST /courses - Create new course (admin only)
 * - GET /courses - List courses with status filter
 * - GET /courses/:id - Get course details
 * - PATCH /courses/:id - Update course (admin only)
 * - DELETE /courses/:id - Soft delete course by archiving (admin only)
 * - POST /courses/:courseId/enroll - Enroll student in course
 * - GET /students/:studentId/enrollments - Get student's enrollments
 * - GET /courses/:courseId/enrollments - Get course enrollments (admin only)
 * - DELETE /enrollments/:id - Unenroll student from course
 * 
 * Note: Module management endpoints are handled by ModulesController
 * 
 * Requirements:
 * - R5: Course enrollment management
 * - R15: Course creation and management
 * - R16: Course publishing control
 * - R22: Course progress dashboard
 * 
 * Access Control:
 * - POST, PATCH, DELETE: ADMINISTRATOR role required
 * - GET /courses: Returns only PUBLISHED courses for students
 * - GET /courses/:id: All roles can access, but content visibility controlled by enrollment
 * - Enrollment: Students can enroll themselves, admins can enroll anyone
 */
@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly access: StaffAccessService,
  ) {}

  /**
   * Create a new course
   * 
   * POST /courses
   * 
   * Requirements:
   * - R15.1: Require title
   * - R15.2: Status defaults to DRAFT
   * - R15.9: Track creator user ID
   * 
   * Access: ADMINISTRATOR only
   */
  @Post()
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createCourseDto: CreateCourseDto, @Req() req: any) {
    return this.coursesService.create(createCourseDto, req.user.userId);
  }

  /**
   * List all courses with optional status filter
   * 
   * GET /courses?status=PUBLISHED&page=1&limit=10
   * 
   * Requirements:
   * - R16.2: PUBLISHED courses visible to enrolled students
   * - R16.3: DRAFT courses hidden from students
   * - R16.8: ARCHIVED courses excluded
   * 
   * Access: 
   * - Students see only PUBLISHED courses
   * - Admins see all courses based on filter
   */
  @Get()
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.STUDENT)
  findAll(@Query() query: QueryCourseDto, @Req() req: any) {
    // Students can only see published courses
    if (req.user.role === UserRole.STUDENT && !query.status) {
      query.status = CourseStatus.PUBLISHED;
    }
    return this.coursesService.findAll(query);
  }

  /**
   * Get single course with details
   * 
   * GET /courses/:id
   * 
   * Requirements:
   * - R15: Return course with modules
   * 
   * Access: All authenticated users
   * Note: Enrollment verification happens at content access level
   */
  @Get(':id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.STUDENT)
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  /**
   * Update course details
   * 
   * PATCH /courses/:id
   * 
   * Requirements:
   * - R15.6: Support updating all fields
   * - R16.1: Support publishing (status → PUBLISHED)
   * - R16.4: Support unpublishing (status → DRAFT)
   * - R16.7: Support archiving (status → ARCHIVED)
   * 
   * Access: ADMINISTRATOR only
   */
  @Patch(':id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto) {
    return this.coursesService.update(id, updateCourseDto);
  }

  /**
   * Delete a course (soft delete by archiving)
   * 
   * DELETE /courses/:id
   * 
   * Requirements:
   * - R16.7: Archive course instead of hard delete
   * - R16.6: Retain all student progress records
   * 
   * Access: ADMINISTRATOR only
   */
  @Delete(':id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.coursesService.remove(id);
  }

  /**
   * Enroll a student in a course
   * 
   * POST /courses/:courseId/enroll
   * 
   * Requirements:
   * - R5.1: Create enrollment with ACTIVE status
   * - R5.2: Prevent duplicate enrollments
   * - R5.3: Set progressPercentage to 0
   * - R5.8: Only allow enrollment in PUBLISHED courses
   * 
   * Authorization:
   * - Administrators can enroll any student
   * - Students can enroll themselves only
   * 
   * Access: ADMINISTRATOR, STUDENT
   */
  @Post(':courseId/enroll')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  async enrollStudent(
    @Param('courseId') courseId: string,
    @Body() enrollStudentDto: EnrollStudentDto,
    @Req() req: any,
  ) {
    // Students enrol themselves (checked in the service); staff need MANAGE_COURSES
    if (req.user.role === UserRole.STAFF) {
      await this.access.assertAny(req.user, [StaffPermissionType.MANAGE_COURSES]);
    }
    return this.coursesService.enrollStudent(
      courseId,
      enrollStudentDto,
      req.user.userId,
      req.user.role,
    );
  }

  /**
   * Get all enrollments for a course
   * 
   * GET /courses/:courseId/enrollments
   * 
   * Requirements:
   * - R5: List course enrollments for reporting
   * 
   * Access: ADMINISTRATOR, STAFF only
   */
  @Get(':courseId/enrollments')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF)
  getCourseEnrollments(
    @Param('courseId') courseId: string,
    @Query() query: QueryEnrollmentDto,
  ) {
    return this.coursesService.getCourseEnrollments(courseId, query);
  }

  /**
   * Get all enrollments for a student
   * 
   * GET /students/:studentId/enrollments
   * 
   * Requirements:
   * - R5.4: List student enrollments with current progress
   * - R22: Course progress dashboard
   * 
   * Access: ADMINISTRATOR, STAFF, STUDENT (students can only view their own)
   * 
   * Note: Authorization check for student data isolation is handled in service
   */
  @Get('/students/:studentId/enrollments')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.STUDENT)
  getStudentEnrollments(
    @Param('studentId') studentId: string,
    @Req() req: any,
  ) {
    // Students may only list their own enrolments (R2.5)
    if (req.user.role === UserRole.STUDENT && req.user.studentId !== studentId) {
      throw new ForbiddenException('Students can only view their own enrollments');
    }
    return this.coursesService.getStudentEnrollments(studentId);
  }

  /**
   * Unenroll a student from a course
   * 
   * DELETE /enrollments/:id
   * 
   * Requirements:
   * - R5.5: Set enrollment status to DROPPED
   * - R5.6: Retain enrollment record and progress history
   * 
   * Authorization:
   * - Administrators can unenroll any student
   * - Students can unenroll themselves only
   * 
   * Access: ADMINISTRATOR, STUDENT
   */
  @Delete('/enrollments/:id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.STUDENT)
  @HttpCode(HttpStatus.OK)
  async unenrollStudent(@Param('id') enrollmentId: string, @Req() req: any) {
    if (req.user.role === UserRole.STAFF) {
      await this.access.assertAny(req.user, [StaffPermissionType.MANAGE_COURSES]);
    }
    return this.coursesService.unenrollStudent(
      enrollmentId,
      req.user.userId,
      req.user.role,
    );
  }
}
