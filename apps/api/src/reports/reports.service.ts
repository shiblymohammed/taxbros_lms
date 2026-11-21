import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MonthlyStudentAttendanceQueryDto } from './dto/monthly-student-attendance-query.dto';
import { MonthlyStaffAttendanceQueryDto } from './dto/monthly-staff-attendance-query.dto';
import { monthRange } from '../common/dates/institute-dates';
import { AttendanceStatus } from '@prisma/client';

/**
 * Reports Service
 * 
 * Handles attendance report generation:
 * - Monthly student attendance reports
 * - Monthly staff attendance reports
 * - Attendance calculations and percentages
 */
@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate monthly attendance for a student
   * 
   * Formula: 100 × (present + late) / (present + late + absent)
   * Excludes unmarked entries from the denominator
   * 
   * @param studentId - Student ID
   * @param year - Year
   * @param month - Month (1-12)
   * @param classId - Optional class ID filter
   * @returns Attendance counts and percentage
   */
  private async calculateMonthlyAttendance(
    studentId: string,
    year: number,
    month: number,
    classId?: string,
  ) {
    // Calendar month as UTC dates, matching the date-only attendance columns (R6.6)
    const { startDate, endDate } = monthRange(year, month);

    // Build where clause
    const where: any = {
      studentId: studentId,
      register: {
        attendanceDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    };

    // Add class filter if provided
    if (classId) {
      where.register.classId = classId;
    }

    // Get all attendance records for the student in the specified month
    const attendanceRecords = await this.prisma.studentAttendance.findMany({
      where,
      include: {
        register: {
          include: {
            class: true,
          },
        },
      },
    });

    // Initialize counts
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let unmarkedCount = 0;

    // Count attendance by status
    for (const record of attendanceRecords) {
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
        default:
          unmarkedCount++;
      }
    }

    // Calculate percentage: 100 × (present + late) / (present + late + absent)
    // Exclude unmarked entries from denominator
    const denominator = presentCount + lateCount + absentCount;
    const percentage =
      denominator > 0
        ? Math.round((100 * (presentCount + lateCount)) / denominator * 100) / 100
        : null;

    return {
      presentCount,
      lateCount,
      absentCount,
      unmarkedCount,
      percentage,
    };
  }

  /**
   * Generate monthly student attendance report
   * 
   * Returns attendance data for all students or filtered by class
   * Includes: student name, admission ID, class, counts, percentage
   * 
   * @param query - Year, month, and optional class ID
   * @returns Array of student attendance reports
   */
  async getMonthlyStudentAttendanceReport(
    query: MonthlyStudentAttendanceQueryDto,
  ) {
    const { year, month, classId } = query;

    // Validate month and year
    if (month < 1 || month > 12) {
      throw new NotFoundException('Invalid month. Must be between 1 and 12.');
    }

    if (year < 2000 || year > 2100) {
      throw new NotFoundException('Invalid year. Must be between 2000 and 2100.');
    }

    // If classId is provided, verify it exists
    if (classId) {
      const classEntity = await this.prisma.class.findUnique({
        where: { id: classId },
      });

      if (!classEntity) {
        throw new NotFoundException(`Class with ID ${classId} not found`);
      }
    }

    // Get all active students, optionally filtered by class
    const where: any = {
      user: {
        status: 'ACTIVE',
      },
    };

    // If classId is provided, filter by class enrollment
    if (classId) {
      where.classEnrollments = {
        some: {
          classId: classId,
          status: 'ACTIVE',
        },
      };
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
          },
        },
        classEnrollments: {
          where: {
            status: 'ACTIVE',
            ...(classId && { classId }),
          },
          include: {
            class: true,
          },
        },
      },
      orderBy: {
        admissionId: 'asc',
      },
    });

    // Generate report for each student
    const reportPromises = students.map(async (student) => {
      // Calculate monthly attendance
      const attendance = await this.calculateMonthlyAttendance(
        student.id,
        year,
        month,
        classId,
      );

      // Get the student's class name(s)
      const classNames = student.classEnrollments
        .map((enrollment) => enrollment.class.name)
        .join(', ');

      return {
        studentId: student.id,
        admissionId: student.admissionId,
        firstName: student.firstName,
        lastName: student.lastName,
        studentName: `${student.firstName} ${student.lastName}`,
        email: student.user.email,
        className: classNames || 'No class',
        presentCount: attendance.presentCount,
        lateCount: attendance.lateCount,
        absentCount: attendance.absentCount,
        unmarkedCount: attendance.unmarkedCount,
        percentage: attendance.percentage,
        totalMarked: attendance.presentCount + attendance.lateCount + attendance.absentCount,
      };
    });

    const report = await Promise.all(reportPromises);

    return {
      year,
      month,
      classId,
      generatedAt: new Date(),
      students: report,
    };
  }

  /**
   * Get attendance history for a specific student
   * 
   * Supports filtering by date range, class, and status
   * Enforces student data isolation (students see only their own records)
   * 
   * @param studentId - Student ID
   * @param filters - Optional filters (dateFrom, dateTo, classId, status)
   * @returns Array of attendance records
   */
  async getStudentAttendanceHistory(
    studentId: string,
    filters?: {
      dateFrom?: string;
      dateTo?: string;
      classId?: string;
      status?: AttendanceStatus;
    },
  ) {
    // Verify student exists
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    // Build where clause
    const where: any = {
      studentId: studentId,
    };

    // Filter by date range
    if (filters?.dateFrom || filters?.dateTo) {
      where.register = {
        attendanceDate: {},
      };
      if (filters.dateFrom) {
        where.register.attendanceDate.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.register.attendanceDate.lte = new Date(filters.dateTo);
      }
    }

    // Filter by class
    if (filters?.classId) {
      if (!where.register) {
        where.register = {};
      }
      where.register.classId = filters.classId;
    }

    // Filter by status
    if (filters?.status) {
      where.status = filters.status;
    }

    // Get attendance records
    const records = await this.prisma.studentAttendance.findMany({
      where,
      include: {
        register: {
          include: {
            class: true,
          },
        },
      },
      orderBy: {
        markedAt: 'desc',
      },
    });

    return records.map((record) => ({
      id: record.id,
      studentId: record.studentId,
      className: record.register.class.name,
      attendanceDate: record.register.attendanceDate,
      status: record.status,
      remarks: record.remarks,
      markedBy: record.markedBy,
      markedAt: record.markedAt,
    }));
  }

  /**
   * Calculate monthly attendance for a staff member
   * 
   * Formula: 100 × (present + late) / (present + late + absent)
   * Excludes unmarked entries from the denominator
   * 
   * @param staffId - Staff ID
   * @param year - Year
   * @param month - Month (1-12)
   * @returns Attendance counts and percentage
   */
  private async calculateMonthlyStaffAttendance(
    staffId: string,
    year: number,
    month: number,
  ) {
    // Calendar month as UTC dates, matching the date-only attendance columns (R6.6)
    const { startDate, endDate } = monthRange(year, month);

    // Get all attendance records for the staff member in the specified month
    const attendanceRecords = await this.prisma.staffAttendance.findMany({
      where: {
        staffId: staffId,
        attendanceDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Initialize counts
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;

    // Count attendance by status
    for (const record of attendanceRecords) {
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

    // Calculate percentage: 100 × (present + late) / (present + late + absent)
    const denominator = presentCount + lateCount + absentCount;
    const percentage =
      denominator > 0
        ? Math.round((100 * (presentCount + lateCount)) / denominator * 100) / 100
        : null;

    return {
      presentCount,
      lateCount,
      absentCount,
      percentage,
    };
  }

  /**
   * Generate monthly staff attendance report
   * 
   * Returns attendance data for all staff or filtered by department/category
   * Includes: staff name, staff ID, designation, department, counts, percentage
   * 
   * @param query - Year, month, and optional department/category filters
   * @returns Array of staff attendance reports
   */
  async getMonthlyStaffAttendanceReport(
    query: MonthlyStaffAttendanceQueryDto,
  ) {
    const { year, month, department, category } = query;

    // Validate month and year
    if (month < 1 || month > 12) {
      throw new NotFoundException('Invalid month. Must be between 1 and 12.');
    }

    if (year < 2000 || year > 2100) {
      throw new NotFoundException('Invalid year. Must be between 2000 and 2100.');
    }

    // Build where clause for staff filtering
    const where: any = {
      user: {
        status: 'ACTIVE',
      },
    };

    // Add department filter if provided
    if (department) {
      where.department = department;
    }

    // Add category filter if provided
    if (category) {
      where.category = category;
    }

    // Get all active staff members with optional filters
    const staffMembers = await this.prisma.staff.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        staffId: 'asc',
      },
    });

    // Generate report for each staff member
    const reportPromises = staffMembers.map(async (staff) => {
      // Calculate monthly attendance
      const attendance = await this.calculateMonthlyStaffAttendance(
        staff.id,
        year,
        month,
      );

      return {
        staffId: staff.staffId,
        firstName: staff.firstName,
        lastName: staff.lastName,
        staffName: `${staff.firstName} ${staff.lastName}`,
        email: staff.user.email,
        designation: staff.designation,
        department: staff.department,
        category: staff.category,
        presentCount: attendance.presentCount,
        lateCount: attendance.lateCount,
        absentCount: attendance.absentCount,
        percentage: attendance.percentage,
        totalMarked: attendance.presentCount + attendance.lateCount + attendance.absentCount,
      };
    });

    const report = await Promise.all(reportPromises);

    return {
      year,
      month,
      department,
      category,
      generatedAt: new Date(),
      staff: report,
    };
  }

  /**
   * Get attendance history for a specific staff member
   * 
   * Supports filtering by date range
   * 
   * @param staffId - Staff ID
   * @param filters - Optional filters (dateFrom, dateTo)
   * @returns Array of attendance records
   */
  async getStaffAttendanceHistory(
    staffId: string,
    filters?: {
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    // Verify staff exists
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      throw new NotFoundException(`Staff with ID ${staffId} not found`);
    }

    // Build where clause
    const where: any = {
      staffId: staffId,
    };

    // Filter by date range
    if (filters?.dateFrom || filters?.dateTo) {
      where.attendanceDate = {};
      if (filters.dateFrom) {
        where.attendanceDate.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.attendanceDate.lte = new Date(filters.dateTo);
      }
    }

    // Get attendance records
    const records = await this.prisma.staffAttendance.findMany({
      where,
      orderBy: {
        attendanceDate: 'desc',
      },
    });

    return records.map((record) => ({
      id: record.id,
      staffId: record.staffId,
      attendanceDate: record.attendanceDate,
      status: record.status,
      remarks: record.remarks,
      markedBy: record.markedBy,
      markedAt: record.markedAt,
    }));
  }
}
