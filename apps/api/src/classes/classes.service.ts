import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { QueryClassDto } from './dto/query-class.dto';
import { ClassStatus, EnrollmentStatus, Prisma } from '@prisma/client';

/**
 * Classes Service
 * 
 * Handles business logic for:
 * - Class creation with unique name validation
 * - Class listing with status filtering
 * - Student enrollment management
 * - Soft delete for enrollments (INACTIVE status)
 * 
 * Requirements:
 * - R4: Class management with enrollment tracking
 */
@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new class
   * 
   * Requirements:
   * - R4.1: Class names must be unique
   * - R4.2: New class status defaults to ACTIVE
   * 
   * @throws ConflictException if class name already exists
   */
  async create(createClassDto: CreateClassDto) {
    try {
      return await this.prisma.class.create({
        data: {
          name: createClassDto.name,
          description: createClassDto.description,
          status: ClassStatus.ACTIVE,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Class with name "${createClassDto.name}" already exists`,
        );
      }
      throw error;
    }
  }

  /**
   * List classes with optional status filter
   * 
   * Requirements:
   * - R4: Support filtering by status (ACTIVE, ARCHIVED)
   * 
   * @param query - Query parameters including status filter and pagination
   * @returns Paginated list of classes
   */
  async findAll(query: QueryClassDto) {
    const { status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ClassWhereInput = {};
    if (status) {
      where.status = status;
    }

    const [classes, total] = await Promise.all([
      this.prisma.class.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          _count: {
            select: {
              enrollments: {
                where: {
                  status: EnrollmentStatus.ACTIVE,
                },
              },
            },
          },
        },
      }),
      this.prisma.class.count({ where }),
    ]);

    return {
      data: classes,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single class with active enrollments
   * 
   * Requirements:
   * - R4.7: Return only ACTIVE enrollments
   * 
   * @param id - Class UUID
   * @returns Class with active student enrollments
   * @throws NotFoundException if class doesn't exist
   */
  async findOne(id: string) {
    const classEntity = await this.prisma.class.findUnique({
      where: { id },
      include: {
        enrollments: {
          where: {
            status: EnrollmentStatus.ACTIVE,
          },
          include: {
            student: {
              include: {
                user: {
                  select: {
                    email: true,
                    status: true,
                  },
                },
              },
            },
          },
          orderBy: {
            enrolledAt: 'asc',
          },
        },
      },
    });

    if (!classEntity) {
      throw new NotFoundException(`Class with ID "${id}" not found`);
    }

    return classEntity;
  }

  /**
   * Update class details
   * 
   * Requirements:
   * - R4: Support updating name, description, and status
   * - R4.8: Support archiving classes
   * 
   * @param id - Class UUID
   * @param updateClassDto - Fields to update
   * @returns Updated class
   * @throws NotFoundException if class doesn't exist
   * @throws ConflictException if new name conflicts with existing class
   */
  async update(id: string, updateClassDto: UpdateClassDto) {
    // Check if class exists
    const existingClass = await this.prisma.class.findUnique({
      where: { id },
    });

    if (!existingClass) {
      throw new NotFoundException(`Class with ID "${id}" not found`);
    }

    try {
      return await this.prisma.class.update({
        where: { id },
        data: updateClassDto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Class with name "${updateClassDto.name}" already exists`,
        );
      }
      throw error;
    }
  }

  /**
   * Enroll a student in a class
   * 
   * Requirements:
   * - R4.3: Create enrollment with ACTIVE status
   * - R4.4: Prevent duplicate enrollments (unique constraint on studentId, classId)
   * 
   * @param classId - Class UUID
   * @param enrollStudentDto - Student ID to enroll
   * @returns Created enrollment
   * @throws NotFoundException if class or student doesn't exist
   * @throws ConflictException if student is already enrolled
   */
  async enrollStudent(classId: string, enrollStudentDto: EnrollStudentDto) {
    // Verify class exists
    const classEntity = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classEntity) {
      throw new NotFoundException(`Class with ID "${classId}" not found`);
    }

    // Verify student exists
    const student = await this.prisma.student.findUnique({
      where: { id: enrollStudentDto.studentId },
    });

    if (!student) {
      throw new NotFoundException(
        `Student with ID "${enrollStudentDto.studentId}" not found`,
      );
    }

    // Check for existing enrollment (including inactive ones)
    const existingEnrollment = await this.prisma.classEnrollment.findUnique({
      where: {
        studentId_classId: {
          studentId: enrollStudentDto.studentId,
          classId: classId,
        },
      },
    });

    // If enrollment exists and is ACTIVE, throw conflict
    if (existingEnrollment && existingEnrollment.status === EnrollmentStatus.ACTIVE) {
      throw new ConflictException(
        `Student is already enrolled in this class`,
      );
    }

    // If enrollment exists but is INACTIVE, reactivate it
    if (existingEnrollment && existingEnrollment.status === EnrollmentStatus.INACTIVE) {
      return await this.prisma.classEnrollment.update({
        where: {
          id: existingEnrollment.id,
        },
        data: {
          status: EnrollmentStatus.ACTIVE,
          enrolledAt: new Date(),
        },
        include: {
          student: {
            include: {
              user: {
                select: {
                  email: true,
                  status: true,
                },
              },
            },
          },
          class: true,
        },
      });
    }

    // Create new enrollment
    try {
      return await this.prisma.classEnrollment.create({
        data: {
          studentId: enrollStudentDto.studentId,
          classId: classId,
          status: EnrollmentStatus.ACTIVE,
        },
        include: {
          student: {
            include: {
              user: {
                select: {
                  email: true,
                  status: true,
                },
              },
            },
          },
          class: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Student is already enrolled in this class`,
        );
      }
      throw error;
    }
  }

  /**
   * Remove a student from a class (soft delete)
   * 
   * Requirements:
   * - R4.5: Set enrollment status to INACTIVE (don't delete)
   * - R4.6: Retain inactive enrollments for historical reporting
   * 
   * @param classId - Class UUID
   * @param studentId - Student UUID
   * @returns Updated enrollment with INACTIVE status
   * @throws NotFoundException if enrollment doesn't exist or is already inactive
   */
  async unenrollStudent(classId: string, studentId: string) {
    const enrollment = await this.prisma.classEnrollment.findUnique({
      where: {
        studentId_classId: {
          studentId: studentId,
          classId: classId,
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException(
        `Enrollment not found for student "${studentId}" in class "${classId}"`,
      );
    }

    if (enrollment.status === EnrollmentStatus.INACTIVE) {
      throw new BadRequestException(
        `Student is already unenrolled from this class`,
      );
    }

    return await this.prisma.classEnrollment.update({
      where: {
        id: enrollment.id,
      },
      data: {
        status: EnrollmentStatus.INACTIVE,
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                email: true,
                status: true,
              },
            },
          },
        },
        class: true,
      },
    });
  }
}
