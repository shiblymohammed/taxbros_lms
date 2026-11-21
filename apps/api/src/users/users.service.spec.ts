import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus, StaffCategory } from '@prisma/client';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateUserDto, UpdateUserDto, FilterUsersDto } from './dto';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    student: {
      findUnique: jest.fn(),
    },
    refreshToken: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    staff: {
      findUnique: jest.fn(),
    },
  };

  const mockUser = {
    id: 'user-uuid',
    email: 'test@example.com',
    passwordHash: 'hashedPassword',
    role: UserRole.STUDENT,
    status: UserStatus.PENDING,
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
    refreshTokens: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    // Reset mocks
    jest.clearAllMocks();

    // Mock bcrypt hash
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a student user successfully', async () => {
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

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.student.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const result = await service.create(createDto, 'admin-uuid');

      expect(result.email).toBe('test@example.com');
      expect(result.role).toBe(UserRole.STUDENT);
      expect(result).not.toHaveProperty('passwordHash');
      expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass123', 12);
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if student profile missing for STUDENT role', async () => {
      const createDto: CreateUserDto = {
        email: 'test@example.com',
        password: 'SecurePass123',
        role: UserRole.STUDENT,
      };

      await expect(service.create(createDto, 'admin-uuid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if staff profile missing for STAFF role', async () => {
      const createDto: CreateUserDto = {
        email: 'test@example.com',
        password: 'SecurePass123',
        role: UserRole.STAFF,
      };

      await expect(service.create(createDto, 'admin-uuid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      const createDto: CreateUserDto = {
        email: 'existing@example.com',
        password: 'SecurePass123',
        role: UserRole.STUDENT,
        studentProfile: {
          admissionId: 'STU2024001',
          firstName: 'John',
          lastName: 'Doe',
          admissionDate: '2024-01-15',
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.create(createDto, 'admin-uuid')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'existing@example.com' },
      });
    });

    it('should throw ConflictException if admissionId already exists', async () => {
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

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.student.findUnique.mockResolvedValue({
        id: 'existing-student-uuid',
        admissionId: 'STU2024001',
      });

      await expect(service.create(createDto, 'admin-uuid')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if staffId already exists', async () => {
      const createDto: CreateUserDto = {
        email: 'test@example.com',
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

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.staff.findUnique.mockResolvedValue({
        id: 'existing-staff-uuid',
        staffId: 'STF2024001',
      });

      await expect(service.create(createDto, 'admin-uuid')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated users with metadata', async () => {
      const filters: FilterUsersDto = {
        page: 1,
        limit: 10,
      };

      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.findAll(filters);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).not.toHaveProperty('passwordHash');
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should filter by role', async () => {
      const filters: FilterUsersDto = {
        role: UserRole.STUDENT,
        page: 1,
        limit: 10,
      };

      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);

      await service.findAll(filters);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: UserRole.STUDENT,
          }),
        }),
      );
    });

    it('should filter by status', async () => {
      const filters: FilterUsersDto = {
        status: UserStatus.ACTIVE,
        page: 1,
        limit: 10,
      };

      mockPrismaService.user.count.mockResolvedValue(0);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      await service.findAll(filters);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: UserStatus.ACTIVE,
          }),
        }),
      );
    });

    it('should search by name or email', async () => {
      const filters: FilterUsersDto = {
        search: 'john',
        page: 1,
        limit: 10,
      };

      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);

      await service.findAll(filters);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne('user-uuid');

      expect(result.id).toBe('user-uuid');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update user email', async () => {
      const updateDto: UpdateUserDto = {
        email: 'newemail@example.com',
      };

      const updatedUser = {
        ...mockUser,
        email: 'newemail@example.com',
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser) // First call to check if user exists
        .mockResolvedValueOnce(null); // Second call to check email uniqueness

      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update('user-uuid', updateDto);

      expect(result.email).toBe('newemail@example.com');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-uuid', { email: 'new@example.com' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if new email already exists', async () => {
      const updateDto: UpdateUserDto = {
        email: 'existing@example.com',
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ id: 'other-user-uuid', email: 'existing@example.com' });

      await expect(service.update('user-uuid', updateDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('activate', () => {
    it('should activate user account', async () => {
      const activatedUser = {
        ...mockUser,
        status: UserStatus.ACTIVE,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(activatedUser);

      const result = await service.activate('user-uuid');

      expect(result.status).toBe(UserStatus.ACTIVE);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.activate('nonexistent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deactivate', () => {
    it('should deactivate user account', async () => {
      const deactivatedUser = {
        ...mockUser,
        status: UserStatus.INACTIVE,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(deactivatedUser);

      const result = await service.deactivate('user-uuid');

      expect(result.status).toBe(UserStatus.INACTIVE);
      expect(result).not.toHaveProperty('passwordHash');
      // R2.10: every session is revoked
      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: mockUser.id } });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('nonexistent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
