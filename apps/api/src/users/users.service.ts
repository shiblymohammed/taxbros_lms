import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { generateTemporaryPassword } from '../auth/password-policy';
import {
  CreateUserDto,
  UpdateUserDto,
  FilterUsersDto,
} from './dto';

/**
 * Users Service
 * 
 * Provides business logic for user account management:
 * - Create users with role-based profiles (Student, Staff, Administrator)
 * - Search and filter users with pagination
 * - Update user profiles with uniqueness validation
 * - Activate/deactivate accounts
 * - Enforce historical record retention
 * 
 * Uniqueness Constraints:
 * - email: unique across all users
 * - admissionId: unique across all students
 * - staffId: unique across all staff
 * 
 * Security:
 * - Passwords hashed with bcrypt (12 salt rounds)
 * - New accounts default to mustChangePassword=true
 * - Deactivated accounts retain all historical data
 */
@Injectable()
export class UsersService {
  private readonly BCRYPT_SALT_ROUNDS = 12;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new user account with role-based profile
   * 
   * Requirements:
   * - R1: Email, password, role are required
   * - R1: Students require admissionId, firstName, lastName, admissionDate
   * - R1: Staff require staffId, firstName, lastName, designation, department, category, joiningDate
   * - R1: Administrators require no additional profile
   * - R1: Email must be unique across all users
   * - R1: admissionId must be unique across students
   * - R1: staffId must be unique across staff
   * - R1: Passwords hashed with bcrypt (12 salt rounds)
   * - R1: mustChangePassword flag set to TRUE
   */
  async create(dto: CreateUserDto, createdBy: string) {
    // Validate role-specific profile requirements
    if (dto.role === UserRole.STUDENT && !dto.studentProfile) {
      throw new BadRequestException(
        'Student profile is required for STUDENT role',
      );
    }

    if (dto.role === UserRole.STAFF && !dto.staffProfile) {
      throw new BadRequestException(
        'Staff profile is required for STAFF role',
      );
    }

    // Check email uniqueness
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email address is already in use');
    }

    // Check admissionId uniqueness for students
    if (dto.studentProfile?.admissionId) {
      const existingStudent = await this.prisma.student.findUnique({
        where: { admissionId: dto.studentProfile.admissionId },
      });

      if (existingStudent) {
        throw new ConflictException('Admission ID is already in use');
      }
    }

