import { Test, TestingModule } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { StaffCategory, StaffPermissionType } from '@prisma/client';

describe('StaffService', () => {
  let service: StaffService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    staff: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    staffPermission: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      staffId: 'STF001',
      firstName: 'John',
      lastName: 'Doe',
      designation: 'Professor',
      department: 'Computer Science',
      category: StaffCategory.TEACHING,
      joiningDate: '2024-01-15',
      phoneNumber: '1234567890',
      address: '123 Main St',
    };

    const userId = 'user-123';

    it('should create a staff profile successfully', async () => {
      const mockStaff = {
        id: 'staff-123',
        userId,
        ...createDto,
        joiningDate: new Date(createDto.joiningDate),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: userId,
          email: 'john@example.com',
          role: 'STAFF',
          status: 'ACTIVE',
        },
      };

      mockPrismaService.staff.findUnique.mockResolvedValue(null);
      mockPrismaService.staff.create.mockResolvedValue(mockStaff);

      const result = await service.create(userId, createDto);

      expect(result).toEqual(mockStaff);
      expect(prismaService.staff.findUnique).toHaveBeenCalledTimes(2);
      expect(prismaService.staff.create).toHaveBeenCalledWith({
        data: {
          userId,
          staffId: createDto.staffId,
          firstName: createDto.firstName,
          lastName: createDto.lastName,
          designation: createDto.designation,
          department: createDto.department,
          category: createDto.category,
          joiningDate: new Date(createDto.joiningDate),
          phoneNumber: createDto.phoneNumber,
          address: createDto.address,
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
    });

    it('should throw ConflictException if staffId already exists', async () => {
      mockPrismaService.staff.findUnique.mockResolvedValueOnce({
        id: 'existing-staff',
        staffId: createDto.staffId,
      });

      await expect(service.create(userId, createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaService.staff.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if user already has a staff profile', async () => {
      mockPrismaService.staff.findUnique
        .mockResolvedValueOnce(null) // staffId check
        .mockResolvedValueOnce({ id: 'existing-profile', userId }); // userId check

      await expect(service.create(userId, createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaService.staff.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated staff list with filters', async () => {
      const mockStaff = [
        {
          id: 'staff-1',
          staffId: 'STF001',
          firstName: 'John',
          lastName: 'Doe',
          department: 'Computer Science',
          category: StaffCategory.TEACHING,
          user: { id: 'user-1', email: 'john@example.com' },
          permissions: [],
        },
      ];

      mockPrismaService.staff.findMany.mockResolvedValue(mockStaff);
      mockPrismaService.staff.count.mockResolvedValue(1);

      const query = {
        department: 'Computer Science',
        category: StaffCategory.TEACHING,
        page: 1,
        limit: 10,
      };

      const result = await service.findAll(query);

      expect(result.data).toEqual(mockStaff);
      expect(result.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should support search filter', async () => {
      mockPrismaService.staff.findMany.mockResolvedValue([]);
      mockPrismaService.staff.count.mockResolvedValue(0);

      await service.findAll({ search: 'John' });

      expect(prismaService.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { firstName: { contains: 'John', mode: 'insensitive' } },
              { lastName: { contains: 'John', mode: 'insensitive' } },
              { staffId: { contains: 'John', mode: 'insensitive' } },
              { designation: { contains: 'John', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a staff member by id', async () => {
      const mockStaff = {
        id: 'staff-123',
        staffId: 'STF001',
        firstName: 'John',
        lastName: 'Doe',
        user: { id: 'user-1', email: 'john@example.com' },
        permissions: [],
      };

      mockPrismaService.staff.findUnique.mockResolvedValue(mockStaff);

      const result = await service.findOne('staff-123');

      expect(result).toEqual(mockStaff);
      expect(prismaService.staff.findUnique).toHaveBeenCalledWith({
        where: { id: 'staff-123' },
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
    });

    it('should throw NotFoundException if staff not found', async () => {
      mockPrismaService.staff.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateDto = {
      firstName: 'Jane',
      designation: 'Senior Professor',
    };

    it('should update staff profile successfully', async () => {
      const existingStaff = {
        id: 'staff-123',
        staffId: 'STF001',
        firstName: 'John',
      };

      const updatedStaff = {
        ...existingStaff,
        ...updateDto,
        user: { id: 'user-1', email: 'john@example.com' },
        permissions: [],
      };

      mockPrismaService.staff.findUnique.mockResolvedValue(existingStaff);
      mockPrismaService.staff.update.mockResolvedValue(updatedStaff);

      const result = await service.update('staff-123', updateDto);

      expect(result).toEqual(updatedStaff);
      expect(prismaService.staff.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if staff not found', async () => {
      mockPrismaService.staff.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should validate staffId uniqueness when updating', async () => {
      const existingStaff = { id: 'staff-123', staffId: 'STF001' };
      const conflictingStaff = { id: 'staff-456', staffId: 'STF002' };

      mockPrismaService.staff.findUnique
        .mockResolvedValueOnce(existingStaff)
        .mockResolvedValueOnce(conflictingStaff);

      await expect(
        service.update('staff-123', { staffId: 'STF002' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete staff profile successfully', async () => {
      const mockStaff = { id: 'staff-123', staffId: 'STF001' };

      mockPrismaService.staff.findUnique.mockResolvedValue(mockStaff);
      mockPrismaService.staff.delete.mockResolvedValue(mockStaff);

      const result = await service.remove('staff-123');

      expect(result).toEqual({ message: 'Staff profile deleted successfully' });
      expect(prismaService.staff.delete).toHaveBeenCalledWith({
        where: { id: 'staff-123' },
      });
    });

    it('should throw NotFoundException if staff not found', async () => {
      mockPrismaService.staff.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('grantPermission', () => {
    const staffId = 'staff-123';
    const permission = StaffPermissionType.MARK_ATTENDANCE;
    const grantedBy = 'admin-123';

    it('should grant permission successfully', async () => {
      const mockStaff = { id: staffId, staffId: 'STF001' };
      const mockPermission = {
        id: 'perm-123',
        staffId,
        permission,
        grantedBy,
        grantedAt: new Date(),
      };

      mockPrismaService.staff.findUnique.mockResolvedValue(mockStaff);
      mockPrismaService.staffPermission.findUnique.mockResolvedValue(null);
      mockPrismaService.staffPermission.create.mockResolvedValue(mockPermission);

      const result = await service.grantPermission(staffId, permission, grantedBy);

      expect(result).toEqual(mockPermission);
      expect(prismaService.staffPermission.create).toHaveBeenCalledWith({
        data: {
          staffId,
          permission,
          grantedBy,
        },
      });
    });

    it('should throw NotFoundException if staff not found', async () => {
      mockPrismaService.staff.findUnique.mockResolvedValue(null);

      await expect(
        service.grantPermission(staffId, permission, grantedBy),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if permission already exists', async () => {
      const mockStaff = { id: staffId, staffId: 'STF001' };
      const existingPermission = { id: 'perm-123', staffId, permission };

      mockPrismaService.staff.findUnique.mockResolvedValue(mockStaff);
      mockPrismaService.staffPermission.findUnique.mockResolvedValue(
        existingPermission,
      );

      await expect(
        service.grantPermission(staffId, permission, grantedBy),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('revokePermission', () => {
    const staffId = 'staff-123';
    const permissionId = 'perm-123';

    it('should revoke permission successfully', async () => {
      const mockPermission = {
        id: permissionId,
        staffId,
        permission: StaffPermissionType.MARK_ATTENDANCE,
      };

      mockPrismaService.staffPermission.findUnique.mockResolvedValue(
        mockPermission,
      );
      mockPrismaService.staffPermission.delete.mockResolvedValue(mockPermission);

      const result = await service.revokePermission(staffId, permissionId);

      expect(result).toEqual({ message: 'Permission revoked successfully' });
      expect(prismaService.staffPermission.delete).toHaveBeenCalledWith({
        where: { id: permissionId },
      });
    });

    it('should throw NotFoundException if permission not found', async () => {
      mockPrismaService.staffPermission.findUnique.mockResolvedValue(null);

      await expect(
        service.revokePermission(staffId, permissionId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if permission does not belong to staff', async () => {
      const mockPermission = {
        id: permissionId,
        staffId: 'different-staff',
        permission: StaffPermissionType.MARK_ATTENDANCE,
      };

      mockPrismaService.staffPermission.findUnique.mockResolvedValue(
        mockPermission,
      );

      await expect(
        service.revokePermission(staffId, permissionId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPermissions', () => {
    it('should return all permissions for a staff member', async () => {
      const staffId = 'staff-123';
      const mockStaff = { id: staffId, staffId: 'STF001' };
      const mockPermissions = [
        {
          id: 'perm-1',
          staffId,
          permission: StaffPermissionType.MARK_ATTENDANCE,
          grantedAt: new Date(),
        },
        {
          id: 'perm-2',
          staffId,
          permission: StaffPermissionType.VIEW_REPORTS,
          grantedAt: new Date(),
        },
      ];

      mockPrismaService.staff.findUnique.mockResolvedValue(mockStaff);
      mockPrismaService.staffPermission.findMany.mockResolvedValue(
        mockPermissions,
      );

      const result = await service.getPermissions(staffId);

      expect(result).toEqual(mockPermissions);
      expect(prismaService.staffPermission.findMany).toHaveBeenCalledWith({
        where: { staffId },
        orderBy: {
          grantedAt: 'desc',
        },
      });
    });

    it('should throw NotFoundException if staff not found', async () => {
      mockPrismaService.staff.findUnique.mockResolvedValue(null);

      await expect(service.getPermissions('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('hasPermission', () => {
    it('should return true if staff has the permission', async () => {
      const staffId = 'staff-123';
      const permission = StaffPermissionType.MARK_ATTENDANCE;
      const mockPermission = { id: 'perm-123', staffId, permission };

      mockPrismaService.staffPermission.findUnique.mockResolvedValue(
        mockPermission,
      );

      const result = await service.hasPermission(staffId, permission);

      expect(result).toBe(true);
    });

    it('should return false if staff does not have the permission', async () => {
      mockPrismaService.staffPermission.findUnique.mockResolvedValue(null);

      const result = await service.hasPermission(
        'staff-123',
        StaffPermissionType.MARK_ATTENDANCE,
      );

      expect(result).toBe(false);
    });
  });
});
