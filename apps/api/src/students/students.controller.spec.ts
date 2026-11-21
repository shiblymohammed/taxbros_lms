import { Test, TestingModule } from '@nestjs/testing';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { UserRole, UserStatus } from '@prisma/client';
import { StaffAccessService } from '../auth/staff-access.service';

const adminReq = { user: { userId: 'admin-uuid', role: 'ADMINISTRATOR' } };

describe('StudentsController', () => {
  let controller: StudentsController;
  let service: StudentsService;

  const mockStudentsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentsController],
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
          provide: StudentsService,
          useValue: mockStudentsService,
        },
      ],
    }).compile();

    controller = module.get<StudentsController>(StudentsController);
    service = module.get<StudentsService>(StudentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a student account', async () => {
      const createDto = {
        email: 'student@example.com',
        password: 'SecurePass123',
        admissionId: 'STU2024001',
        firstName: 'John',
        lastName: 'Doe',
        admissionDate: '2024-01-15',
      };

      const expectedResult = {
        id: 'student-uuid',
        userId: 'user-uuid',
        admissionId: createDto.admissionId,
        firstName: createDto.firstName,
        lastName: createDto.lastName,
        admissionDate: new Date(createDto.admissionDate),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: 'user-uuid',
          email: createDto.email,
          role: UserRole.STUDENT,
          status: UserStatus.PENDING,
          mustChangePassword: true,
        },
      };

      mockStudentsService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createDto, 'admin-uuid', adminReq);

      expect(service.create).toHaveBeenCalledWith(createDto, 'admin-uuid');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findAll', () => {
    it('should return paginated students', async () => {
      const filters = {
        search: 'john',
        page: 1,
        limit: 10,
      };

      const expectedResult = {
        data: [
          {
            id: 'student-uuid',
            userId: 'user-uuid',
            admissionId: 'STU2024001',
            firstName: 'John',
            lastName: 'Doe',
            user: {
              id: 'user-uuid',
              email: 'john@example.com',
              role: UserRole.STUDENT,
              status: UserStatus.ACTIVE,
            },
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      mockStudentsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(filters, adminReq);

      expect(service.findAll).toHaveBeenCalledWith(filters);
      expect(result).toEqual(expectedResult);
    });

    it('should handle filtering by class ID', async () => {
      const filters = {
        classId: 'class-uuid',
        page: 1,
        limit: 10,
      };

      mockStudentsService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      await controller.findAll(filters, adminReq);

      expect(service.findAll).toHaveBeenCalledWith(filters);
    });

    it('should handle filtering by date range', async () => {
      const filters = {
        admissionDateFrom: '2024-01-01',
        admissionDateTo: '2024-12-31',
        page: 1,
        limit: 10,
      };

      mockStudentsService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      await controller.findAll(filters, adminReq);

      expect(service.findAll).toHaveBeenCalledWith(filters);
    });
  });

  describe('findOne', () => {
    it('should return a single student', async () => {
      const studentId = 'student-uuid';
      const expectedResult = {
        id: studentId,
        userId: 'user-uuid',
        admissionId: 'STU2024001',
        firstName: 'John',
        lastName: 'Doe',
        admissionDate: new Date('2024-01-15'),
        user: {
          id: 'user-uuid',
          email: 'student@example.com',
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
        },
      };

      mockStudentsService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(studentId, { user: { userId: 'admin-1', role: UserRole.ADMINISTRATOR } });

      expect(service.findOne).toHaveBeenCalledWith(studentId, 'admin-1', UserRole.ADMINISTRATOR);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('update', () => {
    it('should update a student profile', async () => {
      const studentId = 'student-uuid';
      const updateDto = {
        firstName: 'Jane',
        phoneNumber: '9876543210',
      };

      const expectedResult = {
        id: studentId,
        userId: 'user-uuid',
        admissionId: 'STU2024001',
        firstName: 'Jane',
        lastName: 'Doe',
        phoneNumber: '9876543210',
        user: {
          id: 'user-uuid',
          email: 'student@example.com',
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
        },
      };

      mockStudentsService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(studentId, updateDto, adminReq);

      expect(service.update).toHaveBeenCalledWith(studentId, updateDto);
      expect(result).toEqual(expectedResult);
    });
  });
});