    // Check staffId uniqueness for staff
    if (dto.staffProfile?.staffId) {
      const existingStaff = await this.prisma.staff.findUnique({
        where: { staffId: dto.staffProfile.staffId },
      });

      if (existingStaff) {
        throw new ConflictException('Staff ID is already in use');
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(
      dto.password,
      this.BCRYPT_SALT_ROUNDS,
    );

    // Create user with profile in transaction
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role,
        status: UserStatus.PENDING,
        mustChangePassword: true,
        createdBy,
        // Create student profile if role is STUDENT
        ...(dto.role === UserRole.STUDENT &&
          dto.studentProfile && {
            studentProfile: {
              create: {
                admissionId: dto.studentProfile.admissionId,
                firstName: dto.studentProfile.firstName,
                lastName: dto.studentProfile.lastName,
                admissionDate: new Date(dto.studentProfile.admissionDate),
                dateOfBirth: dto.studentProfile.dateOfBirth
                  ? new Date(dto.studentProfile.dateOfBirth)
                  : null,
                gender: dto.studentProfile.gender || null,
                phoneNumber: dto.studentProfile.phoneNumber || null,
                address: dto.studentProfile.address || null,
                city: dto.studentProfile.city || null,
                state: dto.studentProfile.state || null,
                pincode: dto.studentProfile.pincode || null,
              },
            },
          }),
        // Create staff profile if role is STAFF
        ...(dto.role === UserRole.STAFF &&
          dto.staffProfile && {
            staffProfile: {
              create: {
                staffId: dto.staffProfile.staffId,
                firstName: dto.staffProfile.firstName,
                lastName: dto.staffProfile.lastName,
                designation: dto.staffProfile.designation,
                department: dto.staffProfile.department,
                category: dto.staffProfile.category,
                joiningDate: new Date(dto.staffProfile.joiningDate),
                phoneNumber: dto.staffProfile.phoneNumber || null,
                address: dto.staffProfile.address || null,
              },
            },
          }),
      },
      include: {
        studentProfile: true,
        staffProfile: true,
      },
    });

    // Remove passwordHash from response
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Find all users with filtering and pagination
   * 
   * Requirements:
   * - R1: Support filtering by role, status, name, email
   * - Pagination with page, limit, and metadata
   * 
   * Returns:
   * - data: Array of users with profiles (excluding passwordHash)
   * - meta: { total, page, limit, totalPages }
   */
  /** @param allowedRoles limit results to these roles (staff only see the accounts they manage) */
  async findAll(filters: FilterUsersDto, allowedRoles?: UserRole[]) {
    const { role, status, search, page = 1, limit = 10 } = filters;

    // Build where clause
    const where: any = {};

    const studentWhere = buildStudentFilter(filters);
    if (studentWhere) where.studentProfile = { is: studentWhere };
    const staffWhere = buildStaffFilter(filters);
    if (staffWhere) where.staffProfile = { is: staffWhere };

    if (role) {
      where.role = role;
    } else if (allowedRoles) {
      where.role = { in: allowedRoles };
    }

    if (status) {
      where.status = status;
    }

    // Search by name or email
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        {
          studentProfile: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        {
          staffProfile: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100); // Max 100 per page

    // Get total count
    const total = await this.prisma.user.count({ where });

    // Get users
    const users = await this.prisma.user.findMany({
      where,
      skip,
      take,
      include: {
        studentProfile: true,
        staffProfile: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Remove passwordHash from all users
    const usersWithoutPasswords = users.map(({ passwordHash, ...user }) => user);

    // Calculate total pages
    const totalPages = Math.ceil(total / take);

    return {
      data: usersWithoutPasswords,
      meta: {
        total,
        page,
        limit: take,
        totalPages,
      },
    };
  }

  /**
   * Find a single user by ID with profile inclusion
   * 
   * Requirements:
   * - R1: Get user with profile data
   * - Excludes passwordHash from response
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        studentProfile: true,
        staffProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Remove passwordHash from response
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Update user account with uniqueness validation
   * 
   * Requirements:
   * - R1: Validate all required fields
   * - R1: Enforce uniqueness constraints for email, admissionId, staffId
   * - Profile updates are merged (not replaced)
   */
  async update(id: string, dto: UpdateUserDto) {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
      include: {
        studentProfile: true,
        staffProfile: true,
      },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Check email uniqueness if being updated
    if (dto.email && dto.email !== existingUser.email) {
      const emailTaken = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (emailTaken) {
        throw new ConflictException('Email address is already in use');
      }
    }

    // Check admissionId uniqueness if being updated
    if (
      dto.studentProfile?.admissionId &&
      existingUser.studentProfile &&
      dto.studentProfile.admissionId !== existingUser.studentProfile.admissionId
    ) {
      const admissionIdTaken = await this.prisma.student.findUnique({
        where: { admissionId: dto.studentProfile.admissionId },
      });

      if (admissionIdTaken) {
        throw new ConflictException('Admission ID is already in use');
      }
    }

    // Check staffId uniqueness if being updated
    if (
      dto.staffProfile?.staffId &&
      existingUser.staffProfile &&
      dto.staffProfile.staffId !== existingUser.staffProfile.staffId
    ) {
      const staffIdTaken = await this.prisma.staff.findUnique({
        where: { staffId: dto.staffProfile.staffId },
      });

      if (staffIdTaken) {
        throw new ConflictException('Staff ID is already in use');
      }
    }

    // Update user and profile
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.email && { email: dto.email }),
        ...(dto.status && { status: dto.status }),
        // Update student profile if provided
        ...(dto.studentProfile &&
          existingUser.studentProfile && {
            studentProfile: {
              update: {
                ...(dto.studentProfile.admissionId && {
                  admissionId: dto.studentProfile.admissionId,
                }),
                ...(dto.studentProfile.firstName && {
                  firstName: dto.studentProfile.firstName,
                }),
                ...(dto.studentProfile.lastName && {
                  lastName: dto.studentProfile.lastName,
                }),
                ...(dto.studentProfile.admissionDate && {
                  admissionDate: new Date(dto.studentProfile.admissionDate),
                }),
                ...(dto.studentProfile.dateOfBirth && {
                  dateOfBirth: new Date(dto.studentProfile.dateOfBirth),
                }),
                ...(dto.studentProfile.gender !== undefined && {
                  gender: dto.studentProfile.gender,
                }),
                ...(dto.studentProfile.phoneNumber !== undefined && {
                  phoneNumber: dto.studentProfile.phoneNumber,
                }),
                ...(dto.studentProfile.address !== undefined && {
                  address: dto.studentProfile.address,
                }),
                ...(dto.studentProfile.city !== undefined && {
                  city: dto.studentProfile.city,
                }),
                ...(dto.studentProfile.state !== undefined && {
                  state: dto.studentProfile.state,
                }),
                ...(dto.studentProfile.pincode !== undefined && {
                  pincode: dto.studentProfile.pincode,
                }),
              },
            },
          }),
        // Update staff profile if provided
        ...(dto.staffProfile &&
          existingUser.staffProfile && {
            staffProfile: {
              update: {
                ...(dto.staffProfile.staffId && {
                  staffId: dto.staffProfile.staffId,
                }),
                ...(dto.staffProfile.firstName && {
                  firstName: dto.staffProfile.firstName,
                }),
                ...(dto.staffProfile.lastName && {
                  lastName: dto.staffProfile.lastName,
                }),
                ...(dto.staffProfile.designation && {
                  designation: dto.staffProfile.designation,
                }),
                ...(dto.staffProfile.department && {
                  department: dto.staffProfile.department,
                }),
                ...(dto.staffProfile.category && {
                  category: dto.staffProfile.category,
                }),
                ...(dto.staffProfile.joiningDate && {
                  joiningDate: new Date(dto.staffProfile.joiningDate),
                }),
                ...(dto.staffProfile.phoneNumber !== undefined && {
                  phoneNumber: dto.staffProfile.phoneNumber,
                }),
                ...(dto.staffProfile.address !== undefined && {
                  address: dto.staffProfile.address,
                }),
              },
            },
          }),
      },
      include: {
        studentProfile: true,
        staffProfile: true,
      },
    });

    // Remove passwordHash from response
    const { passwordHash: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  /**
   * Activate user account
   * 
   * Requirements:
   * - R1: Set account status to ACTIVE
   * - R1: Grant authentication access
   */
  async activate(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.ACTIVE,
      },
      include: {
        studentProfile: true,
        staffProfile: true,
      },
    });

    // Remove passwordHash from response
    const { passwordHash: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  /**
   * Deactivate user account
   * 
   * Requirements:
   * - R1: Set account status to INACTIVE
   * - R1: Deny authentication access
   * - R1: Retain all historical records
   */
  async deactivate(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // R2.10: revoke every refresh token so no session can be renewed. Access tokens are already
    // rejected on the next request because JwtStrategy reloads the user and checks the status.
    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.INACTIVE,
      },
      include: {
        studentProfile: true,
        staffProfile: true,
      },
    });

    // Remove passwordHash from response
    const { passwordHash: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  /**
   * Reset a user's password (R36.4)
   *
   * Generates a temporary password, forces a change at next sign-in and signs the user out
   * everywhere. The temporary password is returned once and never stored in plain text.
   */
  async resetPassword(id: string, actingUserId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (actingUserId && actingUserId === id) {
      throw new BadRequestException('Use Change password to change your own password');
    }
    if (user.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Super admin passwords cannot be reset from here');
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, this.BCRYPT_SALT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          passwordHash,
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId: id } }),
    ]);

    return { userId: id, email: user.email, temporaryPassword };
  }
}

