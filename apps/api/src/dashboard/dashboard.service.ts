import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { UserRole, UserStatus, AttendanceStatus } from '@prisma/client';

/**
 * Dashboard Service
 * 
 * Provides aggregated data for administrator and staff dashboards
 * including user counts, attendance summaries, and recent activity
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Get administrator dashboard data
   * 
   * Returns:
   * - Total user counts by role
   * - Active student and staff counts
   * - Today's attendance summary
   * - Recent attendance registers
   */
  async getAdminDashboard() {
    // Today in the institute timezone, not UTC (R6.6): before 05:30 IST, UTC is still yesterday
    const todayString = await this.settings.today();
    const todayDate = new Date(todayString + 'T00:00:00.000Z');

    // Get total user counts
    const totalUsers = await this.prisma.user.count();
    
    const activeStudents = await this.prisma.student.count({
      where: {
        user: {
          status: UserStatus.ACTIVE,
        },
      },
    });

    const activeStaff = await this.prisma.staff.count({
      where: {
        user: {
          status: UserStatus.ACTIVE,
        },
      },
    });

    const totalAdmins = await this.prisma.user.count({
      where: {
        role: {
          in: [UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN],
        },
        status: UserStatus.ACTIVE,
      },
    });

    // Get today's student attendance summary
    const todayStudentRegisters = await this.prisma.studentAttendanceRegister.findMany({
      where: {
        attendanceDate: todayDate,
      },
      include: {
        attendanceRecords: true,
        class: true,
      },
    });

    let todayStudentPresent = 0;
    let todayStudentAbsent = 0;
    let todayStudentLate = 0;
    let todayStudentMarked = 0;
    let todayStudentTotal = 0;

    todayStudentRegisters.forEach((register) => {
      const rosterCount = (register.rosterSnapshot as string[])?.length || 0;
      todayStudentTotal += rosterCount;

      register.attendanceRecords.forEach((attendance) => {
        if (attendance.status) {
          todayStudentMarked++;
          if (attendance.status === AttendanceStatus.PRESENT) {
            todayStudentPresent++;
          } else if (attendance.status === AttendanceStatus.ABSENT) {
            todayStudentAbsent++;
          } else if (attendance.status === AttendanceStatus.LATE) {
            todayStudentLate++;
          }
        }
      });
    });

    // Get today's staff attendance summary
    const todayStaffAttendance = await this.prisma.staffAttendance.findMany({
      where: {
        attendanceDate: todayDate,
      },
    });

    let todayStaffPresent = 0;
    let todayStaffAbsent = 0;
    let todayStaffLate = 0;

    todayStaffAttendance.forEach((attendance) => {
      if (attendance.status === AttendanceStatus.PRESENT) {
        todayStaffPresent++;
      } else if (attendance.status === AttendanceStatus.ABSENT) {
        todayStaffAbsent++;
      } else if (attendance.status === AttendanceStatus.LATE) {
        todayStaffLate++;
      }
    });

    // Get recent attendance registers (last 10)
    const recentRegisters = await this.prisma.studentAttendanceRegister.findMany({
      take: 10,
      orderBy: {
        attendanceDate: 'desc',
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        attendanceRecords: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    const recentActivity = recentRegisters.map((register) => {
      const rosterCount = (register.rosterSnapshot as string[])?.length || 0;
      const markedCount = register.attendanceRecords.filter((a) => a.status !== null).length;
      const presentCount = register.attendanceRecords.filter(
        (a) => a.status === AttendanceStatus.PRESENT,
      ).length;
      const absentCount = register.attendanceRecords.filter(
        (a) => a.status === AttendanceStatus.ABSENT,
      ).length;
      const lateCount = register.attendanceRecords.filter(
        (a) => a.status === AttendanceStatus.LATE,
      ).length;

      return {
        id: register.id,
        date: register.attendanceDate,
        className: register.class.name,
        classId: register.class.id,
        status: register.status,
        totalStudents: rosterCount,
        markedStudents: markedCount,
        presentCount,
        absentCount,
        lateCount,
      };
    });

    return {
      userCounts: {
        totalUsers,
        activeStudents,
        activeStaff,
        totalAdmins,
      },
      todayAttendance: {
        date: todayString,
        students: {
          total: todayStudentTotal,
          marked: todayStudentMarked,
          present: todayStudentPresent,
          absent: todayStudentAbsent,
          late: todayStudentLate,
          unmarked: todayStudentTotal - todayStudentMarked,
        },
        staff: {
          total: activeStaff,
          marked: todayStaffAttendance.length,
          present: todayStaffPresent,
          absent: todayStaffAbsent,
          late: todayStaffLate,
          unmarked: activeStaff - todayStaffAttendance.length,
        },
      },
      recentActivity,
    };
  }
}
