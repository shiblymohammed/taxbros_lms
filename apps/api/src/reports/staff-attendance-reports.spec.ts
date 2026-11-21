import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { AttendanceStatus, StaffCategory } from '@prisma/client';

describe('ReportsService - Staff Attendance Reports', () => {
  let service: ReportsService;

  const mockPrismaService = {
    staff: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    staffAttendance: {
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

  describe('getMonthlyStaffAttendanceReport', () => {
    it('should throw NotFoundException for invalid month', async () => {
      await expect(
        service.getMonthlyStaffAttendanceReport({
          year: 2024,
          month: 13,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for invalid year', async () => {
      await expect(
        service.getMonthlyStaffAttendanceReport({
          year: 1999,
          month: 11,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should generate monthly staff report with correct attendance calculation', async () => {
      const mockStaff = {
        id: 'staff-1',
        staffId: 'STAFF001',
        firstName: 'Jane',
        lastName: 'Smith',
        designation: 'Teacher',
        department: 'Mathematics',
        category: StaffCategory.TEACHING,
        user: { email: 'jane@example.com' },
      };

      const mockAttendanceRecords = [
        {
          staffId: 'staff-1',
          status: AttendanceStatus.PRESENT,
          attendanceDate: new Date(2024, 10, 1), // Nov 1
        },
        {
          staffId: 'staff-1',
          status: AttendanceStatus.PRESENT,
          attendanceDate: new Date(2024, 10, 2), // Nov 2
        },
        {
          staffId: 'staff-1',
          status: AttendanceStatus.LATE,
          attendanceDate: new Date(2024, 10, 3), // Nov 3
        },
        {
          staffId: 'staff-1',
          status: AttendanceStatus.ABSENT,
          attendanceDate: new Date(2024, 10, 4), // Nov 4
        },
      ];

      mockPrismaService.staff.findMany.mockResolvedValue([mockStaff]);
      mockPrismaService.staffAttendance.findMany.mockResolvedValue(
        mockAttendanceRecords,
      );

      const result = await service.getMonthlyStaffAttendanceReport({
        year: 2024,
        month: 11,
      });

      expect(result).toBeDefined();
      expect(result.staff).toHaveLength(1);
      expect(result.staff[0].staffId).toBe('STAFF001');
      expect(result.staff[0].staffName).toBe('Jane Smith');
      expect(result.staff[0].presentCount).toBe(2);
      expect(result.staff[0].lateCount).toBe(1);
      expect(result.staff[0].absentCount).toBe(1);
      // Percentage: 100 × (2 + 1) / (2 + 1 + 1) = 75%
      expect(result.staff[0].percentage).toBe(75);
    });

    it('should filter staff by department', async () => {
      mockPrismaService.staff.findMany.mockResolvedValue([]);
      mockPrismaService.staffAttendance.findMany.mockResolvedValue([]);

      await service.getMonthlyStaffAttendanceReport({
        year: 2024,
        month: 11,
        department: 'Mathematics',
      });

      expect(mockPrismaService.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            department: 'Mathematics',
          }),
        }),
      );
    });

    it('should filter staff by category', async () => {
      mockPrismaService.staff.findMany.mockResolvedValue([]);
      mockPrismaService.staffAttendance.findMany.mockResolvedValue([]);

      await service.getMonthlyStaffAttendanceReport({
        year: 2024,
        month: 11,
        category: StaffCategory.TEACHING,
      });

      expect(mockPrismaService.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: StaffCategory.TEACHING,
          }),
        }),
      );
    });

    it('should return null percentage when no attendance marked', async () => {
      const mockStaff = {
        id: 'staff-1',
        staffId: 'STAFF001',
        firstName: 'Jane',
        lastName: 'Smith',
        designation: 'Teacher',
        department: 'Mathematics',
        category: StaffCategory.TEACHING,
        user: { email: 'jane@example.com' },
      };

      mockPrismaService.staff.findMany.mockResolvedValue([mockStaff]);
      mockPrismaService.staffAttendance.findMany.mockResolvedValue([]);

      const result = await service.getMonthlyStaffAttendanceReport({
        year: 2024,
        month: 11,
      });

      expect(result.staff[0].presentCount).toBe(0);
      expect(result.staff[0].lateCount).toBe(0);
      expect(result.staff[0].absentCount).toBe(0);
      expect(result.staff[0].percentage).toBeNull();
    });
  });

  describe('getStaffAttendanceHistory', () => {
    it('should throw NotFoundException if staff not found', async () => {
      mockPrismaService.staff.findUnique.mockResolvedValue(null);

      await expect(
        service.getStaffAttendanceHistory('invalid-staff-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return attendance history for a staff member', async () => {
      const mockStaff = {
        id: 'staff-1',
        staffId: 'STAFF001',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      const mockAttendanceRecords = [
        {
          id: 'att-1',
          staffId: 'staff-1',
          attendanceDate: new Date(2024, 10, 1),
          status: AttendanceStatus.PRESENT,
          remarks: null,
          markedBy: 'admin-1',
          markedAt: new Date(2024, 10, 1, 9, 0),
        },
        {
          id: 'att-2',
          staffId: 'staff-1',
          attendanceDate: new Date(2024, 10, 2),
          status: AttendanceStatus.LATE,
          remarks: 'Traffic',
          markedBy: 'admin-1',
          markedAt: new Date(2024, 10, 2, 9, 30),
        },
      ];

      mockPrismaService.staff.findUnique.mockResolvedValue(mockStaff);
      mockPrismaService.staffAttendance.findMany.mockResolvedValue(
        mockAttendanceRecords,
      );

      const result = await service.getStaffAttendanceHistory('staff-1');

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe(AttendanceStatus.PRESENT);
      expect(result[1].status).toBe(AttendanceStatus.LATE);
      expect(result[1].remarks).toBe('Traffic');
    });

    it('should filter attendance history by date range', async () => {
      const mockStaff = {
        id: 'staff-1',
        staffId: 'STAFF001',
      };

      mockPrismaService.staff.findUnique.mockResolvedValue(mockStaff);
      mockPrismaService.staffAttendance.findMany.mockResolvedValue([]);

      await service.getStaffAttendanceHistory('staff-1', {
        dateFrom: '2024-11-01',
        dateTo: '2024-11-30',
      });

      expect(mockPrismaService.staffAttendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            attendanceDate: {
              gte: new Date('2024-11-01'),
              lte: new Date('2024-11-30'),
            },
          }),
        }),
      );
    });
  });
});
