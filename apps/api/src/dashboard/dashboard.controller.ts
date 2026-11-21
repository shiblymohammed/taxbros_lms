import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * Dashboard Controller
 * 
 * Provides aggregated dashboard data for administrators
 * including user statistics, attendance summaries, and recent activity
 */
@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Get administrator dashboard data
   * 
   * Requires: ADMINISTRATOR or SUPER_ADMIN role
   * 
   * Returns:
   * - User counts (total users, active students, active staff, admins)
   * - Today's attendance summary (students and staff)
   * - Recent attendance register activity
   * 
   * Validates Requirements: R1 (User management), R7 (Attendance tracking)
   */
  @Get('admin')
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get administrator dashboard data',
    description:
      'Returns aggregated data for the administrator dashboard including user counts, ' +
      "today's attendance summary for students and staff, and recent attendance register activity. " +
      'Only accessible to administrators.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        userCounts: {
          type: 'object',
          properties: {
            totalUsers: { type: 'number', example: 150 },
            activeStudents: { type: 'number', example: 120 },
            activeStaff: { type: 'number', example: 25 },
            totalAdmins: { type: 'number', example: 5 },
          },
        },
        todayAttendance: {
          type: 'object',
          properties: {
            date: { type: 'string', example: '2024-11-18' },
            students: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 120 },
                marked: { type: 'number', example: 118 },
                present: { type: 'number', example: 110 },
                absent: { type: 'number', example: 5 },
                late: { type: 'number', example: 3 },
                unmarked: { type: 'number', example: 2 },
              },
            },
            staff: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 25 },
                marked: { type: 'number', example: 24 },
                present: { type: 'number', example: 22 },
                absent: { type: 'number', example: 1 },
                late: { type: 'number', example: 1 },
                unmarked: { type: 'number', example: 1 },
              },
            },
          },
        },
        recentActivity: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              date: { type: 'string', example: '2024-11-18' },
              className: { type: 'string', example: 'Class A' },
              classId: { type: 'string' },
              status: { type: 'string', example: 'SAVED' },
              totalStudents: { type: 'number', example: 30 },
              markedStudents: { type: 'number', example: 29 },
              presentCount: { type: 'number', example: 27 },
              absentCount: { type: 'number', example: 1 },
              lateCount: { type: 'number', example: 1 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async getAdminDashboard() {
    return this.dashboardService.getAdminDashboard();
  }
}
