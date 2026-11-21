import { Test, TestingModule } from '@nestjs/testing';
import { LabController } from './lab.controller';
import { LabService } from './lab.service';
import { UserRole, LabType } from '@prisma/client';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { SubmitGstLabDto } from './dto/submit-gst-lab.dto';
import { SubmitItrLabDto } from './dto/submit-itr-lab.dto';
import { SubmitMcaLabDto } from './dto/submit-mca-lab.dto';
import { UpdateSampleDataDto } from './dto/update-sample-data.dto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Lab Controller Tests
 * 
 * Tests all lab endpoints with different user roles and scenarios.
 * 
 * Requirements: R27, R28, R29, R30, R31
 * Task 53: Implement lab endpoints
 * Test Coverage: T6 (Lab operations)
 */
describe('LabController', () => {
  let controller: LabController;
  let service: LabService;

  const mockLabService = {
    getAllLabs: jest.fn(),
    getLabByType: jest.fn(),
    submitLabAttempt: jest.fn(),
    getLabAttempts: jest.fn(),
    getLabAttemptById: jest.fn(),
    updateSampleData: jest.fn(),
    updateLabStatus: jest.fn(),
  };

  const mockStudentUser = {
    userId: 'user-student-123',
    studentId: 'student-123',
    role: UserRole.STUDENT,
  };

  const mockAdminUser = {
    userId: 'admin-123',
    role: UserRole.ADMINISTRATOR,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LabController],
      providers: [
        { provide: PrismaService, useValue: {} },
        {
          provide: LabService,
          useValue: mockLabService,
        },
      ],
    }).compile();

    controller = module.get<LabController>(LabController);
    service = module.get<LabService>(LabService);

    jest.clearAllMocks();
  });

  describe('getAllLabs - GET /labs', () => {
    it('should return all active labs for students', async () => {
      const mockLabs = [
        {
          id: 'lab-1',
          type: LabType.GST_REGISTRATION,
          title: 'GST Registration',
          description: 'GST simulation',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'lab-2',
          type: LabType.INCOME_TAX_RETURN,
          title: 'Income Tax Return',
          description: 'ITR simulation',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockLabService.getAllLabs.mockResolvedValue(mockLabs);

      const result = await controller.getAllLabs(mockStudentUser);

      expect(service.getAllLabs).toHaveBeenCalledWith(UserRole.STUDENT);
      expect(result).toEqual(mockLabs);
      expect(result).toHaveLength(2);
    });

    it('should return all labs including inactive ones for administrators', async () => {
      const mockLabs = [
        {
          id: 'lab-1',
          type: LabType.GST_REGISTRATION,
          title: 'GST Registration',
          description: 'GST simulation',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'lab-2',
          type: LabType.INCOME_TAX_RETURN,
          title: 'Income Tax Return',
          description: 'ITR simulation',
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockLabService.getAllLabs.mockResolvedValue(mockLabs);

      const result = await controller.getAllLabs(mockAdminUser);

      expect(service.getAllLabs).toHaveBeenCalledWith(UserRole.ADMINISTRATOR);
      expect(result).toEqual(mockLabs);
      expect(result).toHaveLength(2);
    });
  });

  describe('getLabByType - GET /labs/:type', () => {
    it('should return lab details for valid type', async () => {
      const mockLab = {
        id: 'lab-1',
        type: LabType.GST_REGISTRATION,
        title: 'GST Registration',
        description: 'GST simulation',
        sampleData: {
          businessName: 'Sample Business',
          businessType: 'Proprietorship',
          pan: 'TEST00000T',
          address: '123 Sample Street',
          signatory: 'Sample Signatory',
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin-123',
      };

      mockLabService.getLabByType.mockResolvedValue(mockLab);

      const result = await controller.getLabByType(
        LabType.GST_REGISTRATION,
        mockStudentUser,
      );

      expect(service.getLabByType).toHaveBeenCalledWith(
        LabType.GST_REGISTRATION,
        UserRole.STUDENT,
      );
      expect(result).toEqual(mockLab);
    });

    it('should throw BadRequestException for invalid lab type', async () => {
      await expect(
        controller.getLabByType('INVALID_TYPE', mockStudentUser),
      ).rejects.toThrow(BadRequestException);

      expect(service.getLabByType).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if lab not found', async () => {
      mockLabService.getLabByType.mockRejectedValue(
        new NotFoundException('Lab not found'),
      );

      await expect(
        controller.getLabByType(LabType.GST_REGISTRATION, mockStudentUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for inactive lab accessed by student', async () => {
      mockLabService.getLabByType.mockRejectedValue(
        new ForbiddenException('This lab is not currently active'),
      );

      await expect(
        controller.getLabByType(LabType.GST_REGISTRATION, mockStudentUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('submitLabAttempt - POST /labs/:type/submit', () => {
    it('should submit GST lab attempt successfully', async () => {
      const submitDto: SubmitGstLabDto = {
        businessName: 'Test Business',
        businessType: 'Private Limited',
        pan: 'TEST12345T',
        address: '123 Test Street',
        signatory: 'John Test',
      };

      const mockAttempt = {
        id: 'attempt-1',
        labId: 'lab-1',
        studentId: 'student-123',
        formData: submitDto,
        result: {
          gstin: '00TEST12345TZ00',
          arn: 'AR1234567890123',
          applicationDate: '2024-01-15',
          status: 'Approved (Simulated)',
        },
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lab: {
          type: LabType.GST_REGISTRATION,
          title: 'GST Registration',
        },
      };

      mockLabService.submitLabAttempt.mockResolvedValue(mockAttempt);

      const result = await controller.submitLabAttempt(
        LabType.GST_REGISTRATION,
        submitDto,
        mockStudentUser,
      );

      expect(service.submitLabAttempt).toHaveBeenCalledWith(
        LabType.GST_REGISTRATION,
        submitDto,
        'student-123',
      );
      expect(result).toEqual(mockAttempt);
    });

    it('should submit ITR lab attempt successfully', async () => {
      const submitDto: SubmitItrLabDto = {
        taxpayerName: 'Test Taxpayer',
        pan: 'TEST00000T',
        incomeSource: 'Salary',
        grossIncome: 800000,
        deductions: 150000,
      };

      const mockAttempt = {
        id: 'attempt-2',
        labId: 'lab-2',
        studentId: 'student-123',
        formData: submitDto,
        result: {
          acknowledgementNumber: '123456789012345',
          taxpayerName: 'Test Taxpayer',
          pan: 'TEST00000T',
          taxableIncome: 650000,
          taxAmount: 75000,
          filingDate: new Date(),
          status: 'FILED',
        },
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lab: {
          type: LabType.INCOME_TAX_RETURN,
          title: 'Income Tax Return',
        },
      };

      mockLabService.submitLabAttempt.mockResolvedValue(mockAttempt);

      const result = await controller.submitLabAttempt(
        LabType.INCOME_TAX_RETURN,
        submitDto,
        mockStudentUser,
      );

      expect(service.submitLabAttempt).toHaveBeenCalledWith(
        LabType.INCOME_TAX_RETURN,
        submitDto,
        'student-123',
      );
      expect(result).toEqual(mockAttempt);
    });

    it('should submit MCA lab attempt successfully', async () => {
      const submitDto: SubmitMcaLabDto = {
        companyName: 'Test Company Pvt Ltd',
        directors: [
          {
            name: 'Director One',
            din: '00000001',
            email: 'director1@test.com',
          },
        ],
        registeredAddress: '123 Test Street',
        authorizedCapital: 100000,
      };

      const mockAttempt = {
        id: 'attempt-3',
        labId: 'lab-3',
        studentId: 'student-123',
        formData: submitDto,
        result: {
          cin: 'U00000TS0000PTC123456',
          certificateDate: new Date(),
          companyName: 'Test Company Pvt Ltd',
          registrationNumber: 'REG-123456',
          submittedAt: new Date(),
        },
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lab: {
          type: LabType.MCA_INCORPORATION,
          title: 'MCA Incorporation',
        },
      };

      mockLabService.submitLabAttempt.mockResolvedValue(mockAttempt);

      const result = await controller.submitLabAttempt(
        LabType.MCA_INCORPORATION,
        submitDto,
        mockStudentUser,
      );

      expect(service.submitLabAttempt).toHaveBeenCalledWith(
        LabType.MCA_INCORPORATION,
        submitDto,
        'student-123',
      );
      expect(result).toEqual(mockAttempt);
    });

    it('should throw BadRequestException for invalid lab type', async () => {
      const submitDto: SubmitGstLabDto = {
        businessName: 'Test',
        businessType: 'Private',
        pan: 'TEST12345T',
        address: '123 Test',
        signatory: 'John',
      };

      await expect(
        controller.submitLabAttempt('INVALID_TYPE', submitDto, mockStudentUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if validation fails', async () => {
      const submitDto: SubmitGstLabDto = {
        businessName: 'Test',
        businessType: 'Private',
        pan: 'AAAAA1234B', // Realistic PAN pattern
        address: '123 Test',
        signatory: 'John',
      };

      mockLabService.submitLabAttempt.mockRejectedValue(
        new BadRequestException('PAN pattern not allowed'),
      );

      await expect(
        controller.submitLabAttempt(
          LabType.GST_REGISTRATION,
          submitDto,
          mockStudentUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getLabAttempts - GET /labs/:type/attempts', () => {
    it('should return student own attempts', async () => {
      const mockAttempts = [
        {
          id: 'attempt-1',
          labId: 'lab-1',
          studentId: 'student-123',
          formData: {},
          result: {},
          completedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          lab: {
            type: LabType.GST_REGISTRATION,
            title: 'GST Registration',
          },
          student: {
            id: 'student-123',
            user: {
              firstName: 'John',
              lastName: 'Doe',
              email: 'john@example.com',
            },
          },
        },
      ];

      mockLabService.getLabAttempts.mockResolvedValue(mockAttempts);

      const result = await controller.getLabAttempts(
        LabType.GST_REGISTRATION,
        undefined,
        mockStudentUser,
      );

      expect(service.getLabAttempts).toHaveBeenCalledWith(
        LabType.GST_REGISTRATION,
        'student-123',
        UserRole.STUDENT,
        undefined,
      );
      expect(result).toEqual(mockAttempts);
    });

    it('should return all attempts for administrator', async () => {
      const mockAttempts = [
        {
          id: 'attempt-1',
          labId: 'lab-1',
          studentId: 'student-123',
          formData: {},
          result: {},
          completedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          lab: {
            type: LabType.GST_REGISTRATION,
            title: 'GST Registration',
          },
          student: {
            id: 'student-123',
            user: {
              firstName: 'John',
              lastName: 'Doe',
              email: 'john@example.com',
            },
          },
        },
        {
          id: 'attempt-2',
          labId: 'lab-1',
          studentId: 'student-456',
          formData: {},
          result: {},
          completedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          lab: {
            type: LabType.GST_REGISTRATION,
            title: 'GST Registration',
          },
          student: {
            id: 'student-456',
            user: {
              firstName: 'Jane',
              lastName: 'Smith',
              email: 'jane@example.com',
            },
          },
        },
      ];

      mockLabService.getLabAttempts.mockResolvedValue(mockAttempts);

      const result = await controller.getLabAttempts(
        LabType.GST_REGISTRATION,
        undefined,
        mockAdminUser,
      );

      expect(service.getLabAttempts).toHaveBeenCalledWith(
        LabType.GST_REGISTRATION,
        'admin-123',
        UserRole.ADMINISTRATOR,
        undefined,
      );
      expect(result).toEqual(mockAttempts);
      expect(result).toHaveLength(2);
    });

    it('should filter attempts by student for administrator', async () => {
      const mockAttempts = [
        {
          id: 'attempt-1',
          labId: 'lab-1',
          studentId: 'student-123',
          formData: {},
          result: {},
          completedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          lab: {
            type: LabType.GST_REGISTRATION,
            title: 'GST Registration',
          },
          student: {
            id: 'student-123',
            user: {
              firstName: 'John',
              lastName: 'Doe',
              email: 'john@example.com',
            },
          },
        },
      ];

      mockLabService.getLabAttempts.mockResolvedValue(mockAttempts);

      const result = await controller.getLabAttempts(
        LabType.GST_REGISTRATION,
        'student-123',
        mockAdminUser,
      );

      expect(service.getLabAttempts).toHaveBeenCalledWith(
        LabType.GST_REGISTRATION,
        'admin-123',
        UserRole.ADMINISTRATOR,
        'student-123',
      );
      expect(result).toEqual(mockAttempts);
    });

    it('should throw BadRequestException for invalid lab type', async () => {
      await expect(
        controller.getLabAttempts('INVALID_TYPE', undefined, mockStudentUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getLabAttemptById - GET /labs/attempts/:id', () => {
    it('should return attempt details for student own attempt', async () => {
      const mockAttempt = {
        id: 'attempt-1',
        labId: 'lab-1',
        studentId: 'student-123',
        formData: {
          businessName: 'Test Business',
          businessType: 'Private Limited',
          pan: 'TEST12345T',
          address: '123 Test Street',
          signatory: 'John Test',
        },
        result: {
          gstin: '00TEST12345TZ00',
          arn: 'AR1234567890123',
          applicationDate: '2024-01-15',
          status: 'Approved (Simulated)',
        },
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lab: {
          type: LabType.GST_REGISTRATION,
          title: 'GST Registration',
          description: 'GST simulation',
        },
        student: {
          id: 'student-123',
          user: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
          },
        },
      };

      mockLabService.getLabAttemptById.mockResolvedValue(mockAttempt);

      const result = await controller.getLabAttemptById(
        'attempt-1',
        mockStudentUser,
      );

      expect(service.getLabAttemptById).toHaveBeenCalledWith(
        'attempt-1',
        'student-123',
        UserRole.STUDENT,
      );
      expect(result).toEqual(mockAttempt);
    });

    it('should return attempt details for administrator', async () => {
      const mockAttempt = {
        id: 'attempt-1',
        labId: 'lab-1',
        studentId: 'student-456',
        formData: {},
        result: {},
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lab: {
          type: LabType.GST_REGISTRATION,
          title: 'GST Registration',
          description: 'GST simulation',
        },
        student: {
          id: 'student-456',
          user: {
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
          },
        },
      };

      mockLabService.getLabAttemptById.mockResolvedValue(mockAttempt);

      const result = await controller.getLabAttemptById(
        'attempt-1',
        mockAdminUser,
      );

      expect(service.getLabAttemptById).toHaveBeenCalledWith(
        'attempt-1',
        'admin-123',
        UserRole.ADMINISTRATOR,
      );
      expect(result).toEqual(mockAttempt);
    });

    it('should throw NotFoundException if attempt not found', async () => {
      mockLabService.getLabAttemptById.mockRejectedValue(
        new NotFoundException('Lab attempt not found'),
      );

      await expect(
        controller.getLabAttemptById('invalid-id', mockStudentUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for student viewing another student attempt', async () => {
      mockLabService.getLabAttemptById.mockRejectedValue(
        new ForbiddenException('You can only view your own lab attempts'),
      );

      await expect(
        controller.getLabAttemptById('attempt-1', mockStudentUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateSampleData - PATCH /labs/:type/sample-data', () => {
    it('should update sample data successfully', async () => {
      const updateDto: UpdateSampleDataDto = {
        sampleData: {
          businessName: 'Updated Sample Business',
          businessType: 'Updated Type',
          pan: 'TEST99999T',
          address: '456 Updated Street',
          signatory: 'Updated Signatory',
        },
      };

      const mockUpdatedLab = {
        id: 'lab-1',
        type: LabType.GST_REGISTRATION,
        title: 'GST Registration',
        description: 'GST simulation',
        sampleData: updateDto.sampleData,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin-123',
      };

      mockLabService.updateSampleData.mockResolvedValue(mockUpdatedLab);

      const result = await controller.updateSampleData(
        LabType.GST_REGISTRATION,
        updateDto,
        mockAdminUser,
      );

      expect(service.updateSampleData).toHaveBeenCalledWith(
        LabType.GST_REGISTRATION,
        updateDto.sampleData,
        'admin-123',
      );
      expect(result).toEqual(mockUpdatedLab);
    });

    it('should throw BadRequestException for invalid lab type', async () => {
      const updateDto: UpdateSampleDataDto = {
        sampleData: {},
      };

      await expect(
        controller.updateSampleData('INVALID_TYPE', updateDto, mockAdminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if lab not found', async () => {
      const updateDto: UpdateSampleDataDto = {
        sampleData: {},
      };

      mockLabService.updateSampleData.mockRejectedValue(
        new NotFoundException('Lab not found'),
      );

      await expect(
        controller.updateSampleData(
          LabType.GST_REGISTRATION,
          updateDto,
          mockAdminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('student identity resolution', () => {
    it('stores attempts against the Student profile id, not the User id', async () => {
      mockLabService.submitLabAttempt.mockResolvedValue({ id: 'attempt-1' });

      await controller.submitLabAttempt(
        LabType.GST_REGISTRATION,
        {} as any,
        mockStudentUser,
      );

      expect(service.submitLabAttempt).toHaveBeenCalledWith(
        LabType.GST_REGISTRATION,
        {},
        'student-123',
      );
    });

    it('rejects a student account without a Student profile', async () => {
      await expect(
        controller.submitLabAttempt(
          LabType.GST_REGISTRATION,
          {} as any,
          { userId: 'user-x', role: UserRole.STUDENT },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('filters student attempt history by Student profile id', async () => {
      mockLabService.getLabAttempts.mockResolvedValue([]);

      await controller.getLabAttempts(
        LabType.GST_REGISTRATION,
        undefined,
        mockStudentUser,
      );

      expect(service.getLabAttempts).toHaveBeenCalledWith(
        LabType.GST_REGISTRATION,
        'student-123',
        UserRole.STUDENT,
        undefined,
      );
    });
  });

  describe('updateLabStatus - PATCH /labs/:type/status', () => {
    it('toggles lab active status', async () => {
      mockLabService.updateLabStatus.mockResolvedValue({
        type: LabType.MCA_INCORPORATION,
        isActive: false,
      });

      const result = await controller.updateLabStatus(
        LabType.MCA_INCORPORATION,
        { isActive: false },
      );

      expect(service.updateLabStatus).toHaveBeenCalledWith(
        LabType.MCA_INCORPORATION,
        false,
      );
      expect(result.isActive).toBe(false);
    });

    it('rejects an invalid lab type', async () => {
      await expect(
        controller.updateLabStatus('NOT_A_LAB', { isActive: true }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
