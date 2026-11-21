import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceCalculationService } from './attendance-calculation.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus } from '@prisma/client';

describe('AttendanceCalculationService', () => {
  let service: AttendanceCalculationService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceCalculationService,
        {
          provide: PrismaService,
          useValue: {
            studentAttendanceRegister: {
              findMany: jest.fn(),
            },
            student: {
              findUnique: jest.fn(),
            },
            staff: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AttendanceCalculationService>(
      AttendanceCalculationService,
    );
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateMonthlyStudentAttendance', () => {
    it('T3: a corrected register moves the month from 80% to 90%', async () => {
      const student = {
        id: 'student-1',
        firstName: 'John',
        lastName: 'Doe',
        admissionId: 'ADM001',
        classEnrollments: [{ classId: 'class-1', status: 'ACTIVE', class: { name: 'Class A' } }],
      };
      // 10 school days in November: 8 present, 2 absent
      const month = (absentDays: number[]) =>
        Array.from({ length: 10 }, (_, i) => ({
          id: `register-${i + 1}`,
          classId: 'class-1',
          attendanceDate: new Date(Date.UTC(2026, 10, i + 2)),
          rosterSnapshot: ['student-1'],
          attendanceRecords: [
            { studentId: 'student-1', status: absentDays.includes(i) ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT },
          ],
          class: { name: 'Class A' },
        }));
      jest.spyOn(prismaService.student, 'findUnique').mockResolvedValue(student as any);
      const findMany = jest.spyOn(prismaService.studentAttendanceRegister, 'findMany');

      findMany.mockResolvedValue(month([3, 7]) as any);
      const before = await service.calculateMonthlyStudentAttendance(2026, 11, 'class-1');
      expect(before[0]).toMatchObject({ presentCount: 8, absentCount: 2, percentage: 80 });

      // A teacher corrects day 4 from absent to present; the report is recalculated from the records
      findMany.mockResolvedValue(month([7]) as any);
      const after = await service.calculateMonthlyStudentAttendance(2026, 11, 'class-1');
      expect(after[0]).toMatchObject({ presentCount: 9, absentCount: 1, percentage: 90 });

      // The month is queried as calendar dates (1–30 November), whatever the server timezone
      const where = (findMany.mock.calls[0][0] as any).where;
      expect(where.attendanceDate.gte.toISOString()).toBe('2026-11-01T00:00:00.000Z');
      expect(where.attendanceDate.lte.toISOString()).toBe('2026-11-30T00:00:00.000Z');
    });

    it('should calculate attendance percentage correctly', async () => {
      const mockRegisters = [
        {
          id: 'register-1',
          classId: 'class-1',
          attendanceDate: new Date('2024-01-15'),
          rosterSnapshot: ['student-1'],
          attendanceRecords: [
            {
              studentId: 'student-1',
              status: AttendanceStatus.PRESENT,
            },
          ],
          class: { name: 'Class A' },
        },
        {
          id: 'register-2',
          classId: 'class-1',
          attendanceDate: new Date('2024-01-16'),
          rosterSnapshot: ['student-1'],
          attendanceRecords: [
            {
              studentId: 'student-1',
              status: AttendanceStatus.LATE,
            },
          ],
          class: { name: 'Class A' },
        },
        {
          id: 'register-3',
          classId: 'class-1',
          attendanceDate: new Date('2024-01-17'),
          rosterSnapshot: ['student-1'],
          attendanceRecords: [
            {
              studentId: 'student-1',
              status: AttendanceStatus.ABSENT,
            },
          ],
          class: { name: 'Class A' },
        },
      ];

      const mockStudent = {
        id: 'student-1',
        firstName: 'John',
        lastName: 'Doe',
        admissionId: 'ADM001',
        classEnrollments: [
          {
            classId: 'class-1',
            status: 'ACTIVE',
            class: { name: 'Class A' },
          },
        ],
      };

      jest
        .spyOn(prismaService.studentAttendanceRegister, 'findMany')
        .mockResolvedValue(mockRegisters as any);

      jest
        .spyOn(prismaService.student, 'findUnique')
        .mockResolvedValue(mockStudent as any);

      const result = await service.calculateMonthlyStudentAttendance(
        2024,
        1,
        'class-1',
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'student-1',
        name: 'John Doe',
        identifierId: 'ADM001',
        presentCount: 1,
        lateCount: 1,
        absentCount: 1,
        unmarkedCount: 0,
        percentage: 67, // (1 + 1) / (1 + 1 + 1) * 100 = 66.67 rounded to 67
        className: 'Class A',
      });
    });

    it('should handle unmarked entries correctly', async () => {
      const mockRegisters = [
        {
          id: 'register-1',
          classId: 'class-1',
          attendanceDate: new Date('2024-01-15'),
          rosterSnapshot: ['student-1'],
          attendanceRecords: [
            {
              studentId: 'student-1',
              status: AttendanceStatus.PRESENT,
            },
          ],
          class: { name: 'Class A' },
        },
        {
          id: 'register-2',
          classId: 'class-1',
          attendanceDate: new Date('2024-01-16'),
          rosterSnapshot: ['student-1'],
          attendanceRecords: [], // Unmarked
          class: { name: 'Class A' },
        },
      ];

      const mockStudent = {
        id: 'student-1',
        firstName: 'John',
        lastName: 'Doe',
        admissionId: 'ADM001',
        classEnrollments: [
          {
            classId: 'class-1',
            status: 'ACTIVE',
            class: { name: 'Class A' },
          },
        ],
      };

      jest
        .spyOn(prismaService.studentAttendanceRegister, 'findMany')
        .mockResolvedValue(mockRegisters as any);

      jest
        .spyOn(prismaService.student, 'findUnique')
        .mockResolvedValue(mockStudent as any);

      const result = await service.calculateMonthlyStudentAttendance(2024, 1);

      expect(result[0]).toMatchObject({
        presentCount: 1,
        lateCount: 0,
        absentCount: 0,
        unmarkedCount: 1,
        percentage: 100, // 1 / 1 * 100 = 100 (unmarked excluded)
      });
    });

    it('should return null percentage when no marked entries', async () => {
      const mockRegisters = [
        {
          id: 'register-1',
          classId: 'class-1',
          attendanceDate: new Date('2024-01-15'),
          rosterSnapshot: ['student-1'],
          attendanceRecords: [], // All unmarked
          class: { name: 'Class A' },
        },
      ];

      const mockStudent = {
        id: 'student-1',
        firstName: 'John',
        lastName: 'Doe',
        admissionId: 'ADM001',
        classEnrollments: [
          {
            classId: 'class-1',
            status: 'ACTIVE',
            class: { name: 'Class A' },
          },
        ],
      };

      jest
        .spyOn(prismaService.studentAttendanceRegister, 'findMany')
        .mockResolvedValue(mockRegisters as any);

      jest
        .spyOn(prismaService.student, 'findUnique')
        .mockResolvedValue(mockStudent as any);

      const result = await service.calculateMonthlyStudentAttendance(2024, 1);

      expect(result[0]).toMatchObject({
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
        unmarkedCount: 1,
        percentage: null, // No marked entries
      });
    });
  });

  describe('calculateMonthlyStaffAttendance', () => {
    it('should calculate staff attendance percentage correctly', async () => {
      const mockStaff = [
        {
          id: 'staff-1',
          staffId: 'STF001',
          firstName: 'Jane',
          lastName: 'Smith',
          designation: 'Teacher',
          department: 'Mathematics',
          attendanceRecords: [
            { status: AttendanceStatus.PRESENT },
            { status: AttendanceStatus.PRESENT },
            { status: AttendanceStatus.LATE },
            { status: AttendanceStatus.ABSENT },
          ],
        },
      ];

      jest
        .spyOn(prismaService.staff, 'findMany')
        .mockResolvedValue(mockStaff as any);

      const result = await service.calculateMonthlyStaffAttendance(2024, 1);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'staff-1',
        name: 'Jane Smith',
        identifierId: 'STF001',
        presentCount: 2,
        lateCount: 1,
        absentCount: 1,
        percentage: 75, // (2 + 1) / (2 + 1 + 1) * 100 = 75
        designation: 'Teacher',
        department: 'Mathematics',
      });
    });

    it('should filter by department', async () => {
      const mockStaff = [
        {
          id: 'staff-1',
          staffId: 'STF001',
          firstName: 'Jane',
          lastName: 'Smith',
          designation: 'Teacher',
          department: 'Mathematics',
          attendanceRecords: [{ status: AttendanceStatus.PRESENT }],
        },
      ];

      jest
        .spyOn(prismaService.staff, 'findMany')
        .mockResolvedValue(mockStaff as any);

      await service.calculateMonthlyStaffAttendance(
        2024,
        1,
        'Mathematics',
        undefined,
      );

      expect(prismaService.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            department: 'Mathematics',
          }),
        }),
      );
    });
  });
});
