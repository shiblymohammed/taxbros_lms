import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';

describe('ReportsService', () => {
  let service: ReportsService;

  const mockPrismaService = {
    class: {
      findUnique: jest.fn(),
    },
    student: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    studentAttendance: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMonthlyStudentAttendanceReport', () => {
    it('should throw NotFoundException for invalid month', async () => {
      await expect(
        service.getMonthlyStudentAttendanceReport({
          year: 2024,
          month: 13,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for invalid year', async () => {
      await expect(
        service.getMonthlyStudentAttendanceReport({
          year: 1999,
          month: 11,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if class not found', async () => {
      mockPrismaService.class.findUnique.mockResolvedValue(null);

      await expect(
        service.getMonthlyStudentAttendanceReport({
          year: 2024,
          month: 11,
          classId: 'invalid-class-id',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should generate monthly report with correct attendance calculation', async () => {
      const mockClass = { id: 'class-1', name: 'Class A' };
      const mockStudent = {
        id: 'student-1',
        admissionId: 'ADM001',
        firstName: 'John',
        lastName: 'Doe',
        user: { email: 'john@example.com' },
        classEnrollments: [
          {
            class: mockClass,
            status: 'ACTIVE',
          },
        ],
      };

      const mockAttendanceRecords = [
        {
          studentId: 'student-1',
          status: AttendanceStatus.PRESENT,
          register: { class: mockClass },
        },
        {
          studentId: 'student-1',
          status: AttendanceStatus.PRESENT,
          register: { class: mockClass },
        },
        {
          studentId: 'student-1',
          status: AttendanceStatus.LATE,
          register: { class: mockClass },
        },
        {
          studentId: 'student-1',
          status: AttendanceStatus.ABSENT,
          register: { class: mockClass },
        },
        {
          studentId: 'student-1',
          status: AttendanceStatus.ABSENT,
          register: { class: mockClass },
        },
      ];

      mockPrismaService.student.findMany.mockResolvedValue([mockStudent]);
      mockPrismaService.studentAttendance.findMany.mockResolvedValue(
        mockAttendanceRecords,
      );

      const result = await service.getMonthlyStudentAttendanceReport({
        year: 2024,
        month: 11,
      });

      expect(result).toBeDefined();
      expect(result.students).toHaveLength(1);
      expect(result.students[0].presentCount).toBe(2);
      expect(result.students[0].lateCount).toBe(1);
      expect(result.students[0].absentCount).toBe(2);
      // Percentage = 100 × (2 + 1) / (2 + 1 + 2) = 60%
      expect(result.students[0].percentage).toBe(60);
    });

    it('should return null percentage when no marked entries', async () => {
      const mockStudent = {
        id: 'student-1',
        admissionId: 'ADM001',
        firstName: 'John',
        lastName: 'Doe',
        user: { email: 'john@example.com' },
        classEnrollments: [],
      };

      mockPrismaService.student.findMany.mockResolvedValue([mockStudent]);
      mockPrismaService.studentAttendance.findMany.mockResolvedValue([]);

      const result = await service.getMonthlyStudentAttendanceReport({
        year: 2024,
        month: 11,
      });

      expect(result.students[0].percentage).toBeNull();
    });
  });

  describe('getStudentAttendanceHistory', () => {
    it('should throw NotFoundException if student not found', async () => {
      mockPrismaService.student.findUnique.mockResolvedValue(null);

      await expect(
        service.getStudentAttendanceHistory('invalid-student-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return attendance history for student', async () => {
      const mockStudent = {
        id: 'student-1',
        admissionId: 'ADM001',
        firstName: 'John',
        lastName: 'Doe',
      };

      const mockRecords = [
        {
          id: 'record-1',
          studentId: 'student-1',
          status: AttendanceStatus.PRESENT,
          remarks: null,
          markedBy: 'user-1',
          markedAt: new Date(),
          register: {
            attendanceDate: new Date(),
            class: { name: 'Class A' },
          },
        },
      ];

      mockPrismaService.student.findUnique.mockResolvedValue(mockStudent);
      mockPrismaService.studentAttendance.findMany.mockResolvedValue(
        mockRecords,
      );

      const result = await service.getStudentAttendanceHistory('student-1');

      expect(result).toHaveLength(1);
      expect(result[0].studentId).toBe('student-1');
      expect(result[0].status).toBe(AttendanceStatus.PRESENT);
    });
  });
});
