import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { AttendanceCalculationService } from './attendance-calculation.service';
import { OpenRegisterDto } from './dto/open-register.dto';
import { MarkStudentAttendanceDto } from './dto/mark-student-attendance.dto';
import { MarkStaffAttendanceDto } from './dto/mark-staff-attendance.dto';
import { GetStaffAttendanceQueryDto } from './dto/get-staff-attendance-query.dto';
import {
  GetMonthlyStudentAttendanceDto,
  GetMonthlyStaffAttendanceDto,
} from './dto/get-monthly-attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { StaffPermissionType } from '@prisma/client';
import { UserRole } from '@prisma/client';

/**
 * Attendance Controller
 * 
 * Manages student and staff attendance operations
 * 
 * Student Attendance Endpoints:
 * - POST /attendance/student/registers - Open or retrieve attendance register
 * - POST /attendance/student/registers/:id/mark - Mark student attendance
 * 
 * Staff Attendance Endpoints:
 * - POST /attendance/staff - Mark staff attendance
 * - GET /attendance/staff - Get staff attendance records with filters
 * - GET /attendance/staff/:staffId - Get attendance for specific staff member
 */
@ApiTags('Attendance')
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly calculationService: AttendanceCalculationService,
  ) {}

  /**
   * Open or retrieve student attendance register
   * 
   * Requires: ADMINISTRATOR or STAFF role
   * Body: { classId, attendanceDate }
   * 
   * Creates new register with frozen roster if not exists
   * Returns existing register with attendance records if exists
   */
  @Post('student/registers')
  @Roles(UserRole.ADMINISTRATOR, UserRole.STAFF)
  @UseGuards(PermissionsGuard)
  @RequirePermission(StaffPermissionType.MARK_ATTENDANCE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Open or retrieve attendance register',
    description:
      'Creates a new attendance register with frozen roster snapshot if none exists for the class and date. ' +
      'Returns existing register if already created. Frozen roster captures all ACTIVE students at creation time.',
  })
  @ApiBody({ type: OpenRegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Register opened or retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid date format',
  })
  @ApiResponse({
    status: 404,
    description: 'Class not found',
  })
  async openRegister(@Body() dto: OpenRegisterDto) {
    return this.attendanceService.openRegister(dto);
  }

  /**
   * Mark student attendance
   * 
   * Requires: ADMINISTRATOR or STAFF role
   * Body: { marks: [{ studentId, status, remarks? }] }
   * 
   * Upserts attendance records for students in register
   * Updates register status from DRAFT to SAVED
   * Allows corrections by updating existing records
   */
  @Post('student/registers/:id/mark')
  @Roles(UserRole.ADMINISTRATOR, UserRole.STAFF)
  @UseGuards(PermissionsGuard)
  @RequirePermission(StaffPermissionType.MARK_ATTENDANCE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark or correct student attendance',
    description:
      'Marks or corrects attendance for students in the register. Accepts an array of marks with studentId, status (PRESENT/ABSENT/LATE), and optional remarks. ' +
      'Upserts records to prevent duplicates. Updates register status to SAVED on first mark. ' +
      'Supports corrections by updating existing records with new status and remarks. ' +
      'Records audit trail with markedBy user ID and markedAt timestamp.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the attendance register',
    type: 'string',
  })
  @ApiBody({ type: MarkStudentAttendanceDto })
  @ApiResponse({
    status: 200,
    description: 'Attendance marked successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Student not in register roster or invalid data',
  })
  @ApiResponse({
    status: 404,
    description: 'Register not found',
  })
  async markStudentAttendance(
    @Param('id') registerId: string,
    @Body() dto: MarkStudentAttendanceDto,
    @Request() req: any,
  ) {
    return this.attendanceService.markStudentAttendance(
      registerId,
      dto,
      req.user.userId,
    );
  }


  /**
   * Mark staff attendance
   * 
   * Requires: ADMINISTRATOR role or MARK_ATTENDANCE permission
   * Body: { staffId, attendanceDate, status, remarks? }
   * 
   * Upserts attendance record based on (staffId, attendanceDate)
   * Allows corrections by updating existing records
   */
  @Post('staff')
  @Roles(UserRole.ADMINISTRATOR, UserRole.STAFF)
  @UseGuards(PermissionsGuard)
  @RequirePermission(StaffPermissionType.MARK_ATTENDANCE)
  @HttpCode(HttpStatus.CREATED)
  async markStaffAttendance(
    @Body() dto: MarkStaffAttendanceDto,
    @Request() req: any,
  ) {
    return this.attendanceService.markStaffAttendance(dto, req.user.userId);
  }

  /**
   * Get staff attendance records with filtering
   * 
   * Requires: ADMINISTRATOR role
   * Query params: dateFrom, dateTo, status, staffId
   * 
   * Returns attendance records ordered by date descending
   */
  @Get('staff')
  @Roles(UserRole.ADMINISTRATOR)
  async getStaffAttendance(@Query() query: GetStaffAttendanceQueryDto) {
    return this.attendanceService.getStaffAttendance(query);
  }

  /**
   * Get attendance for a specific staff member
   * 
   * Requires: ADMINISTRATOR role or the staff member themselves
   * Query params: dateFrom, dateTo
   * 
   * Returns attendance records for the specified staff member
   */
  @Get('staff/:staffId')
  @Roles(UserRole.ADMINISTRATOR, UserRole.STAFF)
  async getStaffMemberAttendance(
    @Param('staffId') staffId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Request() req?: any,
  ) {
    // Staff members can only view their own attendance
    if (req.user.role === UserRole.STAFF) {
      const staff = await this.attendanceService['prisma'].staff.findUnique({
        where: { userId: req.user.userId },
      });
      
      if (!staff || staff.id !== staffId) {
        throw new Error('Staff members can only view their own attendance');
      }
    }

    return this.attendanceService.getStaffMemberAttendance(
      staffId,
      dateFrom,
      dateTo,
    );
  }

  /**
   * Get monthly student attendance report
   * 
   * Requires: ADMINISTRATOR or STAFF role
   * Query params: year, month, classId (optional)
   * 
   * Returns monthly attendance statistics for all students
   * Calculates percentage as: 100 × (present + late) / (present + late + absent)
   * Excludes unmarked entries from calculation
   */
  @Get('reports/student/monthly')
  @Roles(UserRole.ADMINISTRATOR, UserRole.STAFF)
  @UseGuards(PermissionsGuard)
  @RequirePermission(StaffPermissionType.VIEW_REPORTS)
  @ApiOperation({
    summary: 'Generate monthly student attendance report',
    description:
      'Generates monthly attendance statistics for students. ' +
      'Returns present, late, absent, and unmarked counts with calculated percentage. ' +
      'Formula: 100 × (present + late) / (present + late + absent). ' +
      'Unmarked entries are excluded from percentage calculation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Monthly report generated successfully',
  })
  async getMonthlyStudentAttendance(
    @Query() query: GetMonthlyStudentAttendanceDto,
  ) {
    return this.calculationService.calculateMonthlyStudentAttendance(
      query.year,
      query.month,
      query.classId,
    );
  }

  /**
   * Get monthly staff attendance report
   * 
   * Requires: ADMINISTRATOR role
   * Query params: year, month, department (optional), category (optional)
   * 
   * Returns monthly attendance statistics for all staff
   * Calculates percentage using same formula as student attendance
   */
  @Get('reports/staff/monthly')
  @Roles(UserRole.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Generate monthly staff attendance report',
    description:
      'Generates monthly attendance statistics for staff members. ' +
      'Returns present, late, absent, and unmarked counts with calculated percentage. ' +
      'Supports filtering by department and category (TEACHING/NON_TEACHING).',
  })
  @ApiResponse({
    status: 200,
    description: 'Monthly report generated successfully',
  })
  async getMonthlyStaffAttendance(
    @Query() query: GetMonthlyStaffAttendanceDto,
  ) {
    return this.calculationService.calculateMonthlyStaffAttendance(
      query.year,
      query.month,
      query.department,
      query.category,
    );
  }
}
