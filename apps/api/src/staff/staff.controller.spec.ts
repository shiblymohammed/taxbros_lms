import { Test, TestingModule } from '@nestjs/testing';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffCategory, StaffPermissionType, UserRole } from '@prisma/client';
import { StaffAccessService } from '../auth/staff-access.service';

const adminReq = { user: { userId: 'admin-uuid', role: 'ADMINISTRATOR' } };

describe('StaffController', () => {
  let controller: StaffController;
  let service: StaffService;

  const mockStaffService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    grantPermission: jest.fn(),
    revokePermission: jest.fn(),
    getPermissions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaffController],
      providers: [
        {
          provide: StaffAccessService,
          useValue: { assertAny: jest.fn(), assertCanManageProfile: jest.fn() },
        },
        {
          provide: StaffService,
          useValue: mockStaffService,
        },
      ],
    }).compile();

    controller = module.get<StaffController>(StaffController);
    service = module.get<StaffService>(StaffService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a staff profile', async () => {
      const dto = {
        userId: 'user-123',
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

      const mockResult = {
        id: 'staff-123',
        ...dto,
        joiningDate: new Date(dto.joiningDate),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: dto.userId,
          email: 'john@example.com',
          role: UserRole.STAFF,
          status: 'ACTIVE',
        },
      };

      mockStaffService.create.mockResolvedValue(mockResult);

      const result = await controller.create(dto);

      expect(result).toEqual(mockResult);
      expect(service.create).toHaveBeenCalledWith(dto.userId, {
        staffId: dto.staffId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        designation: dto.designation,
        department: dto.department,
        category: dto.category,
        joiningDate: dto.joiningDate,
        phoneNumber: dto.phoneNumber,
        address: dto.address,
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated staff list', async () => {
      const query = {
        department: 'Computer Science',
        category: StaffCategory.TEACHING,
        page: 1,
        limit: 10,
      };

      const mockResult = {
        data: [
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
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      mockStaffService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(query, adminReq);

      expect(result).toEqual(mockResult);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should support search query', async () => {
      const query = {
        search: 'John',
        page: 1,
        limit: 10,
      };

      mockStaffService.findAll.mockResolvedValue({
        data: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      await controller.findAll(query, adminReq);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return a single staff member', async () => {
      const staffId = 'staff-123';
      const mockResult = {
        id: staffId,
        staffId: 'STF001',
        firstName: 'John',
        lastName: 'Doe',
        designation: 'Professor',
        department: 'Computer Science',
        category: StaffCategory.TEACHING,
        user: { id: 'user-1', email: 'john@example.com' },
        permissions: [],
      };

      mockStaffService.findOne.mockResolvedValue(mockResult);

      const result = await controller.findOne(staffId, adminReq);

      expect(result).toEqual(mockResult);
      expect(service.findOne).toHaveBeenCalledWith(staffId);
    });
  });

  describe('update', () => {
    it('should update a staff profile', async () => {
      const staffId = 'staff-123';
      const dto = {
        firstName: 'Jane',
        designation: 'Senior Professor',
      };

      const mockResult = {
        id: staffId,
        staffId: 'STF001',
        firstName: 'Jane',
        lastName: 'Doe',
        designation: 'Senior Professor',
        department: 'Computer Science',
        category: StaffCategory.TEACHING,
        user: { id: 'user-1', email: 'jane@example.com' },
        permissions: [],
      };

      mockStaffService.update.mockResolvedValue(mockResult);

      const result = await controller.update(staffId, dto, adminReq);

      expect(result).toEqual(mockResult);
      expect(service.update).toHaveBeenCalledWith(staffId, dto);
    });
  });

  describe('remove', () => {
    it('should delete a staff profile', async () => {
      const staffId = 'staff-123';
      const mockResult = { message: 'Staff profile deleted successfully' };

      mockStaffService.remove.mockResolvedValue(mockResult);

      const result = await controller.remove(staffId, adminReq);

      expect(result).toEqual(mockResult);
      expect(service.remove).toHaveBeenCalledWith(staffId);
    });
  });

  describe('grantPermission', () => {
    it('should grant permission to staff', async () => {
      const staffId = 'staff-123';
      const dto = { permission: StaffPermissionType.MARK_ATTENDANCE };
      const mockRequest = { user: { userId: 'admin-123' } };

      const mockResult = {
        id: 'perm-123',
        staffId,
        permission: dto.permission,
        grantedBy: 'admin-123',
        grantedAt: new Date(),
      };

      mockStaffService.grantPermission.mockResolvedValue(mockResult);

      const result = await controller.grantPermission(staffId, dto, mockRequest);

      expect(result).toEqual(mockResult);
      expect(service.grantPermission).toHaveBeenCalledWith(
        staffId,
        dto.permission,
        'admin-123',
      );
    });
  });

  describe('revokePermission', () => {
    it('should revoke permission from staff', async () => {
      const staffId = 'staff-123';
      const permissionId = 'perm-123';
      const mockResult = { message: 'Permission revoked successfully' };

      mockStaffService.revokePermission.mockResolvedValue(mockResult);

      const result = await controller.revokePermission(staffId, permissionId);

      expect(result).toEqual(mockResult);
      expect(service.revokePermission).toHaveBeenCalledWith(
        staffId,
        permissionId,
      );
    });
  });

  describe('getPermissions', () => {
    it('should return all permissions for a staff member', async () => {
      const staffId = 'staff-123';
      const mockResult = [
        {
          id: 'perm-1',
          staffId,
          permission: StaffPermissionType.MARK_ATTENDANCE,
          grantedBy: 'admin-123',
          grantedAt: new Date(),
        },
        {
          id: 'perm-2',
          staffId,
          permission: StaffPermissionType.VIEW_REPORTS,
          grantedBy: 'admin-123',
          grantedAt: new Date(),
        },
      ];

      mockStaffService.getPermissions.mockResolvedValue(mockResult);

      const result = await controller.getPermissions(staffId);

      expect(result).toEqual(mockResult);
      expect(service.getPermissions).toHaveBeenCalledWith(staffId);
    });
  });
});
