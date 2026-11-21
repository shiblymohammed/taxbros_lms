import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarkStaffAttendanceDto } from './dto/mark-staff-attendance.dto';
import { MarkStudentAttendanceDto } from './dto/mark-student-attendance.dto';
import { OpenRegisterDto } from './dto/open-register.dto';
import { GetStaffAttendanceQueryDto } from './dto/get-staff-attendance-query.dto';
import { RegisterStatus } from '@prisma/client';

/**
 * Attendance Service
 * 
 * Handles attendance operations:
 * - Open/retrieve student attendance registers
 * - Mark student attendance (upsert based on registerId + studentId)
 * - Mark staff attendance (upsert based on staffId + date)
 * - Retrieve attendance records with filtering
 * - Support for corrections via upsert
 */
@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Open or retrieve attendance register
   * 
   * If register exists: retrieve with all student attendance records
   * If register doesn't exist: create with frozen roster snapshot
   * 
   * @param dto - Class ID and attendance date
   * @returns Register with student roster and attendance status
   */
  async openRegister(dto: OpenRegisterDto) {
    // Validate class exists
    const classEntity = await this.prisma.class.findUnique({
      where: { id: dto.classId },
    });

    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${dto.classId} not found`);
    }

    // Parse date
    const attendanceDate = new Date(dto.attendanceDate);
    if (isNaN(attendanceDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    // Check if register already exists
    let register = await this.prisma.studentAttendanceRegister.findUnique({
      where: {
        classId_attendanceDate: {
          classId: dto.classId,
          attendanceDate: attendanceDate,
        },
      },
      include: {
        attendanceRecords: true,
        class: true,
      },
    });

    // If register doesn't exist, create it with frozen roster
    if (!register) {
      // Get active enrollments for this class
      const enrollments = await this.prisma.classEnrollment.findMany({
        where: {
          classId: dto.classId,
          status: 'ACTIVE',
        },
        select: {
          studentId: true,
        },
      });

      // Extract student IDs as frozen roster snapshot
      const rosterSnapshot = enrollments.map((e) => e.studentId);

      // Create register with frozen roster
      register = await this.prisma.studentAttendanceRegister.create({
        data: {
          classId: dto.classId,
          attendanceDate: attendanceDate,
          rosterSnapshot: rosterSnapshot,
          status: RegisterStatus.DRAFT,
        },
        include: {
          attendanceRecords: true,
          class: true,
        },
      });
    }

    // Get student details for all IDs in frozen roster
    const studentIds = register.rosterSnapshot as string[];
    const students = await this.prisma.student.findMany({
      where: {
        id: {
          in: studentIds,
        },
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    // Create a map of student ID to student details
    const studentMap = new Map(students.map((s) => [s.id, s]));

    // Build response with attendance status
    const studentsWithAttendance = studentIds.map((studentId) => {
      const student = studentMap.get(studentId);
      const attendance = register.attendanceRecords.find(
        (a) => a.studentId === studentId,
      );

      return {
        studentId: studentId,
        admissionId: student?.admissionId || 'Unknown',
        firstName: student?.firstName || 'Unknown',
        lastName: student?.lastName || 'Student',
        status: attendance?.status,
        remarks: attendance?.remarks,
        markedAt: attendance?.markedAt,
      };
    });

    return {
      id: register.id,
      classId: register.classId,
      className: register.class.name,
      attendanceDate: register.attendanceDate,
      status: register.status,
      students: studentsWithAttendance,
      createdAt: register.createdAt,
      updatedAt: register.updatedAt,
    };
  }

  /**
   * Mark student attendance
   * 
   * Upserts attendance records for students in a register
   * Updates register status from DRAFT to SAVED
   * Allows corrections by updating existing records
   * 
   * @param registerId - UUID of the attendance register
   * @param dto - Array of attendance marks
   * @param markedByUserId - User ID of the person marking attendance
   * @returns Updated register with attendance records
   */
  async markStudentAttendance(
    registerId: string,
    dto: MarkStudentAttendanceDto,
    markedByUserId: string,
  ) {
    // Verify register exists
    const register = await this.prisma.studentAttendanceRegister.findUnique({
      where: { id: registerId },
      include: {
        class: true,
      },
    });

    if (!register) {
      throw new NotFoundException(`Register with ID ${registerId} not found`);
    }

    // Get the frozen roster
    const rosterSnapshot = register.rosterSnapshot as string[];

    // Validate that all students in marks are in the frozen roster
    for (const mark of dto.marks) {
      if (!rosterSnapshot.includes(mark.studentId)) {
        throw new BadRequestException(
          `Student ${mark.studentId} is not in the register roster`,
        );
      }
    }

    // Upsert attendance records for each student
    const upsertPromises = dto.marks.map((mark) =>
      this.prisma.studentAttendance.upsert({
        where: {
          registerId_studentId: {
            registerId: registerId,
            studentId: mark.studentId,
          },
        },
        create: {
          registerId: registerId,
          studentId: mark.studentId,
          status: mark.status,
          remarks: mark.remarks,
          markedBy: markedByUserId,
          markedAt: new Date(),
        },
        update: {
          status: mark.status,
          remarks: mark.remarks,
          markedBy: markedByUserId,
          markedAt: new Date(),
        },
      }),
    );

    await Promise.all(upsertPromises);

    // Update register status to SAVED if it was DRAFT
    if (register.status === RegisterStatus.DRAFT) {
      await this.prisma.studentAttendanceRegister.update({
        where: { id: registerId },
        data: { status: RegisterStatus.SAVED },
      });
    }

    // Return the updated register
    return this.openRegister({
      classId: register.classId,
      attendanceDate: register.attendanceDate.toISOString().split('T')[0],
    });
  }


  /**
   * Mark staff attendance
   * 
   * Upserts attendance record based on (staffId, attendanceDate) unique constraint
   * Allows corrections by updating existing records
   * 
   * @param dto - Staff attendance data
   * @param markedByUserId - User ID of the person marking attendance
   * @returns Created or updated staff attendance record
   */
  async markStaffAttendance(
    dto: MarkStaffAttendanceDto,
    markedByUserId: string,
  ) {
    // Verify staff exists and is active
    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
      include: { user: true },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${dto.staffId} not found`);
    }

    if (staff.user.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Cannot mark attendance for inactive staff member`,
      );
    }

    // Parse the date string to ensure it's in the correct format
    const attendanceDate = new Date(dto.attendanceDate);
    if (isNaN(attendanceDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    // Upsert attendance record (create if not exists, update if exists)
    const attendance = await this.prisma.staffAttendance.upsert({
      where: {
        staffId_attendanceDate: {
          staffId: dto.staffId,
          attendanceDate: attendanceDate,
        },
      },
      create: {
        staffId: dto.staffId,
        attendanceDate: attendanceDate,
        status: dto.status,
        remarks: dto.remarks,
        markedBy: markedByUserId,
        markedAt: new Date(),
      },
      update: {
        status: dto.status,
        remarks: dto.remarks,
        markedBy: markedByUserId,
        markedAt: new Date(),
      },
      include: {
        staff: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });

    return {
      id: attendance.id,
      staffId: attendance.staffId,
      staffName: `${attendance.staff.firstName} ${attendance.staff.lastName}`,
      staffEmail: attendance.staff.user.email,
      designation: attendance.staff.designation,
      department: attendance.staff.department,
      attendanceDate: attendance.attendanceDate,
      status: attendance.status,
      remarks: attendance.remarks,
      markedBy: attendance.markedBy,
      markedAt: attendance.markedAt,
    };
  }

  /**
   * Get staff attendance records with filtering
   * 
   * Supports filtering by:
   * - Date range (dateFrom, dateTo)
   * - Specific staff member (staffId)
   * - Attendance status (PRESENT, ABSENT, LATE)
   * 
   * @param query - Filter parameters
   * @returns Array of attendance records
   */
  async getStaffAttendance(query: GetStaffAttendanceQueryDto) {
    const where: any = {};

    // Filter by staff ID
    if (query.staffId) {
      where.staffId = query.staffId;
    }

    // Filter by date range
    if (query.dateFrom || query.dateTo) {
      where.attendanceDate = {};
      if (query.dateFrom) {
        where.attendanceDate.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.attendanceDate.lte = new Date(query.dateTo);
      }
    }

    // Filter by status
    if (query.status) {
      where.status = query.status;
    }

    const records = await this.prisma.staffAttendance.findMany({
      where,
      include: {
        staff: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        attendanceDate: 'desc',
      },
    });

    return records.map((record) => ({
      id: record.id,
      staffId: record.staffId,
      staffName: `${record.staff.firstName} ${record.staff.lastName}`,
      staffEmail: record.staff.user.email,
      designation: record.staff.designation,
      department: record.staff.department,
      attendanceDate: record.attendanceDate,
      status: record.status,
      remarks: record.remarks,
      markedBy: record.markedBy,
      markedAt: record.markedAt,
    }));
  }

  /**
   * Get attendance for a specific staff member
   * 
   * @param staffId - Staff member ID
   * @param dateFrom - Optional start date
   * @param dateTo - Optional end date
   * @returns Array of attendance records for the staff member
   */
  async getStaffMemberAttendance(
    staffId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    // Verify staff exists
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffId} not found`);
    }

    return this.getStaffAttendance({
      staffId,
      dateFrom,
      dateTo,
    });
  }
}
