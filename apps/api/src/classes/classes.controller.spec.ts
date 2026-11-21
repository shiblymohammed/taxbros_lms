import { Test, TestingModule } from '@nestjs/testing';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { ClassStatus, EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

describe('ClassesController', () => {
  let controller: ClassesController;
  let service: ClassesService;

  const mockClassesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    enrollStudent: jest.fn(),
    unenrollStudent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassesController],
      providers: [
        { provide: PrismaService, useValue: {} },
        {
          provide: ClassesService,
          useValue: mockClassesService,
        },
      ],
    }).compile();

    controller = module.get<ClassesController>(ClassesController);
    service = module.get<ClassesService>(ClassesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new class', async () => {
      const createDto = {
        name: 'Batch 2024 Morning',
        description: 'Morning batch',
      };

      const mockClass = {
        id: 'class-id',
        name: createDto.name,
        description: createDto.description,
        status: ClassStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockClassesService.create.mockResolvedValue(mockClass);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockClass);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return paginated list of classes', async () => {
      const query = { page: 1, limit: 10 };

      const mockResponse = {
        data: [
          {
            id: 'class-1',
            name: 'Class 1',
            description: 'Description 1',
            status: ClassStatus.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
            _count: { enrollments: 5 },
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      mockClassesService.findAll.mockResolvedValue(mockResponse);

      const result = await controller.findAll(query);

      expect(result).toEqual(mockResponse);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should filter by status when provided', async () => {
      const query = { status: ClassStatus.ACTIVE, page: 1, limit: 10 };

      mockClassesService.findAll.mockResolvedValue({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      });

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return a single class with active enrollments', async () => {
      const classId = 'class-id';

      const mockClass = {
        id: classId,
        name: 'Class 1',
        description: 'Description',
        status: ClassStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        enrollments: [
          {
            id: 'enrollment-1',
            studentId: 'student-1',
            classId: classId,
            status: EnrollmentStatus.ACTIVE,
            enrolledAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            student: {
              id: 'student-1',
              userId: 'user-1',
              admissionId: 'STU001',
              firstName: 'John',
              lastName: 'Doe',
              dateOfBirth: null,
              gender: null,
              phoneNumber: null,
              address: null,
              city: null,
              state: null,
              pincode: null,
              admissionDate: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
              user: {
                email: 'john@example.com',
                status: 'ACTIVE',
              },
            },
          },
        ],
      };

      mockClassesService.findOne.mockResolvedValue(mockClass);

      const result = await controller.findOne(classId);

      expect(result).toEqual(mockClass);
      expect(service.findOne).toHaveBeenCalledWith(classId);
    });
  });

  describe('update', () => {
    it('should update class details', async () => {
      const classId = 'class-id';
      const updateDto = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const mockClass = {
        id: classId,
        name: updateDto.name,
        description: updateDto.description,
        status: ClassStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockClassesService.update.mockResolvedValue(mockClass);

      const result = await controller.update(classId, updateDto);

      expect(result).toEqual(mockClass);
      expect(service.update).toHaveBeenCalledWith(classId, updateDto);
    });

    it('should archive a class', async () => {
      const classId = 'class-id';
      const updateDto = {
        status: ClassStatus.ARCHIVED,
      };

      const mockClass = {
        id: classId,
        name: 'Class 1',
        description: 'Description',
        status: ClassStatus.ARCHIVED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockClassesService.update.mockResolvedValue(mockClass);

      const result = await controller.update(classId, updateDto);

      expect(result.status).toBe(ClassStatus.ARCHIVED);
      expect(service.update).toHaveBeenCalledWith(classId, updateDto);
    });
  });

  describe('enrollStudent', () => {
    it('should enroll a student in a class', async () => {
      const classId = 'class-id';
      const enrollDto = { studentId: 'student-id' };

      const mockEnrollment = {
        id: 'enrollment-id',
        studentId: enrollDto.studentId,
        classId: classId,
        status: EnrollmentStatus.ACTIVE,
        enrolledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        student: {
          id: enrollDto.studentId,
          userId: 'user-id',
          admissionId: 'STU001',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: null,
          gender: null,
          phoneNumber: null,
          address: null,
          city: null,
          state: null,
          pincode: null,
          admissionDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            email: 'john@example.com',
            status: 'ACTIVE',
          },
        },
        class: {
          id: classId,
          name: 'Class 1',
          description: 'Description',
          status: ClassStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      mockClassesService.enrollStudent.mockResolvedValue(mockEnrollment);

      const result = await controller.enrollStudent(classId, enrollDto);

      expect(result).toEqual(mockEnrollment);
      expect(service.enrollStudent).toHaveBeenCalledWith(classId, enrollDto);
    });
  });

  describe('unenrollStudent', () => {
    it('should unenroll a student from a class', async () => {
      const classId = 'class-id';
      const studentId = 'student-id';

      const mockEnrollment = {
        id: 'enrollment-id',
        studentId: studentId,
        classId: classId,
        status: EnrollmentStatus.INACTIVE,
        enrolledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        student: {
          id: studentId,
          userId: 'user-id',
          admissionId: 'STU001',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: null,
          gender: null,
          phoneNumber: null,
          address: null,
          city: null,
          state: null,
          pincode: null,
          admissionDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            email: 'john@example.com',
            status: 'ACTIVE',
          },
        },
        class: {
          id: classId,
          name: 'Class 1',
          description: 'Description',
          status: ClassStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      mockClassesService.unenrollStudent.mockResolvedValue(mockEnrollment);

      const result = await controller.unenrollStudent(classId, studentId);

      expect(result.status).toBe(EnrollmentStatus.INACTIVE);
      expect(service.unenrollStudent).toHaveBeenCalledWith(classId, studentId);
    });
  });
});
