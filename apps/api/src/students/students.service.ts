import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  CreateStudentDto,
  UpdateStudentDto,
  FilterStudentsDto,
  GetStudentAttendanceQueryDto,
} from './dto';

/**
 * Students Service
 * 
 * Provides business logic for student profile management:
 * - Create student accounts with User and Student profile
 * - Search and filter students by admission ID, class, date range
 * - Update student profiles with uniqueness validation
 * - Retrieve student details with enrollments
 * 
 * Requirements:
 * - R1: User management (Student accounts)
 * - R4: Class enrollment filtering
 * 
 * Uniqueness Constraints:
 * - email: unique across all users
 * - admissionId: unique across all students
 * 
 * Security:
 * - Passwords hashed with bcrypt (12 salt rounds)
 * - New accounts default to mustChangePassword=true
 */
@Injectable()
export class StudentsService {
  private readonly BCRYPT_SALT_ROUNDS = 12;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new student account
   * 
   * Requirements:
   * - R1: Email, password required for User account
   * - R1: admissionId, firstName, lastName, admissionDate required
   * - R1: Email must be unique across all users
   * - R1: admissionId must be unique across students
   * - R1: Passwords hashed with bcrypt (12 salt rounds)
   * - R1: mustChangePassword flag set to TRUE
   * 
   * Returns: Student profile with User data (excluding passwordHash)
   */
  async create(dto: CreateStudentDto, createdBy: string) {
    // Check email uniqueness
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email address is already in use');
    }

    // Check admissionId uniqueness
    const existingStudent = await this.prisma.student.findUnique({
      where: { admissionId: dto.admissionId },
    });

