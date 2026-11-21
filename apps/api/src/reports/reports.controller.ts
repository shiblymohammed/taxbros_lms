import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { MonthlyStudentAttendanceQueryDto } from './dto/monthly-student-attendance-query.dto';
import { MonthlyStaffAttendanceQueryDto } from './dto/monthly-staff-attendance-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { StaffPermissionType } from '@prisma/client';
import { UserRole, AttendanceStatus } from '@prisma/client';
import { UnauthorizedException } from '@nestjs/common';

/**
 * Reports Controller
 * 
 * Manages attendance report generation and history retrieval
 * 
 * Student Reports:
 * - GET /reports/attendance/student/monthly - Monthly attendance report
 * - GET /reports/attendance/student/:studentId/history - Student attendance history
 * 
 * Staff Reports:
 * - GET /reports/attendance/staff/monthly - Monthly staff attendance report
 * - GET /reports/attendance/staff/:staffId/history - Staff attendance history
 */
@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Get monthly student attendance report
   * 
   * Requires: ADMINISTRATOR role or STAFF with VIEW_REPORTS permission
   * Query params: year, month, optional classId
   * 
   * Returns attendance summary for all students or filtered by class
   * Includes: student name, admission ID, class, present/late/absent counts, percentage
   * 
   * Percentage calculation: 100 × (present + late) / (present + late + absent)
   * Excludes unmarked entries from denominator
   */
  @Get('attendance/student/monthly')
  @Roles(UserRole.ADMINISTRATOR, UserRole.STAFF)
  @UseGuards(PermissionsGuard)
  @RequirePermission(StaffPermissionType.VIEW_REPORTS)
  @ApiOperation({
    summary: 'Get monthly student attendance report',
    description:
      'Generates a monthly attendance report for all students or filtered by class. ' +
      'Returns student name, admission ID, class name, present/late/absent/unmarked counts, and percentage. ' +
      'Percentage = 100 × (present + late) / (present + late + absent). ' +
      'Unmarked entries are excluded from percentage calculation. ' +
      'Handles mid-month enrollments by counting only from enrollment date forward.',
  })
  @ApiQuery({
    name: 'year',
    description: 'Year (YYYY format)',
    example: 2024,
    type: Number,
  })
  @ApiQuery({
    name: 'month',
    description: 'Month (1-12)',
    example: 11,
    type: Number,
  })
  @ApiQuery({
    name: 'classId',
    description: 'Optional class ID to filter by specific class',
    example: 'class-uuid-here',
    required: false,
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Monthly report generated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid month or year',
  })
  @ApiResponse({
    status: 404,
    description: 'Class not found (if classId provided)',
  })
  async getMonthlyStudentAttendanceReport(
    @Query() query: MonthlyStudentAttendanceQueryDto,
  ) {
    return this.reportsService.getMonthlyStudentAttendanceReport(query);
  }

  /**
   * Get attendance history for a specific student
   * 
   * Requires: ADMINISTRATOR, STAFF, or the student themselves
   * Query params: dateFrom, dateTo, classId, status (optional filters)
   * 
   * Returns attendance records ordered by date descending
   * Students can only view their own records
   * Administrators and staff can view any student's records
   */
  @Get('attendance/student/:studentId/history')
  @Roles(UserRole.ADMINISTRATOR, UserRole.STAFF, UserRole.STUDENT)
  @ApiOperation({
    summary: 'Get attendance history for a specific student',
    description:
      'Retrieves attendance history for a student with optional filtering by date range, class, and status. ' +
      'Students can only view their own records. ' +
      'Administrators and staff can view any student\'s records. ' +
      'Returns records ordered by date descending.',
  })
  @ApiParam({
    name: 'studentId',
    description: 'Student ID',
    example: 'student-uuid-here',
    type: String,
  })
  @ApiQuery({
    name: 'dateFrom',
    description: 'Start date (YYYY-MM-DD)',
    example: '2024-11-01',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'dateTo',
    description: 'End date (YYYY-MM-DD)',
    example: '2024-11-30',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'classId',
    description: 'Optional class ID filter',
    example: 'class-uuid-here',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'status',
    description: 'Optional status filter (PRESENT, ABSENT, LATE)',
    example: 'PRESENT',
    required: false,
    enum: AttendanceStatus,
  })
  @ApiResponse({
    status: 200,
    description: 'Attendance history retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Students can only view their own attendance',
  })
  @ApiResponse({
    status: 404,
    description: 'Student not found',
  })
  async getStudentAttendanceHistory(
    @Param('studentId') studentId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('classId') classId?: string,
    @Query('status') status?: AttendanceStatus,
    @Request() req?: any,
  ) {
    // If the user is a student, enforce data isolation
    if (req.user.role === UserRole.STUDENT) {
      // Get the student profile for the authenticated user
      const student = await this.reportsService['prisma'].student.findUnique({
        where: { userId: req.user.userId },
      });

      // Verify the student is requesting their own records
      if (!student || student.id !== studentId) {
        throw new UnauthorizedException(
          'Students can only view their own attendance records',
        );
      }
    }

    return this.reportsService.getStudentAttendanceHistory(studentId, {
      dateFrom,
      dateTo,
      classId,
      status,
    });
  }

  /**
   * Get monthly staff attendance report
   * 
   * Requires: ADMINISTRATOR role or STAFF with VIEW_REPORTS permission
   * Query params: year, month, optional department, optional category
   * 
   * Returns attendance summary for all staff or filtered by department/category
   * Includes: staff name, staff ID, designation, department, present/late/absent counts, percentage
   * 
   * Percentage calculation: 100 × (present + late) / (present + late + absent)
   */
  @Get('attendance/staff/monthly')
  @Roles(UserRole.ADMINISTRATOR, UserRole.STAFF)
  @UseGuards(PermissionsGuard)
  @RequirePermission(StaffPermissionType.VIEW_REPORTS)
  @ApiOperation({
    summary: 'Get monthly staff attendance report',
    description:
      'Generates a monthly attendance report for all staff or filtered by department and category. ' +
      'Returns staff name, staff ID, designation, department, present/late/absent counts, and percentage. ' +
      'Percentage = 100 × (present + late) / (present + late + absent). ' +
      'Supports filtering by department and category (TEACHING/NON_TEACHING).',
  })
  @ApiQuery({
    name: 'year',
    description: 'Year (YYYY format)',
    example: 2024,
    type: Number,
  })
  @ApiQuery({
    name: 'month',
    description: 'Month (1-12)',
    example: 11,
    type: Number,
  })
  @ApiQuery({
    name: 'department',
    description: 'Optional department filter',
    example: 'Mathematics',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'category',
    description: 'Optional category filter (TEACHING or NON_TEACHING)',
    example: 'TEACHING',
    required: false,
    enum: ['TEACHING', 'NON_TEACHING'],
  })
  @ApiResponse({
    status: 200,
    description: 'Monthly report generated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid month or year',
  })
  async getMonthlyStaffAttendanceReport(
    @Query() query: MonthlyStaffAttendanceQueryDto,
  ) {
    return this.reportsService.getMonthlyStaffAttendanceReport(query);
  }

  /**
   * Get attendance history for a specific staff member
   * 
   * Requires: ADMINISTRATOR, or the staff member themselves
   * Query params: dateFrom, dateTo (optional filters)
   * 
   * Returns attendance records ordered by date descending
   * Staff members can only view their own records
   * Administrators can view any staff member's records
   */
  @Get('attendance/staff/:staffId/history')
  @Roles(UserRole.ADMINISTRATOR, UserRole.STAFF)
  @ApiOperation({
    summary: 'Get attendance history for a specific staff member',
    description:
      'Retrieves attendance history for a staff member with optional filtering by date range. ' +
      'Staff members can only view their own records. ' +
      'Administrators can view any staff member\'s records. ' +
      'Returns records ordered by date descending.',
  })
  @ApiParam({
    name: 'staffId',
    description: 'Staff ID',
    example: 'staff-uuid-here',
    type: String,
  })
  @ApiQuery({
    name: 'dateFrom',
    description: 'Start date (YYYY-MM-DD)',
    example: '2024-11-01',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'dateTo',
    description: 'End date (YYYY-MM-DD)',
    example: '2024-11-30',
    required: false,
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Attendance history retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Staff members can only view their own attendance',
  })
  @ApiResponse({
    status: 404,
    description: 'Staff member not found',
  })
  async getStaffAttendanceHistory(
    @Param('staffId') staffId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Request() req?: any,
  ) {
    // If the user is a staff member, enforce data isolation
    if (req.user.role === UserRole.STAFF) {
      // Get the staff profile for the authenticated user
      const staff = await this.reportsService['prisma'].staff.findUnique({
        where: { userId: req.user.userId },
      });

      // Verify the staff member is requesting their own records
      if (!staff || staff.id !== staffId) {
        throw new UnauthorizedException(
          'Staff members can only view their own attendance records',
        );
      }
    }

    return this.reportsService.getStaffAttendanceHistory(staffId, {
      dateFrom,
      dateTo,
    });
  }
}
