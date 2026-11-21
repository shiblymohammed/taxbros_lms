import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { daysInMonth, monthRange } from '../common/dates/institute-dates';
import { AttendanceStatus } from '@prisma/client';

/**
 * Monthly attendance statistics for a student or staff member
 */
export interface MonthlyAttendanceStats {
  id: string; // Student or Staff ID
  name: string;
  identifierId: string; // Admission ID or Staff ID
  presentCount: number;
  lateCount: number;
  absentCount: number;
  unmarkedCount: number;
  percentage: number | null; // null when no marked entries
  className?: string; // Only for students
  designation?: string; // Only for staff
  department?: string; // Only for staff
}

/**
 * Attendance Calculation Service
 * 
 * Provides monthly attendance calculation utilities for students and staff.
 * Implements the formula: 100 × (present + late) / (present + late + absent)
 * Excludes unmarked entries from calculation.
 */
@Injectable()
export class AttendanceCalculationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate monthly attendance for all students
   * 
   * @param year - Year (YYYY)
   * @param month - Month (1-12)
   * @param classId - Optional class filter
   * @returns Array of monthly attendance stats per student
   */
  async calculateMonthlyStudentAttendance(
    year: number,
    month: number,
    classId?: string,
  ): Promise<MonthlyAttendanceStats[]> {
    // Calendar month as UTC dates, matching the date-only attendance columns (R6.6)
    const { startDate, endDate } = monthRange(year, month);

    // Build where clause for attendance records
    const registerWhere: any = {
      attendanceDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (classId) {
      registerWhere.classId = classId;
    }

    // Get all attendance registers for the month
    const registers = await this.prisma.studentAttendanceRegister.findMany({
      where: registerWhere,
      include: {
        attendanceRecords: true,
        class: true,
      },
    });

    // Aggregate attendance by student
    const studentAttendanceMap = new Map<
      string,
      {
        studentId: string;
        classId: string;
        presentCount: number;
        lateCount: number;
        absentCount: number;
        unmarkedDates: Set<string>;
        totalDates: Set<string>;
      }
    >();

    for (const register of registers) {
      const rosterSnapshot = register.rosterSnapshot as string[];
      const dateStr = register.attendanceDate.toISOString().split('T')[0];

      for (const studentId of rosterSnapshot) {
        const key = `${studentId}-${register.classId}`;
        
        if (!studentAttendanceMap.has(key)) {
          studentAttendanceMap.set(key, {
            studentId,
            classId: register.classId,
            presentCount: 0,
            lateCount: 0,
            absentCount: 0,
            unmarkedDates: new Set(),
            totalDates: new Set(),
          });
        }

        const stats = studentAttendanceMap.get(key)!;
        stats.totalDates.add(dateStr);

        // Find attendance record for this student
        const attendance = register.attendanceRecords.find(
          (a) => a.studentId === studentId,
        );

        if (attendance) {
          // Marked entry
          switch (attendance.status) {
            case AttendanceStatus.PRESENT:
              stats.presentCount++;
              break;
            case AttendanceStatus.LATE:
              stats.lateCount++;
              break;
            case AttendanceStatus.ABSENT:
              stats.absentCount++;
              break;
          }
        } else {
          // Unmarked entry
          stats.unmarkedDates.add(dateStr);
        }
      }
    }

    // Convert to array and fetch student details
    const results: MonthlyAttendanceStats[] = [];

    for (const stats of studentAttendanceMap.values()) {
      const student = await this.prisma.student.findUnique({
        where: { id: stats.studentId },
        include: {
          classEnrollments: {
            where: {
              classId: stats.classId,
              status: 'ACTIVE',
            },
            include: {
              class: true,
            },
          },
        },
      });

      if (!student) continue;

      const unmarkedCount = stats.unmarkedDates.size;
      
      // Calculate percentage: exclude unmarked from denominator
      const denominator = stats.presentCount + stats.lateCount + stats.absentCount;
      const percentage = denominator > 0
        ? Math.round((100 * (stats.presentCount + stats.lateCount)) / denominator)
        : null;

      const classEnrollment = student.classEnrollments[0];
      const className = classEnrollment?.class.name || 'Unknown';

      results.push({
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        identifierId: student.admissionId,
        presentCount: stats.presentCount,
        lateCount: stats.lateCount,
        absentCount: stats.absentCount,
        unmarkedCount,
        percentage,
        className,
      });
    }

    return results;
  }

  /**
   * Calculate monthly attendance for a specific student
   * 
   * @param studentId - Student ID
   * @param year - Year (YYYY)
   * @param month - Month (1-12)
   * @param classId - Optional class filter
   * @returns Monthly attendance stats for the student
   */
  async calculateStudentMonthlyStats(
    studentId: string,
    year: number,
    month: number,
    classId?: string,
  ): Promise<MonthlyAttendanceStats | null> {
    const allStats = await this.calculateMonthlyStudentAttendance(
      year,
      month,
      classId,
    );

    return allStats.find((s) => s.id === studentId) || null;
  }

  /**
   * Calculate monthly attendance for all staff
   * 
   * @param year - Year (YYYY)
   * @param month - Month (1-12)
   * @param department - Optional department filter
   * @param category - Optional category filter (TEACHING, NON_TEACHING)
   * @returns Array of monthly attendance stats per staff member
   */
  async calculateMonthlyStaffAttendance(
    year: number,
    month: number,
    department?: string,
    category?: string,
  ): Promise<MonthlyAttendanceStats[]> {
    // Calendar month as UTC dates, matching the date-only attendance columns (R6.6)
    const { startDate, endDate } = monthRange(year, month);

    // Build where clause for staff filter
    const staffWhere: any = {
      user: {
        status: 'ACTIVE',
      },
    };

    if (department) {
      staffWhere.department = department;
    }

    if (category) {
      staffWhere.category = category;
    }

    // Get all staff matching filters
    const staffMembers = await this.prisma.staff.findMany({
      where: staffWhere,
      include: {
        attendanceRecords: {
          where: {
            attendanceDate: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
    });

    // Calculate stats for each staff member
    const results: MonthlyAttendanceStats[] = [];

    for (const staff of staffMembers) {
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;

      for (const record of staff.attendanceRecords) {
        switch (record.status) {
          case AttendanceStatus.PRESENT:
            presentCount++;
            break;
          case AttendanceStatus.LATE:
            lateCount++;
            break;
          case AttendanceStatus.ABSENT:
            absentCount++;
            break;
        }
      }

      // Calculate total days in month
      const totalDaysInMonth = endDate.getDate();
      const markedCount = presentCount + lateCount + absentCount;
      const unmarkedCount = totalDaysInMonth - markedCount;

      // Calculate percentage
      const denominator = presentCount + lateCount + absentCount;
      const percentage = denominator > 0
        ? Math.round((100 * (presentCount + lateCount)) / denominator)
        : null;

      results.push({
        id: staff.id,
        name: `${staff.firstName} ${staff.lastName}`,
        identifierId: staff.staffId,
        presentCount,
        lateCount,
        absentCount,
        unmarkedCount,
        percentage,
        designation: staff.designation,
        department: staff.department,
      });
    }

    return results;
  }

  /**
   * Calculate monthly attendance for a specific staff member
   * 
   * @param staffId - Staff ID
   * @param year - Year (YYYY)
   * @param month - Month (1-12)
   * @returns Monthly attendance stats for the staff member
   */
  async calculateStaffMonthlyStats(
    staffId: string,
    year: number,
    month: number,
  ): Promise<MonthlyAttendanceStats | null> {
    const allStats = await this.calculateMonthlyStaffAttendance(year, month);
    return allStats.find((s) => s.id === staffId) || null;
  }

  /**
   * Helper method to get working days count in a month
   * This is a simplified version - can be extended to exclude weekends/holidays
   * 
   * @param year - Year (YYYY)
   * @param month - Month (1-12)
   * @returns Number of days in the month
   */
  private getWorkingDaysInMonth(year: number, month: number): number {
    return daysInMonth(year, month);
  }
}