    if (existingStudent) {
      throw new ConflictException('Admission ID is already in use');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(
      dto.password,
      this.BCRYPT_SALT_ROUNDS,
    );

    // Create user with student profile in transaction
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: UserRole.STUDENT,
        status: UserStatus.PENDING,
        mustChangePassword: true,
        createdBy,
        studentProfile: {
          create: {
            admissionId: dto.admissionId,
            firstName: dto.firstName,
            lastName: dto.lastName,
            admissionDate: new Date(dto.admissionDate),
            dateOfBirth: dto.dateOfBirth
              ? new Date(dto.dateOfBirth)
              : null,
            gender: dto.gender || null,
            phoneNumber: dto.phoneNumber || null,
            address: dto.address || null,
            city: dto.city || null,
            state: dto.state || null,
            pincode: dto.pincode || null,
          },
        },
      },
      include: {
        studentProfile: true,
      },
    });

    // Remove passwordHash from response
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Find all students with filtering and pagination
   * 
   * Requirements:
   * - R1: Support filtering by admission ID, class enrollment, admission date range
   * - R1: Support searching by name, email, admission ID
   * - Pagination with page, limit, and metadata
   * 
   * Returns:
   * - data: Array of students with user data (excluding passwordHash)
   * - meta: { total, page, limit, totalPages }
   */
  async findAll(filters: FilterStudentsDto) {
    const {
      search,
      classId,
      admissionDateFrom,
      admissionDateTo,
      activeOnly,
      page = 1,
      limit = 10,
    } = filters;

    // Build where clause for Student
    const where: any = {};

    // Search by name, email, or admission ID
    if (search) {
      where.OR = [
        { admissionId: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        {
          user: {
            email: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    if (activeOnly) {
      where.user = { status: UserStatus.ACTIVE };
    }

    // Filter by active class enrolment (R1.11)
    if (classId) {
      where.classEnrollments = { some: { classId, status: 'ACTIVE' } };
    }

    // Filter by admission date range
    if (admissionDateFrom || admissionDateTo) {
      where.admissionDate = {};
      if (admissionDateFrom) {
        where.admissionDate.gte = new Date(admissionDateFrom);
      }
      if (admissionDateTo) {
        where.admissionDate.lte = new Date(admissionDateTo);
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100); // Max 100 per page

    // Get total count
    const total = await this.prisma.student.count({ where });

    // Get students
    const students = await this.prisma.student.findMany({
      where,
      skip,
      take,
      include: {
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Remove passwordHash from all users
    const studentsWithoutPasswords = students.map((student) => {
      const { user, ...studentData } = student;
      const { passwordHash, passwordResetToken, passwordResetExpiry, ...userWithoutPassword } = user;
      return {
        ...studentData,
        user: userWithoutPassword,
      };
    });

    // Calculate total pages
    const totalPages = Math.ceil(total / take);

    return {
      data: studentsWithoutPasswords,
      meta: {
        total,
        page,
        limit: take,
        totalPages,
      },
    };
  }

  /**
   * Find a single student by ID with enrollments
   * 
   * Requirements:
   * - R1: Get student with User data and enrollments
   * - Excludes passwordHash from response
   * - Includes class enrollments and course enrollments (when available)
   * 
   * Returns: Student profile with User data and enrollments
   */
  async findOne(id: string, currentUserId?: string, currentUserRole?: UserRole) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        user: true,
        // R5.4: all course enrolments with progress
        courseEnrollments: {
          include: { course: { select: { id: true, title: true, status: true } } },
          orderBy: { enrolledAt: 'desc' },
        },
        // R4: class history (inactive kept for reporting)
        classEnrollments: {
          include: { class: { select: { id: true, name: true, status: true } } },
          orderBy: { enrolledAt: 'desc' },
        },
        // R26.5: every quiz attempt
        quizAttempts: {
          select: {
            id: true,
            score: true,
            passed: true,
            submittedAt: true,
            quiz: { select: { id: true, title: true, totalMarks: true, passMark: true } },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // R2.5: a student may only read their own profile
    if (currentUserRole === UserRole.STUDENT && student.userId !== currentUserId) {
      throw new ForbiddenException('Students can only view their own profile');
    }

    // Remove passwordHash from response
    const { user, ...studentData } = student;
    const { passwordHash: _, passwordResetToken: _t, passwordResetExpiry: _e, ...userWithoutPassword } = user;

    return {
      ...studentData,
      user: userWithoutPassword,
    };
  }

  /**
   * Update student profile with uniqueness validation
   * 
   * Requirements:
   * - R1: Validate all required fields
   * - R1: Enforce uniqueness constraints for email and admissionId
   * - Profile updates are merged (not replaced)
   * 
   * Returns: Updated student profile with User data
   */
  async update(id: string, dto: UpdateStudentDto) {
    // Check if student exists
    const existingStudent = await this.prisma.student.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!existingStudent) {
      throw new NotFoundException('Student not found');
    }

    // Check email uniqueness if being updated
    if (dto.email && dto.email !== existingStudent.user.email) {
      const emailTaken = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (emailTaken) {
        throw new ConflictException('Email address is already in use');
      }
    }

    // Check admissionId uniqueness if being updated
    if (dto.admissionId && dto.admissionId !== existingStudent.admissionId) {
      const admissionIdTaken = await this.prisma.student.findUnique({
        where: { admissionId: dto.admissionId },
      });

      if (admissionIdTaken) {
        throw new ConflictException('Admission ID is already in use');
      }
    }

    // Update user and student profile in transaction
    const updatedUser = await this.prisma.user.update({
      where: { id: existingStudent.userId },
      data: {
        ...(dto.email && { email: dto.email }),
        studentProfile: {
          update: {
            ...(dto.admissionId && { admissionId: dto.admissionId }),
            ...(dto.firstName && { firstName: dto.firstName }),
            ...(dto.lastName && { lastName: dto.lastName }),
            ...(dto.admissionDate && {
              admissionDate: new Date(dto.admissionDate),
            }),
            ...(dto.dateOfBirth && {
              dateOfBirth: new Date(dto.dateOfBirth),
            }),
            ...(dto.gender !== undefined && { gender: dto.gender }),
            ...(dto.phoneNumber !== undefined && {
              phoneNumber: dto.phoneNumber,
            }),
            ...(dto.address !== undefined && { address: dto.address }),
            ...(dto.city !== undefined && { city: dto.city }),
            ...(dto.state !== undefined && { state: dto.state }),
            ...(dto.pincode !== undefined && { pincode: dto.pincode }),
          },
        },
      },
      include: {
        studentProfile: true,
      },
    });

    // Remove passwordHash from response
    const { passwordHash: _, studentProfile, ...userWithoutPassword } = updatedUser;
    return {
      ...studentProfile,
      user: userWithoutPassword,
    };
  }

  /**
   * Get attendance history for a student with filtering
   * 
   * Requirements:
   * - R10.1: Support filtering by Student ID
   * - R10.2: Support filtering by class ID
   * - R10.3: Support filtering by date range
   * - R10.4: Support filtering by attendance status
   * - R10.5: Students can only view their own records
   * - R10.6: Return results ordered by date descending
   * - R10.7: Display Student name, class name, date, status, and remarks
   * - R10.8: Students see records from all enrolled classes
   * 
   * @param studentId - Student ID to filter by
   * @param query - Filter parameters (classId, dateFrom, dateTo, status)
   * @param currentUserId - ID of the requesting user (for authorization)
   * @param currentUserRole - Role of the requesting user (for authorization)
   * @returns Array of attendance records with student and class details
   */
  async getStudentAttendance(
    studentId: string,
    query: GetStudentAttendanceQueryDto,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    // Verify student exists
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Authorization: Students can only view their own attendance
    // R10.5: When a Student requests attendance history, THE System SHALL return only their own records
    if (currentUserRole === UserRole.STUDENT && student.userId !== currentUserId) {
      throw new ForbiddenException('Students can only view their own attendance records');
    }

    // Build where clause
    const where: any = {
      studentId: studentId,
    };

    // Filter by class ID (R10.2)
    if (query.classId) {
      where.register = {
        classId: query.classId,
      };
    }

    // Filter by date range (R10.3)
    if (query.dateFrom || query.dateTo) {
      where.register = {
        ...where.register,
        attendanceDate: {},
      };
      if (query.dateFrom) {
        where.register.attendanceDate.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.register.attendanceDate.lte = new Date(query.dateTo);
      }
    }

    // Filter by attendance status (R10.4)
    if (query.status) {
      where.status = query.status;
    }

    // Query attendance records
    const records = await this.prisma.studentAttendance.findMany({
      where,
      include: {
        register: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        student: {
          select: {
            id: true,
            admissionId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        register: {
          attendanceDate: 'desc', // R10.6: Return results ordered by date descending
        },
      },
    });

    // Format response (R10.7: Display Student name, class name, date, status, and remarks)
    return records.map((record) => ({
      id: record.id,
      studentId: record.studentId,
      studentName: `${record.student.firstName} ${record.student.lastName}`,
      admissionId: record.student.admissionId,
      classId: record.register.classId,
      className: record.register.class.name,
      attendanceDate: record.register.attendanceDate,
      status: record.status,
      remarks: record.remarks,
      markedBy: record.markedBy,
      markedAt: record.markedAt,
    }));
  }

  /**
   * Get attendance history for all students with filtering
   * 
   * Used by administrators to view attendance across all students
   * Supports all the same filters as single student attendance
   * 
   * Requirements:
   * - R10.1-10.4: All filtering capabilities
   * - R10.6: Return results ordered by date descending
   * - R10.7: Display Student name, class name, date, status, and remarks
   * 
   * @param query - Filter parameters (studentId, classId, dateFrom, dateTo, status)
   * @returns Array of attendance records with student and class details
   */
  async getAllStudentsAttendance(query: GetStudentAttendanceQueryDto) {
    // Build where clause
    const where: any = {};

    // Filter by student ID (R10.1)
    if (query.studentId) {
      where.studentId = query.studentId;
    }

    // Filter by class ID (R10.2)
    if (query.classId) {
      where.register = {
        classId: query.classId,
      };
    }

    // Filter by date range (R10.3)
    if (query.dateFrom || query.dateTo) {
      where.register = {
        ...where.register,
        attendanceDate: {},
      };
      if (query.dateFrom) {
        where.register.attendanceDate.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.register.attendanceDate.lte = new Date(query.dateTo);
      }
    }

    // Filter by attendance status (R10.4)
    if (query.status) {
      where.status = query.status;
    }

    // Query attendance records
    const records = await this.prisma.studentAttendance.findMany({
      where,
      include: {
        register: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        student: {
          select: {
            id: true,
            admissionId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        register: {
          attendanceDate: 'desc', // R10.6: Return results ordered by date descending
        },
      },
    });

    // Format response (R10.7: Display Student name, class name, date, status, and remarks)
    return records.map((record) => ({
      id: record.id,
      studentId: record.studentId,
      studentName: `${record.student.firstName} ${record.student.lastName}`,
      admissionId: record.student.admissionId,
      classId: record.register.classId,
      className: record.register.class.name,
      attendanceDate: record.register.attendanceDate,
      status: record.status,
      remarks: record.remarks,
      markedBy: record.markedBy,
      markedAt: record.markedAt,
    }));
  }
}
