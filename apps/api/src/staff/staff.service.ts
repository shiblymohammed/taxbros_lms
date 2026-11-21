import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { GetStaffQueryDto } from './dto/get-staff-query.dto';
import { StaffPermissionType } from '@prisma/client';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new staff profile
   * Validates staffId uniqueness
   */
  async create(userId: string, dto: CreateStaffDto) {
    // Check if staff with this staffId already exists
    const existingStaff = await this.prisma.staff.findUnique({
      where: { staffId: dto.staffId },
    });

    if (existingStaff) {
      throw new ConflictException('Staff ID already exists');
    }

    // Check if user already has a staff profile
    const existingProfile = await this.prisma.staff.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      throw new ConflictException('User already has a staff profile');
    }

    return this.prisma.staff.create({
      data: {
        userId,
        staffId: dto.staffId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        designation: dto.designation,
        department: dto.department,
        category: dto.category,
        joiningDate: new Date(dto.joiningDate),
        phoneNumber: dto.phoneNumber,
        address: dto.address,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Get all staff with filtering and pagination
   */
  async findAll(query: GetStaffQueryDto) {
    const { department, category, search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (department) {
      where.department = department;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { staffId: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [staff, total] = await Promise.all([
      this.prisma.staff.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
            },
          },
          permissions: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.staff.count({ where }),
    ]);

    return {
      data: staff,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single staff by ID
   */
  async findOne(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
          },
        },
        permissions: {
          orderBy: {
            grantedAt: 'desc',
          },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    return staff;
  }

  /**
   * Get staff by staffId
   */
  async findByStaffId(staffId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { staffId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
          },
        },
        permissions: true,
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    return staff;
  }

  /**
   * Get staff by userId
   */
  async findByUserId(userId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
          },
        },
        permissions: true,
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff profile not found for this user');
    }

    return staff;
  }

  /**
   * Update staff profile
   */
  async update(id: string, dto: UpdateStaffDto) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    // If updating staffId, check uniqueness
    if (dto.staffId && dto.staffId !== staff.staffId) {
      const existingStaff = await this.prisma.staff.findUnique({
        where: { staffId: dto.staffId },
      });

      if (existingStaff) {
        throw new ConflictException('Staff ID already exists');
      }
    }

    return this.prisma.staff.update({
      where: { id },
      data: {
        ...(dto.staffId && { staffId: dto.staffId }),
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.designation && { designation: dto.designation }),
        ...(dto.department && { department: dto.department }),
        ...(dto.category && { category: dto.category }),
        ...(dto.joiningDate && { joiningDate: new Date(dto.joiningDate) }),
        ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
        ...(dto.address !== undefined && { address: dto.address }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
          },
        },
        permissions: true,
      },
    });
  }

  /**
   * Delete staff profile
   */
  async remove(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    await this.prisma.staff.delete({
      where: { id },
    });

    return { message: 'Staff profile deleted successfully' };
  }

  /**
   * Grant permission to staff
   */
  async grantPermission(
    staffId: string,
    permission: StaffPermissionType,
    grantedBy: string,
  ) {
    // Verify staff exists
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    // Check if permission already exists
    const existingPermission = await this.prisma.staffPermission.findUnique({
      where: {
        staffId_permission: {
          staffId,
          permission,
        },
      },
    });

    if (existingPermission) {
      throw new ConflictException('Permission already granted to this staff member');
    }

    return this.prisma.staffPermission.create({
      data: {
        staffId,
        permission,
        grantedBy,
      },
    });
  }

  /**
   * Revoke permission from staff
   */
  async revokePermission(staffId: string, permissionId: string) {
    const permission = await this.prisma.staffPermission.findUnique({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    if (permission.staffId !== staffId) {
      throw new BadRequestException('Permission does not belong to this staff member');
    }

    await this.prisma.staffPermission.delete({
      where: { id: permissionId },
    });

    return { message: 'Permission revoked successfully' };
  }

  /**
   * Get all permissions for a staff member
   */
  async getPermissions(staffId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    const permissions = await this.prisma.staffPermission.findMany({
      where: { staffId },
      orderBy: {
        grantedAt: 'desc',
      },
    });

    return permissions;
  }

  /**
   * Check if staff has a specific permission
   */
  async hasPermission(
    staffId: string,
    permission: StaffPermissionType,
  ): Promise<boolean> {
    const permissionRecord = await this.prisma.staffPermission.findUnique({
      where: {
        staffId_permission: {
          staffId,
          permission,
        },
      },
    });

    return !!permissionRecord;
  }
}
