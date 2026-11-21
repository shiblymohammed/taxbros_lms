/**
 * PermissionsGuard Integration Example
 * 
 * This file demonstrates how to integrate the PermissionsGuard
 * with attendance and management endpoints as required by Task 11.
 * 
 * DO NOT COMPILE THIS FILE - IT'S FOR REFERENCE ONLY
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, PermissionsGuard } from './guards';
import { Roles, RequirePermission, CurrentUser } from './decorators';
import { UserRole, StaffPermissionType } from '@prisma/client';
import { CurrentUserPayload } from './decorators/current-user.decorator';

// ============================================================================
// EXAMPLE 1: Attendance Management Controller
// ============================================================================

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AttendanceController {
  /**
   * Open attendance register for a class
   * 
   * Requirements:
   * - R7: Student attendance register management
   * - R3: MARK_ATTENDANCE permission required
   * 
   * Access:
   * - ADMINISTRATOR: Automatic bypass
   * - STAFF: Requires MARK_ATTENDANCE permission
   */
  @Post('registers')
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @RequirePermission(StaffPermissionType.MARK_ATTENDANCE)
  async openRegister(
    @Body() dto: { classId: string; attendanceDate: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    // Implementation would go here
    return {
      message: 'Register opened',
      markedBy: user.userId,
    };
  }

  /**
   * Mark student attendance
   * 
   * Requirements:
   * - R8: Student attendance marking
   * - R3: MARK_ATTENDANCE permission required
   * 
   * Access:
   * - ADMINISTRATOR: Automatic bypass
   * - STAFF: Requires MARK_ATTENDANCE permission
   */
  @Post('registers/:id/mark')
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @RequirePermission(StaffPermissionType.MARK_ATTENDANCE)
  async markAttendance(
    @Param('id') registerId: string,
    @Body() dto: { studentId: string; status: string; remarks?: string }[],
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return {
      message: 'Attendance marked',
      markedBy: user.userId,
      count: dto.length,
    };
  }

  /**
   * Mark staff attendance
   * 
   * Requirements:
   * - R12: Staff attendance management
   * - R3: MARK_ATTENDANCE permission required
   */
  @Post('staff')
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @RequirePermission(StaffPermissionType.MARK_ATTENDANCE)
  async markStaffAttendance(
    @Body() dto: { staffId: string; attendanceDate: string; status: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return {
      message: 'Staff attendance marked',
      markedBy: user.userId,
    };
  }
}

// ============================================================================
// EXAMPLE 2: Reports Controller
// ============================================================================

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ReportsController {
  /**
   * Generate monthly attendance report
   * 
   * Requirements:
   * - R11: Monthly student attendance calculation
   * - R3: VIEW_REPORTS permission required
   * 
   * Access:
   * - ADMINISTRATOR: Automatic bypass
   * - STAFF: Requires VIEW_REPORTS permission
   */
  @Get('attendance/monthly')
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @RequirePermission(StaffPermissionType.VIEW_REPORTS)
  async getMonthlyReport(
    @Query() query: { year: number; month: number; classId?: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return {
      message: 'Monthly report generated',
      requestedBy: user.userId,
      filters: query,
    };
  }

  /**
   * Generate staff attendance report
   * 
   * Requirements:
   * - R14: Staff attendance reports
   * - R3: VIEW_REPORTS permission required
   */
  @Get('attendance/staff/monthly')
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @RequirePermission(StaffPermissionType.VIEW_REPORTS)
  async getStaffMonthlyReport(
    @Query() query: { year: number; month: number; department?: string },
  ) {
    return {
      message: 'Staff monthly report generated',
      filters: query,
    };
  }
}

// ============================================================================
// EXAMPLE 3: Course Management Controller
// ============================================================================

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CoursesController {
  /**
   * Create a new course
   * 
   * Requirements:
   * - R15: Course creation and management
   * - R3: MANAGE_COURSES permission required
   */
  @Post()
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  async createCourse(
    @Body() dto: { title: string; description?: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return {
      message: 'Course created',
      createdBy: user.userId,
    };
  }

  /**
   * Update course
   * 
   * Requirements:
   * - R15: Course management
   * - R3: MANAGE_COURSES permission required
   */
  @Patch(':id')
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  async updateCourse(
    @Param('id') id: string,
    @Body() _dto: { title?: string; description?: string },
  ) {
    return {
      message: 'Course updated',
      courseId: id,
    };
  }

  /**
   * Delete course
   * 
   * Requirements:
   * - R15: Course management
   * - R3: MANAGE_COURSES permission required
   */
  @Delete(':id')
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  async deleteCourse(@Param('id') id: string) {
    return {
      message: 'Course deleted',
      courseId: id,
    };
  }

  /**
   * View courses (no permission required)
   * 
   * Note: GET operations typically don't require MANAGE_COURSES permission
   * Staff can view courses without needing the manage permission
   */
  @Get()
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR, UserRole.STUDENT)
  async listCourses() {
    return {
      message: 'Course list',
      courses: [],
    };
  }
}

// ============================================================================
// EXAMPLE 4: Student Management Controller
// ============================================================================

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class StudentsController {
  /**
   * Create student
   * 
   * Requirements:
   * - R1: User account management
   * - R3: MANAGE_STUDENTS permission required
   */
  @Post()
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @RequirePermission(StaffPermissionType.MANAGE_STUDENTS)
  async createStudent(
    @Body() _dto: { email: string; admissionId: string; firstName: string },
  ) {
    return {
      message: 'Student created',
    };
  }

  /**
   * Update student profile
   * 
   * Requirements:
   * - R1: User account management
   * - R3: MANAGE_STUDENTS permission required
   */
  @Patch(':id')
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @RequirePermission(StaffPermissionType.MANAGE_STUDENTS)
  async updateStudent(
    @Param('id') id: string,
    @Body() _dto: { firstName?: string; lastName?: string },
  ) {
    return {
      message: 'Student updated',
      studentId: id,
    };
  }

  /**
   * View students (no permission required for viewing)
   */
  @Get()
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  async listStudents() {
    return {
      message: 'Student list',
      students: [],
    };
  }
}

// ============================================================================
// EXAMPLE 5: Class Management Controller
// ============================================================================

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ClassesControllerExample {
  /**
   * Create class (Administrator only - no permission decorator needed)
   * 
   * Requirements:
   * - R4: Class management
   * 
   * Note: When only ADMINISTRATOR role is allowed, no permission check needed
   * The RolesGuard handles this case
   */
  @Post()
  @Roles(UserRole.ADMINISTRATOR)
  async createClass(@Body() _dto: { name: string; description?: string }) {
    return {
      message: 'Class created',
    };
  }

  /**
   * View classes (no permission required for viewing)
   */
  @Get()
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  async listClasses() {
    return {
      message: 'Class list',
      classes: [],
    };
  }
}

// ============================================================================
// EXAMPLE 6: Lab Management Controller
// ============================================================================

@Controller('labs')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class LabsController {
  /**
   * Update lab sample data
   * 
   * Requirements:
   * - R27, R28, R29, R30: Lab simulations
   * - R3: MANAGE_LABS permission required
   */
  @Patch(':type/sample-data')
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @RequirePermission(StaffPermissionType.MANAGE_LABS)
  async updateSampleData(
    @Param('type') type: string,
    @Body() _dto: { sampleData: any },
  ) {
    return {
      message: 'Sample data updated',
      labType: type,
    };
  }

  /**
   * View labs (no permission required for viewing)
   */
  @Get()
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR, UserRole.STUDENT)
  async listLabs() {
    return {
      message: 'Lab list',
      labs: [],
    };
  }
}

// ============================================================================
// KEY POINTS FOR INTEGRATION
// ============================================================================

/**
 * 1. GUARD CHAIN ORDER (CRITICAL):
 *    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
 *    
 *    - JwtAuthGuard: Authenticates user, populates request.user
 *    - RolesGuard: Checks user has appropriate role
 *    - PermissionsGuard: Checks staff has specific permission
 * 
 * 2. DECORATOR COMBINATION:
 *    @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
 *    @RequirePermission(StaffPermissionType.MARK_ATTENDANCE)
 *    
 *    - @Roles ensures only STAFF or ADMINISTRATOR can access
 *    - @RequirePermission adds fine-grained check for STAFF users
 *    - ADMINISTRATOR automatically bypasses permission check
 * 
 * 3. WHEN TO USE PERMISSIONS:
 *    - Use for write operations (POST, PATCH, DELETE)
 *    - Use for sensitive read operations (reports)
 *    - Skip for general viewing (GET lists)
 * 
 * 4. PERMISSION TYPES:
 *    - MARK_ATTENDANCE: Attendance operations
 *    - VIEW_REPORTS: Report generation
 *    - MANAGE_COURSES: Course CRUD operations
 *    - MANAGE_LABS: Lab management
 *    - MANAGE_STUDENTS: User management
 * 
 * 5. ERROR HANDLING:
 *    - 403 Forbidden if permission missing
 *    - Clear error messages for debugging
 *    - No permission leak (generic messages)
 * 
 * 6. TESTING:
 *    - Test with ADMINISTRATOR (should bypass)
 *    - Test with STAFF having permission (should allow)
 *    - Test with STAFF lacking permission (should deny)
 *    - Test with STUDENT (should deny)
 */

// ============================================================================
// GRANTING PERMISSIONS (For reference)
// ============================================================================

/**
 * To grant a permission to a staff member:
 * 
 * await prisma.staffPermission.create({
 *   data: {
 *     staffId: 'staff-id',
 *     permission: StaffPermissionType.MARK_ATTENDANCE,
 *     grantedBy: currentUserId,
 *   },
 * });
 * 
 * To revoke a permission:
 * 
 * await prisma.staffPermission.delete({
 *   where: {
 *     staffId_permission: {
 *       staffId: 'staff-id',
 *       permission: StaffPermissionType.MARK_ATTENDANCE,
 *     },
 *   },
 * });
 */
