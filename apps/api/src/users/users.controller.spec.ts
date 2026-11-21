import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRole, UserStatus, StaffCategory } from '@prisma/client';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateUserDto, UpdateUserDto, FilterUsersDto } from './dto';
import { StaffAccessService } from '../auth/staff-access.service';

const adminReq = { user: { userId: 'admin-uuid', role: 'ADMINISTRATOR' } };

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    activate: jest.fn(),
    deactivate: jest.fn(),
  };

  const mockUser = {
    id: 'user-uuid',
    email: 'test@example.com',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
    mustChangePassword: true,
    lastLoginAt: null,
    passwordResetToken: null,
    passwordResetExpiry: null,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    createdBy: 'admin-uuid',
    studentProfile: {
      id: 'student-uuid',
      userId: 'user-uuid',
      admissionId: 'STU2024001',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: null,
      gender: null,
      phoneNumber: null,
      address: null,
      city: null,
      state: null,
      pincode: null,
      admissionDate: new Date('2024-01-15'),
      createdAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-15T10:00:00Z'),
    },
    staffProfile: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: StaffAccessService,
          useValue: {
            permissionsOf: jest.fn().mockResolvedValue([]),
            manageableRoles: jest.fn().mockResolvedValue(null),
            assertAny: jest.fn(),
            assertCanCreate: jest.fn(),
            assertCanManageUser: jest.fn(),
            assertCanManageProfile: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a student user', async () => {
      const createDto: CreateUserDto = {
        email: 'test@example.com',
        password: 'SecurePass123',
        role: UserRole.STUDENT,
        studentProfile: {
          admissionId: 'STU2024001',
          firstName: 'John',
          lastName: 'Doe',
          admissionDate: '2024-01-15',
        },
      };

      mockUsersService.create.mockResolvedValue(mockUser);

      const result = await controller.create(createDto, 'admin-uuid', adminReq);

      expect(result).toEqual(mockUser);
      expect(service.create).toHaveBeenCalledWith(createDto, 'admin-uuid');
    });

    it('should create a staff user', async () => {
      const createDto: CreateUserDto = {
        email: 'staff@example.com',
        password: 'SecurePass123',
        role: UserRole.STAFF,
        staffProfile: {
          staffId: 'STF2024001',
          firstName: 'Jane',
          lastName: 'Smith',
          designation: 'Teacher',
          department: 'Mathematics',
          category: StaffCategory.TEACHING,
          joiningDate: '2024-01-15',
        },
      };

      const staffUser = {
        ...mockUser,
        role: UserRole.STAFF,
        email: 'staff@example.com',
        studentProfile: null,
        staffProfile: {
          id: 'staff-uuid',
          userId: 'user-uuid',
          staffId: 'STF2024001',
          firstName: 'Jane',
          lastName: 'Smith',
          designation: 'Teacher',
          department: 'Mathematics',
          category: StaffCategory.TEACHING,
          joiningDate: new Date('2024-01-15'),
          phoneNumber: null,
          address: null,
          createdAt: new Date('2024-01-15T10:00:00Z'),
          updatedAt: new Date('2024-01-15T10:00:00Z'),
        },
      };

      mockUsersService.create.mockResolvedValue(staffUser);

      const result = await controller.create(createDto, 'admin-uuid', adminReq);

      expect(result).toEqual(staffUser);
      expect(service.create).toHaveBeenCalledWith(createDto, 'admin-uuid');
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const filters: FilterUsersDto = {
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        page: 1,
        limit: 10,
      };

      const paginatedResult = {
        data: [mockUser],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      mockUsersService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(filters, adminReq);

      expect(result).toEqual(paginatedResult);
      expect(service.findAll).toHaveBeenCalledWith(filters);
    });

    it('should search users by name', async () => {
      const filters: FilterUsersDto = {
        search: 'john',
        page: 1,
        limit: 10,
      };

      const paginatedResult = {
        data: [mockUser],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      mockUsersService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(filters, adminReq);

      expect(result).toEqual(paginatedResult);
      expect(service.findAll).toHaveBeenCalledWith(filters);
    });
  });

  describe('findOne', () => {
    it('should return a single user by id', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne('user-uuid', adminReq);

      expect(result).toEqual(mockUser);
      expect(service.findOne).toHaveBeenCalledWith('user-uuid');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUsersService.findOne.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(controller.findOne('nonexistent-uuid', adminReq)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update user profile', async () => {
      const updateDto: UpdateUserDto = {
        studentProfile: {
          firstName: 'Jane',
          phoneNumber: '1234567890',
        },
      };

      const updatedUser = {
        ...mockUser,
        studentProfile: {
          ...mockUser.studentProfile,
          firstName: 'Jane',
          phoneNumber: '1234567890',
        },
      };

      mockUsersService.update.mockResolvedValue(updatedUser);

      const result = await controller.update('user-uuid', updateDto, adminReq);

      expect(result).toEqual(updatedUser);
      expect(service.update).toHaveBeenCalledWith('user-uuid', updateDto);
    });

    it('should update user email', async () => {
      const updateDto: UpdateUserDto = {
        email: 'newemail@example.com',
      };

      const updatedUser = {
        ...mockUser,
        email: 'newemail@example.com',
      };

      mockUsersService.update.mockResolvedValue(updatedUser);

      const result = await controller.update('user-uuid', updateDto, adminReq);

      expect(result).toEqual(updatedUser);
      expect(service.update).toHaveBeenCalledWith('user-uuid', updateDto);
    });

    it('should throw ConflictException if email already exists', async () => {
      const updateDto: UpdateUserDto = {
        email: 'existing@example.com',
      };

      mockUsersService.update.mockRejectedValue(
        new ConflictException('Email address is already in use'),
      );

      await expect(
        controller.update('user-uuid', updateDto, adminReq),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('activate', () => {
    it('should activate user account', async () => {
      const activatedUser = {
        ...mockUser,
        status: UserStatus.ACTIVE,
      };

      mockUsersService.activate.mockResolvedValue(activatedUser);

      const result = await controller.activate('user-uuid', adminReq);

      expect(result).toEqual(activatedUser);
      expect(result.status).toBe(UserStatus.ACTIVE);
      expect(service.activate).toHaveBeenCalledWith('user-uuid');
    });
  });

  describe('deactivate', () => {
    it('should deactivate user account', async () => {
      const deactivatedUser = {
        ...mockUser,
        status: UserStatus.INACTIVE,
      };

      mockUsersService.deactivate.mockResolvedValue(deactivatedUser);

      const result = await controller.deactivate('user-uuid', adminReq);

      expect(result).toEqual(deactivatedUser);
      expect(result.status).toBe(UserStatus.INACTIVE);
      expect(service.deactivate).toHaveBeenCalledWith('user-uuid');
    });
  });
});
