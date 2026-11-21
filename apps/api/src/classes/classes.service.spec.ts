import { Test, TestingModule } from '@nestjs/testing';
import { ClassesService } from './classes.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ClassStatus, EnrollmentStatus, Prisma } from '@prisma/client';

describe('ClassesService', () => {
  let service: ClassesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    class: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    classEnrollment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    student: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ClassesService>(ClassesService);
    prisma = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new class with unique name', async () => {
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

      mockPrismaService.class.create.mockResolvedValue(mockClass);

      const result = await service.create(createDto);

      expect(result).toEqual(mockClass);
      expect(prisma.class.create).toHaveBeenCalledWith({
        data: {
          name: createDto.name,
          description: createDto.description,
          status: ClassStatus.ACTIVE,
        },
      });
    });

    it('should throw ConflictException if class name already exists', async () => {
      const createDto = {
        name: 'Batch 2024 Morning',
      };

      mockPrismaService.class.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['name'] },
        }),
      );

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated list of classes', async () => {
      const query = { page: 1, limit: 10 };

      const mockClasses = [
        {
          id: 'class-1',
          name: 'Class 1',
          description: 'Description 1',
          status: ClassStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { enrollments: 5 },
        },
      ];

      mockPrismaService.class.findMany.mockResolvedValue(mockClasses);
      mockPrismaService.class.count.mockResolvedValue(1);

      const result = await service.findAll(query);

      expect(result).toEqual({
        data: mockClasses,
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });
    });

    it('should filter by status when provided', async () => {
      const query = { status: ClassStatus.ACTIVE, page: 1, limit: 10 };

      mockPrismaService.class.findMany.mockResolvedValue([]);
      mockPrismaService.class.count.mockResolvedValue(0);

      await service.findAll(query);

      expect(prisma.class.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ClassStatus.ACTIVE },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return class with active enrollments', async () => {
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

      mockPrismaService.class.findUnique.mockResolvedValue(mockClass);

      const result = await service.findOne(classId);

      expect(result).toEqual(mockClass);
      expect(prisma.class.findUnique).toHaveBeenCalledWith({
        where: { id: classId },
        include: expect.objectContaining({
          enrollments: expect.objectContaining({
            where: { status: EnrollmentStatus.ACTIVE },
          }),
        }),
      });
    });

    it('should throw NotFoundException if class does not exist', async () => {
      mockPrismaService.class.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update class details', async () => {
      const classId = 'class-id';
      const updateDto = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const existingClass = {
        id: classId,
        name: 'Old Name',
        description: 'Old description',
        status: ClassStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedClass = { ...existingClass, ...updateDto };

      mockPrismaService.class.findUnique.mockResolvedValue(existingClass);
      mockPrismaService.class.update.mockResolvedValue(updatedClass);

      const result = await service.update(classId, updateDto);

      expect(result).toEqual(updatedClass);
      expect(prisma.class.update).toHaveBeenCalledWith({
        where: { id: classId },
        data: updateDto,
      });
    });

    it('should throw NotFoundException if class does not exist', async () => {
      mockPrismaService.class.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if new name conflicts', async () => {
      const classId = 'class-id';
      const updateDto = { name: 'Duplicate Name' };

      mockPrismaService.class.findUnique.mockResolvedValue({
        id: classId,
        name: 'Old Name',
        status: ClassStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrismaService.class.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['name'] },
        }),
      );

      await expect(service.update(classId, updateDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('enrollStudent', () => {
    it('should enroll a student in a class', async () => {
      const classId = 'class-id';
      const enrollDto = { studentId: 'student-id' };

      const mockClass = {
        id: classId,
        name: 'Class 1',
        status: ClassStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockStudent = {
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
      };

      const mockEnrollment = {
        id: 'enrollment-id',
        studentId: enrollDto.studentId,
        classId: classId,
        status: EnrollmentStatus.ACTIVE,
        enrolledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        student: {
          ...mockStudent,
          user: {
            email: 'john@example.com',
            status: 'ACTIVE',
          },
        },
        class: mockClass,
      };

      mockPrismaService.class.findUnique.mockResolvedValue(mockClass);
      mockPrismaService.student.findUnique.mockResolvedValue(mockStudent);
      mockPrismaService.classEnrollment.findUnique.mockResolvedValue(null);
      mockPrismaService.classEnrollment.create.mockResolvedValue(
        mockEnrollment,
      );

      const result = await service.enrollStudent(classId, enrollDto);

      expect(result).toEqual(mockEnrollment);
      expect(prisma.classEnrollment.create).toHaveBeenCalledWith({
        data: {
          studentId: enrollDto.studentId,
          classId: classId,
          status: EnrollmentStatus.ACTIVE,
        },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if class does not exist', async () => {
      mockPrismaService.class.findUnique.mockResolvedValue(null);

      await expect(
        service.enrollStudent('non-existent-class', { studentId: 'student-id' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if student does not exist', async () => {
      mockPrismaService.class.findUnique.mockResolvedValue({
        id: 'class-id',
        name: 'Class 1',
        status: ClassStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrismaService.student.findUnique.mockResolvedValue(null);

      await expect(
        service.enrollStudent('class-id', { studentId: 'non-existent-student' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if student is already enrolled', async () => {
      const classId = 'class-id';
      const enrollDto = { studentId: 'student-id' };

      mockPrismaService.class.findUnique.mockResolvedValue({
        id: classId,
        name: 'Class 1',
        status: ClassStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrismaService.student.findUnique.mockResolvedValue({
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
      });

      mockPrismaService.classEnrollment.findUnique.mockResolvedValue({
        id: 'enrollment-id',
        studentId: enrollDto.studentId,
        classId: classId,
        status: EnrollmentStatus.ACTIVE,
        enrolledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.enrollStudent(classId, enrollDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should reactivate inactive enrollment', async () => {
      const classId = 'class-id';
      const enrollDto = { studentId: 'student-id' };

      mockPrismaService.class.findUnique.mockResolvedValue({
        id: classId,
        name: 'Class 1',
        status: ClassStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrismaService.student.findUnique.mockResolvedValue({
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
      });

      const inactiveEnrollment = {
        id: 'enrollment-id',
        studentId: enrollDto.studentId,
        classId: classId,
        status: EnrollmentStatus.INACTIVE,
        enrolledAt: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.classEnrollment.findUnique.mockResolvedValue(
        inactiveEnrollment,
      );
      mockPrismaService.classEnrollment.update.mockResolvedValue({
        ...inactiveEnrollment,
        status: EnrollmentStatus.ACTIVE,
        enrolledAt: new Date(),
      });

      const result = await service.enrollStudent(classId, enrollDto);

      expect(result.status).toBe(EnrollmentStatus.ACTIVE);
      expect(prisma.classEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: inactiveEnrollment.id },
          data: expect.objectContaining({
            status: EnrollmentStatus.ACTIVE,
          }),
        }),
      );
    });
  });

  describe('unenrollStudent', () => {
    it('should unenroll a student from a class (soft delete)', async () => {
      const classId = 'class-id';
      const studentId = 'student-id';

      const activeEnrollment = {
        id: 'enrollment-id',
        studentId: studentId,
        classId: classId,
        status: EnrollmentStatus.ACTIVE,
        enrolledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const inactiveEnrollment = {
        ...activeEnrollment,
        status: EnrollmentStatus.INACTIVE,
      };

      mockPrismaService.classEnrollment.findUnique.mockResolvedValue(
        activeEnrollment,
      );
      mockPrismaService.classEnrollment.update.mockResolvedValue(
        inactiveEnrollment,
      );

      const result = await service.unenrollStudent(classId, studentId);

      expect(result.status).toBe(EnrollmentStatus.INACTIVE);
      expect(prisma.classEnrollment.update).toHaveBeenCalledWith({
        where: { id: activeEnrollment.id },
        data: { status: EnrollmentStatus.INACTIVE },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if enrollment does not exist', async () => {
      mockPrismaService.classEnrollment.findUnique.mockResolvedValue(null);

      await expect(
        service.unenrollStudent('class-id', 'student-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if student is already unenrolled', async () => {
      mockPrismaService.classEnrollment.findUnique.mockResolvedValue({
        id: 'enrollment-id',
        studentId: 'student-id',
        classId: 'class-id',
        status: EnrollmentStatus.INACTIVE,
        enrolledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.unenrollStudent('class-id', 'student-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
