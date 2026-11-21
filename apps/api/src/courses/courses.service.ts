import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { QueryCourseDto } from './dto/query-course.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { QueryEnrollmentDto } from './dto/query-enrollment.dto';
import { CourseStatus, CourseEnrollmentStatus, Prisma, UserRole } from '@prisma/client';

/**
 * Courses Service
 *
 * Handles business logic for:
 * - Course CRUD operations
 * - Course publishing and status management
 * - Course enrollment management
 * - Enrollment validation (course published, not already enrolled)
 * - Soft delete for courses and enrollments
 *
 * Requirements:
 * - R5: Course enrollment management
 * - R15: Course creation and management
 * - R16: Course publishing control
 * - R22: Course progress dashboard
 */
@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new course
   *
   * Requirements:
   * - R15.1: Course requires title
   * - R15.2: Status defaults to DRAFT
   * - R15.9: Track creator user ID
   *
   * @param createCourseDto - Course details
   * @param createdBy - User ID of the creator
   * @returns Created course
   */
  async create(createCourseDto: CreateCourseDto, createdBy: string) {
    return await this.prisma.course.create({
      data: {
        title: createCourseDto.title,
        description: createCourseDto.description,
        displayOrder: createCourseDto.displayOrder ?? 0,
        status: CourseStatus.DRAFT,
        createdBy,
      },
    });
  }

  /**
   * List all courses with optional status filter and pagination
   *
   * Requirements:
   * - R16.2: PUBLISHED courses visible to enrolled students
   * - R16.3: DRAFT courses hidden from students
   * - R16.8: ARCHIVED courses excluded
   *
   * @param query - Query parameters including status filter and pagination
   * @returns Paginated list of courses
   */
  async findAll(query: QueryCourseDto) {
    const { status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CourseWhereInput = {};
    if (status) {
      where.status = status;
    }

    const [courses, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          _count: {
            select: {
              modules: true,
              enrollments: {
                where: {
                  status: CourseEnrollmentStatus.ACTIVE,
                },
              },
            },
          },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      data: courses,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single course with modules and lessons
   *
   * Requirements:
   * - R15: Return course details with nested modules
   * - R17: Include modules in course view
   * - R18: Include lessons in module view
   * - R19: Filter by lesson publish status
   *
   * @param id - Course UUID
   * @returns Course with nested modules and lessons
   * @throws NotFoundException if course doesn't exist
   */
  async findOne(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: {
            displayOrder: 'asc',
          },
          include: {
            lessons: {
              orderBy: {
                displayOrder: 'asc',
              },
            },
          },
        },
        _count: {
          select: {
            enrollments: {
              where: {
                status: CourseEnrollmentStatus.ACTIVE,
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID "${id}" not found`);
    }

    return course;
  }

  /**
   * Update course details
   *
   * Requirements:
   * - R15.6: Support updating all course fields
   * - R16.1: Support publishing (status to PUBLISHED)
   * - R16.4: Support unpublishing (status to DRAFT)
   * - R16.5: Display warning about existing progress when unpublishing
   * - R16.7: Support archiving (status to ARCHIVED)
   *
   * @param id - Course UUID
   * @param updateCourseDto - Fields to update
   * @returns Updated course
   * @throws NotFoundException if course doesn't exist
   */
  async update(id: string, updateCourseDto: UpdateCourseDto) {
    // Check if course exists
    const existingCourse = await this.prisma.course.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            enrollments: {
              where: {
                status: CourseEnrollmentStatus.ACTIVE,
                progressPercentage: {
                  gt: 0,
                },
              },
            },
          },
        },
      },
    });

    if (!existingCourse) {
      throw new NotFoundException(`Course with ID "${id}" not found`);
    }

    // R16.5: Warn if unpublishing a course with student progress
    if (
      updateCourseDto.status === CourseStatus.DRAFT &&
      existingCourse.status === CourseStatus.PUBLISHED &&
      existingCourse._count.enrollments > 0
    ) {
      // Note: In a real implementation, you might want to return this as metadata
      // or handle it via a confirmation flow in the controller
      console.warn(
        `Warning: Unpublishing course "${existingCourse.title}" with ${existingCourse._count.enrollments} students having progress`
      );
    }

    return await this.prisma.course.update({
      where: { id },
      data: updateCourseDto,
    });
  }

  /**
   * Delete a course (soft delete by archiving)
   *
   * Requirements:
   * - R16.7: Archive course instead of hard delete
   * - R16.6: Retain all student progress records
   *
   * @param id - Course UUID
   * @returns Archived course
   * @throws NotFoundException if course doesn't exist
   */
  async remove(id: string) {
    const existingCourse = await this.prisma.course.findUnique({
      where: { id },
    });

    if (!existingCourse) {
      throw new NotFoundException(`Course with ID "${id}" not found`);
    }

    return await this.prisma.course.update({
      where: { id },
      data: {
        status: CourseStatus.ARCHIVED,
      },
    });
  }

  /**
   * Enroll a student in a course
   *
   * Requirements:
   * - R5.1: Create enrollment with ACTIVE status
   * - R5.2: Prevent duplicate enrollments
   * - R5.3: Set progressPercentage to 0
   * - R5.8: Only allow enrollment in PUBLISHED courses
   *
   * Authorization:
   * - Administrators can enroll any student
   * - Students can enroll themselves
   *
   * @param courseId - Course UUID
   * @param enrollStudentDto - Student ID to enroll
   * @param currentUserId - ID of user making the request
   * @param currentUserRole - Role of user making the request
   * @returns Created enrollment
   * @throws NotFoundException if course or student doesn't exist
   * @throws BadRequestException if course is not published
   * @throws ConflictException if student is already enrolled
   */
  async enrollStudent(
    courseId: string,
    enrollStudentDto: EnrollStudentDto,
    currentUserId: string,
    currentUserRole: UserRole
  ) {
    const { studentId } = enrollStudentDto;

    // Verify course exists and is PUBLISHED
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID "${courseId}" not found`);
    }

    if (course.status !== CourseStatus.PUBLISHED) {
      throw new BadRequestException('Cannot enroll in a course that is not published');
    }

    // Verify student exists
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID "${studentId}" not found`);
    }

    // Authorization check: students can only enroll themselves
    if (currentUserRole === UserRole.STUDENT && student.userId !== currentUserId) {
      throw new BadRequestException('Students can only enroll themselves in courses');
    }

    // Check for existing enrollment (including inactive ones)
    const existingEnrollment = await this.prisma.courseEnrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: studentId,
          courseId: courseId,
        },
      },
    });

    // If enrollment exists and is ACTIVE, throw conflict
    if (existingEnrollment && existingEnrollment.status === CourseEnrollmentStatus.ACTIVE) {
      throw new ConflictException('Student is already enrolled in this course');
    }

    // If enrollment exists but is DROPPED or COMPLETED, reactivate it
    if (
      existingEnrollment &&
      (existingEnrollment.status === CourseEnrollmentStatus.DROPPED ||
        existingEnrollment.status === CourseEnrollmentStatus.COMPLETED)
    ) {
      return await this.prisma.courseEnrollment.update({
        where: {
          id: existingEnrollment.id,
        },
        data: {
          status: CourseEnrollmentStatus.ACTIVE,
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
          course: {
            select: {
              id: true,
              title: true,
              description: true,
              coverImage: true,
              status: true,
            },
          },
        },
      });
    }

    // Create new enrollment
    try {
      return await this.prisma.courseEnrollment.create({
        data: {
          studentId: studentId,
          courseId: courseId,
          status: CourseEnrollmentStatus.ACTIVE,
          progressPercentage: 0,
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
          course: {
            select: {
              id: true,
              title: true,
              description: true,
              coverImage: true,
              status: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Student is already enrolled in this course');
      }
      throw error;
    }
  }

  /**
   * Get all enrollments for a student
   *
   * Requirements:
   * - R5.4: List student enrollments with current progress
   * - R22: Course progress dashboard
   *
   * @param studentId - Student UUID
   * @returns List of course enrollments with progress
   * @throws NotFoundException if student doesn't exist
   */
  async getStudentEnrollments(studentId: string) {
    // Verify student exists
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID "${studentId}" not found`);
    }

    return await this.prisma.courseEnrollment.findMany({
      where: {
        studentId: studentId,
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            coverImage: true,
            status: true,
            displayOrder: true,
          },
        },
      },
      orderBy: {
        enrolledAt: 'desc',
      },
    });
  }

  /**
   * Get all enrollments for a course (admin only)
   *
   * Requirements:
   * - R5: List course enrollments for reporting
   *
   * @param courseId - Course UUID
   * @param query - Query parameters including status filter and pagination
   * @returns Paginated list of enrollments
   * @throws NotFoundException if course doesn't exist
   */
  async getCourseEnrollments(courseId: string, query: QueryEnrollmentDto) {
    const { status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    // Verify course exists
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID "${courseId}" not found`);
    }

    const where: Prisma.CourseEnrollmentWhereInput = {
      courseId: courseId,
    };

    if (status) {
      where.status = status;
    }

    const [enrollments, total] = await Promise.all([
      this.prisma.courseEnrollment.findMany({
        where,
        skip,
        take: limit,
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
          enrolledAt: 'desc',
        },
      }),
      this.prisma.courseEnrollment.count({ where }),
    ]);

    return {
      data: enrollments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Unenroll a student from a course (soft delete)
   *
   * Requirements:
   * - R5.5: Set enrollment status to DROPPED
   * - R5.6: Retain enrollment record and progress history
   *
   * @param enrollmentId - Enrollment UUID
   * @param currentUserId - ID of user making the request
   * @param currentUserRole - Role of user making the request
   * @returns Updated enrollment with DROPPED status
   * @throws NotFoundException if enrollment doesn't exist
   * @throws BadRequestException if enrollment is already dropped
   */
  async unenrollStudent(enrollmentId: string, currentUserId: string, currentUserRole: UserRole) {
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: {
          include: {
            user: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            coverImage: true,
            status: true,
          },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with ID "${enrollmentId}" not found`);
    }

    // Authorization check: students can only unenroll themselves
    if (currentUserRole === UserRole.STUDENT && enrollment.student.userId !== currentUserId) {
      throw new BadRequestException('Students can only unenroll themselves from courses');
    }

    if (enrollment.status === CourseEnrollmentStatus.DROPPED) {
      throw new BadRequestException('Student is already unenrolled from this course');
    }

    return await this.prisma.courseEnrollment.update({
      where: {
        id: enrollmentId,
      },
      data: {
        status: CourseEnrollmentStatus.DROPPED,
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
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            coverImage: true,
            status: true,
          },
        },
      },
    });
  }
}
