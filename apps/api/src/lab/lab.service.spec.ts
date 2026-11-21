import { Test, TestingModule } from '@nestjs/testing';
import { LabService } from './lab.service';
import { PrismaService } from '../prisma/prisma.service';
import { GstLabService } from './gst-lab.service';
import { ItrLabService } from './itr-lab.service';
import { McaLabService } from './mca-lab.service';
import { UserRole, LabType } from '@prisma/client';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

/**
 * Lab Service Tests
 * 
 * Tests lab service business logic including:
 * - Lab retrieval with role-based filtering
 * - Lab submission processing
 * - Attempt tracking and retrieval
 * - Sample data management
 * 
 * Requirements: R27, R28, R29, R30, R31
 * Task 53: Implement lab endpoints
 * Test Coverage: T6 (Lab operations)
 */
describe('LabService', () => {
  let service: LabService;
  let prisma: PrismaService;
  let gstLabService: GstLabService;
  let itrLabService: ItrLabService;
  let mcaLabService: McaLabService;

  const mockPrismaService = {
    lab: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    labAttempt: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockGstLabService = {
    processGstSubmission: jest.fn(),
  };

  const mockItrLabService = {
    submitItrForm: jest.fn(),
  };

  const mockMcaLabService = {
    submitMcaForm: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: GstLabService,
          useValue: mockGstLabService,
        },
        {
          provide: ItrLabService,
          useValue: mockItrLabService,
        },
        {
          provide: McaLabService,
          useValue: mockMcaLabService,
        },
      ],
    }).compile();

    service = module.get<LabService>(LabService);
    prisma = module.get<PrismaService>(PrismaService);
    gstLabService = module.get<GstLabService>(GstLabService);
    itrLabService = module.get<ItrLabService>(ItrLabService);
    mcaLabService = module.get<McaLabService>(McaLabService);

    jest.clearAllMocks();
  });

  describe('getAllLabs', () => {
    it('should return only active labs for students', async () => {
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
      ];

      mockPrismaService.lab.findMany.mockResolvedValue(mockLabs);

      const result = await service.getAllLabs(UserRole.STUDENT);

      expect(prisma.lab.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { type: 'asc' },
      });
      expect(result).toEqual(mockLabs);
    });

    it('should return all labs for administrators', async () => {
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

      mockPrismaService.lab.findMany.mockResolvedValue(mockLabs);

      const result = await service.getAllLabs(UserRole.ADMINISTRATOR);

      expect(prisma.lab.findMany).toHaveBeenCalledWith({
        where: undefined,
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { type: 'asc' },
      });
      expect(result).toEqual(mockLabs);
      expect(result).toHaveLength(2);
    });
  });

  describe('getLabByType', () => {
    const mockLab = {
      id: 'lab-1',
      type: LabType.GST_REGISTRATION,
      title: 'GST Registration',
      description: 'GST simulation',
      sampleData: {
        businessName: 'Sample Business',
        pan: 'TEST00000T',
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'admin-123',
    };

    it('should return lab for valid type', async () => {
      mockPrismaService.lab.findUnique.mockResolvedValue(mockLab);

      const result = await service.getLabByType(
        LabType.GST_REGISTRATION,
        UserRole.STUDENT,
      );

      expect(prisma.lab.findUnique).toHaveBeenCalledWith({
        where: { type: LabType.GST_REGISTRATION },
      });
      expect(result).toEqual(mockLab);
    });

    it('should throw NotFoundException if lab not found', async () => {
      mockPrismaService.lab.findUnique.mockResolvedValue(null);

      await expect(
        service.getLabByType(LabType.GST_REGISTRATION, UserRole.STUDENT),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if student tries to access inactive lab', async () => {
      const inactiveLab = { ...mockLab, isActive: false };
      mockPrismaService.lab.findUnique.mockResolvedValue(inactiveLab);

      await expect(
        service.getLabByType(LabType.GST_REGISTRATION, UserRole.STUDENT),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow administrator to access inactive lab', async () => {
      const inactiveLab = { ...mockLab, isActive: false };
      mockPrismaService.lab.findUnique.mockResolvedValue(inactiveLab);

      const result = await service.getLabByType(
        LabType.GST_REGISTRATION,
        UserRole.ADMINISTRATOR,
      );

      expect(result).toEqual(inactiveLab);
    });
  });

  describe('submitLabAttempt', () => {
    const mockLab = {
      id: 'lab-1',
      type: LabType.GST_REGISTRATION,
      title: 'GST Registration',
      isActive: true,
    };

    it('should submit GST lab attempt successfully', async () => {
      const formData = {
        businessName: 'Test Business',
        businessType: 'Private Limited',
        pan: 'TEST12345T',
        address: '123 Test Street',
        signatory: 'John Test',
      };

      const gstAttemptData = {
        formData,
        result: {
          gstin: '00TEST12345TZ00',
          arn: 'AR1234567890123',
          applicationDate: '2024-01-15',
          status: 'Approved (Simulated)',
        },
      };

      const mockCreatedAttempt = {
        id: 'attempt-1',
        labId: 'lab-1',
        studentId: 'student-123',
        formData: gstAttemptData.formData,
        result: gstAttemptData.result,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lab: {
          type: LabType.GST_REGISTRATION,
          title: 'GST Registration',
        },
      };

      mockPrismaService.lab.findUnique.mockResolvedValue(mockLab);
      mockGstLabService.processGstSubmission.mockReturnValue(gstAttemptData);
      mockPrismaService.labAttempt.create.mockResolvedValue(mockCreatedAttempt);

      const result = await service.submitLabAttempt(
        LabType.GST_REGISTRATION,
        formData,
        'student-123',
      );

      expect(prisma.lab.findUnique).toHaveBeenCalledWith({
        where: { type: LabType.GST_REGISTRATION },
      });
      expect(gstLabService.processGstSubmission).toHaveBeenCalledWith(formData);
      expect(prisma.labAttempt.create).toHaveBeenCalledWith({
        data: {
          labId: 'lab-1',
          studentId: 'student-123',
          formData: gstAttemptData.formData,
          result: gstAttemptData.result,
        },
        include: {
          lab: {
            select: {
              type: true,
              title: true,
            },
          },
        },
      });
      expect(result).toEqual(mockCreatedAttempt);
    });

    it('should submit ITR lab attempt successfully', async () => {
      const itrLab = {
        id: 'lab-2',
        type: LabType.INCOME_TAX_RETURN,
        title: 'Income Tax Return',
        isActive: true,
      };

      const formData = {
        taxpayerName: 'Test Taxpayer',
        pan: 'TEST00000T',
        incomeSource: 'Salary',
        grossIncome: 800000,
        deductions: 150000,
      };

      const itrAttemptData = {
        formData,
        calculation: {
          grossIncome: 800000,
          deductions: 150000,
          taxableIncome: 650000,
          taxAmount: 75000,
          taxBrackets: [],
        },
        result: {
          acknowledgementNumber: '123456789012345',
          taxpayerName: 'Test Taxpayer',
          pan: 'TEST00000T',
          taxableIncome: 650000,
          taxAmount: 75000,
          filingDate: new Date(),
          status: 'FILED',
        },
      };

      const mockCreatedAttempt = {
        id: 'attempt-2',
        labId: 'lab-2',
        studentId: 'student-123',
        formData: itrAttemptData.formData,
        result: { ...itrAttemptData.result, calculation: itrAttemptData.calculation },
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lab: {
          type: LabType.INCOME_TAX_RETURN,
          title: 'Income Tax Return',
        },
      };

      mockPrismaService.lab.findUnique.mockResolvedValue(itrLab);
      mockItrLabService.submitItrForm.mockReturnValue(itrAttemptData);
      mockPrismaService.labAttempt.create.mockResolvedValue(mockCreatedAttempt);

      const result = await service.submitLabAttempt(
        LabType.INCOME_TAX_RETURN,
        formData,
        'student-123',
      );

      expect(itrLabService.submitItrForm).toHaveBeenCalledWith(formData);
      expect(prisma.labAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            formData,
            result: { ...itrAttemptData.result, calculation: itrAttemptData.calculation },
          }),
        }),
      );
      expect(result).toEqual(mockCreatedAttempt);
    });

    it('should submit MCA lab attempt successfully', async () => {
      const mcaLab = {
        id: 'lab-3',
        type: LabType.MCA_INCORPORATION,
        title: 'MCA Incorporation',
        isActive: true,
      };

      const formData = {
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

      const mcaAttemptData = {
        formData,
        result: {
          cin: 'U00000TS0000PTC123456',
          certificateDate: new Date(),
          companyName: 'Test Company Pvt Ltd',
          registrationNumber: 'REG-123456',
          submittedAt: new Date(),
        },
      };

      const mockCreatedAttempt = {
        id: 'attempt-3',
        labId: 'lab-3',
        studentId: 'student-123',
        formData: mcaAttemptData.formData,
        result: mcaAttemptData.result,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lab: {
          type: LabType.MCA_INCORPORATION,
          title: 'MCA Incorporation',
        },
      };

      mockPrismaService.lab.findUnique.mockResolvedValue(mcaLab);
      // McaLabService.submitMcaForm resolves to the result object itself
      mockMcaLabService.submitMcaForm.mockResolvedValue(mcaAttemptData.result);
      mockPrismaService.labAttempt.create.mockResolvedValue(mockCreatedAttempt);

      const result = await service.submitLabAttempt(
        LabType.MCA_INCORPORATION,
        formData,
        'student-123',
      );

      expect(mcaLabService.submitMcaForm).toHaveBeenCalledWith(formData);
      expect(prisma.labAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            formData,
            result: mcaAttemptData.result,
          }),
        }),
      );
      expect(result).toEqual(mockCreatedAttempt);
    });

    it('should throw NotFoundException if lab not found', async () => {
      mockPrismaService.lab.findUnique.mockResolvedValue(null);

      await expect(
        service.submitLabAttempt(
          LabType.GST_REGISTRATION,
          {},
          'student-123',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if lab is inactive', async () => {
      const inactiveLab = { ...mockLab, isActive: false };
      mockPrismaService.lab.findUnique.mockResolvedValue(inactiveLab);

      await expect(
        service.submitLabAttempt(
          LabType.GST_REGISTRATION,
          {},
          'student-123',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should propagate validation errors from lab services', async () => {
      mockPrismaService.lab.findUnique.mockResolvedValue(mockLab);
      mockGstLabService.processGstSubmission.mockImplementation(() => {
        throw new BadRequestException('Invalid PAN format');
      });

      await expect(
        service.submitLabAttempt(
          LabType.GST_REGISTRATION,
          { pan: 'INVALID' },
          'student-123',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getLabAttempts', () => {
    const mockLab = {
      id: 'lab-1',
      type: LabType.GST_REGISTRATION,
    };

    it('should return student own attempts only', async () => {
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

      mockPrismaService.lab.findUnique.mockResolvedValue(mockLab);
      mockPrismaService.labAttempt.findMany.mockResolvedValue(mockAttempts);

      const result = await service.getLabAttempts(
        LabType.GST_REGISTRATION,
        'student-123',
        UserRole.STUDENT,
      );

      expect(prisma.labAttempt.findMany).toHaveBeenCalledWith({
        where: { labId: 'lab-1', studentId: 'student-123' },
        include: {
          lab: {
            select: {
              type: true,
              title: true,
            },
          },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { completedAt: 'desc' },
      });
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

      mockPrismaService.lab.findUnique.mockResolvedValue(mockLab);
      mockPrismaService.labAttempt.findMany.mockResolvedValue(mockAttempts);

      const result = await service.getLabAttempts(
        LabType.GST_REGISTRATION,
        'admin-123',
        UserRole.ADMINISTRATOR,
      );

      expect(prisma.labAttempt.findMany).toHaveBeenCalledWith({
        where: { labId: 'lab-1' },
        include: expect.any(Object),
        orderBy: { completedAt: 'desc' },
      });
      expect(result).toEqual(mockAttempts);
      expect(result).toHaveLength(2);
    });

    it('should filter by student for administrator', async () => {
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

      mockPrismaService.lab.findUnique.mockResolvedValue(mockLab);
      mockPrismaService.labAttempt.findMany.mockResolvedValue(mockAttempts);

      const result = await service.getLabAttempts(
        LabType.GST_REGISTRATION,
        'admin-123',
        UserRole.ADMINISTRATOR,
        'student-123',
      );

      expect(prisma.labAttempt.findMany).toHaveBeenCalledWith({
        where: { labId: 'lab-1', studentId: 'student-123' },
        include: expect.any(Object),
        orderBy: { completedAt: 'desc' },
      });
      expect(result).toEqual(mockAttempts);
    });

    it('should throw NotFoundException if lab not found', async () => {
      mockPrismaService.lab.findUnique.mockResolvedValue(null);

      await expect(
        service.getLabAttempts(
          LabType.GST_REGISTRATION,
          'student-123',
          UserRole.STUDENT,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getLabAttemptById', () => {
    const mockAttempt = {
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

    it('should return attempt for student own attempt', async () => {
      mockPrismaService.labAttempt.findUnique.mockResolvedValue(mockAttempt);

      const result = await service.getLabAttemptById(
        'attempt-1',
        'student-123',
        UserRole.STUDENT,
      );

      expect(result).toEqual(mockAttempt);
    });

    it('should return attempt for administrator', async () => {
      mockPrismaService.labAttempt.findUnique.mockResolvedValue(mockAttempt);

      const result = await service.getLabAttemptById(
        'attempt-1',
        'admin-123',
        UserRole.ADMINISTRATOR,
      );

      expect(result).toEqual(mockAttempt);
    });

    it('should throw NotFoundException if attempt not found', async () => {
      mockPrismaService.labAttempt.findUnique.mockResolvedValue(null);

      await expect(
        service.getLabAttemptById('invalid-id', 'student-123', UserRole.STUDENT),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for student viewing another student attempt', async () => {
      mockPrismaService.labAttempt.findUnique.mockResolvedValue(mockAttempt);

      await expect(
        service.getLabAttemptById('attempt-1', 'student-456', UserRole.STUDENT),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateSampleData', () => {
    const mockLab = {
      id: 'lab-1',
      type: LabType.GST_REGISTRATION,
      title: 'GST Registration',
      description: 'GST simulation',
      sampleData: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'admin-123',
    };

    it('should update sample data successfully', async () => {
      const newSampleData = {
        businessName: 'Updated Sample',
        pan: 'TEST99999T',
      };

      const updatedLab = {
        ...mockLab,
        sampleData: newSampleData,
      };

      mockPrismaService.lab.findUnique.mockResolvedValue(mockLab);
      mockPrismaService.lab.update.mockResolvedValue(updatedLab);

      const result = await service.updateSampleData(
        LabType.GST_REGISTRATION,
        newSampleData,
        'admin-123',
      );

      expect(prisma.lab.update).toHaveBeenCalledWith({
        where: { type: LabType.GST_REGISTRATION },
        data: {
          sampleData: newSampleData,
          updatedBy: 'admin-123',
          updatedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(updatedLab);
    });

    it('should throw NotFoundException if lab not found', async () => {
      mockPrismaService.lab.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSampleData(
          LabType.GST_REGISTRATION,
          {},
          'admin-123',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