const contains = (value: string) => ({ contains: value.trim(), mode: 'insensitive' as const });

/** Student-only filters (R1.11). Returns null when none are set. */
export function buildStudentFilter(f: FilterUsersDto): Record<string, unknown> | null {
  const where: Record<string, any> = {};
  if (f.admissionId?.trim()) where.admissionId = contains(f.admissionId);
  if (f.classId) where.classEnrollments = { some: { classId: f.classId, status: 'ACTIVE' } };
  if (f.admissionDateFrom || f.admissionDateTo) {
    where.admissionDate = {
      ...(f.admissionDateFrom && { gte: new Date(f.admissionDateFrom) }),
      ...(f.admissionDateTo && { lte: new Date(f.admissionDateTo) }),
    };
  }
  return Object.keys(where).length ? where : null;
}

/** Staff-only filters (R1.12). Returns null when none are set. */
export function buildStaffFilter(f: FilterUsersDto): Record<string, unknown> | null {
  const where: Record<string, any> = {};
  if (f.staffId?.trim()) where.staffId = contains(f.staffId);
  if (f.department?.trim()) where.department = contains(f.department);
  if (f.designation?.trim()) where.designation = contains(f.designation);
  if (f.category) where.category = f.category;
  return Object.keys(where).length ? where : null;
}
