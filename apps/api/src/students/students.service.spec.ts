import { Test, TestingModule } from '@nestjs/testing';
import { StudentsService } from './students.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, AttendanceStatus } from '@prisma/client';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('StudentsService - Attendance History', () => {
  let service: StudentsService;
  let prisma: PrismaService;

  const mockStudent = {
    id: 'student-1',
    userId: 'user-1',
    admissionId: 'STU2024001',
    firstName: 'John',
    lastName: 'Doe',
    user: {
      id: 'user-1',
      email: 'john@example.com',
    },
  };

  const mockAttendanceRecords = [
    {
      id: 'attendance-1',
      studentId: 'student-1',
      status: AttendanceStatus.PRESENT,
      remarks: 'On time',
      markedBy: 'admin-1',
      markedAt: new Date('2024-01-15T10:00:00Z'),
      register: {
        classId: 'class-1',
        attendanceDate: new Date('2024-01-15'),
        class: {
          id: 'class-1',
          name: 'Class A',
        },
      },
      student: {
        id: 'student-1',
        admissionId: 'STU2024001',
        firstName: 'John',
        lastName: 'Doe',
      },
    },
    {
      id: 'attendance-2',
      studentId: 'student-1',
      status: AttendanceStatus.LATE,
      remarks: '10 minutes late',
      markedBy: 'admin-1',
      markedAt: new Date('2024-01-16T10:00:00Z'),
      register: {
        classId: 'class-1',
        attendanceDate: new Date('2024-01-16'),
        class: {
          id: 'class-1',
          name: 'Class A',
        },
      },
      student: {
        id: 'student-1',
        admissionId: 'STU2024001',
        firstName: 'John',
        lastName: 'Doe',
      },
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        {
          provide: PrismaService,
          useValue: {
            student: {
              findUnique: jest.fn(),
            },
            studentAttendance: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getStudentAttendance', () => {
    it('should return attendance records for a student', async () => {
      jest.spyOn(prisma.student, 'findUnique').mockResolvedValue(mockStudent as any);
      jest.spyOn(prisma.studentAttendance, 'findMany').mockResolvedValue(mockAttendanceRecords as any);

      const result = await service.getStudentAttendance(
        'student-1',
        {},
        'user-1',
        UserRole.STUDENT,
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        studentId: 'student-1',
        studentName: 'John Doe',
        className: 'Class A',
        status: AttendanceStatus.PRESENT,
      });
      expect(result[1]).toMatchObject({
        studentId: 'student-1',
        studentName: 'John Doe',
        className: 'Class A',
        status: AttendanceStatus.LATE,
      });
    });

    it('should throw NotFoundException if student does not exist', async () => {
      jest.spyOn(prisma.student, 'findUnique').mockResolvedValue(null);

      await expect(
        service.getStudentAttendance('student-1', {}, 'user-1', UserRole.ADMINISTRATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if student tries to view another student\'s attendance', async () => {
      jest.spyOn(prisma.student, 'findUnique').mockResolvedValue(mockStudent as any);

      await expect(
        service.getStudentAttendance('student-1', {}, 'user-2', UserRole.STUDENT),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow administrators to view any student\'s attendance', async () => {
      jest.spyOn(prisma.student, 'findUnique').mockResolvedValue(mockStudent as any);
      jest.spyOn(prisma.studentAttendance, 'findMany').mockResolvedValue(mockAttendanceRecords as any);

      const result = await service.getStudentAttendance(
        'student-1',
        {},
        'admin-1',
        UserRole.ADMINISTRATOR,
      );

      expect(result).toHaveLength(2);
    });

    it('should filter by class ID', async () => {
      jest.spyOn(prisma.student, 'findUnique').mockResolvedValue(mockStudent as any);
      const findManySpy = jest.spyOn(prisma.studentAttendance, 'findMany').mockResolvedValue([] as any);

      await service.getStudentAttendance(
        'student-1',
        { classId: 'class-1' },
        'user-1',
        UserRole.STUDENT,
      );

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            register: expect.objectContaining({
              classId: 'class-1',
            }),
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      jest.spyOn(prisma.student, 'findUnique').mockResolvedValue(mockStudent as any);
      const findManySpy = jest.spyOn(prisma.studentAttendance, 'findMany').mockResolvedValue([] as any);

      await service.getStudentAttendance(
        'student-1',
        { dateFrom: '2024-01-01', dateTo: '2024-01-31' },
        'user-1',
        UserRole.STUDENT,
      );

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            register: expect.objectContaining({
              attendanceDate: expect.objectContaining({
                gte: expect.any(Date),
                lte: expect.any(Date),
              }),
            }),
          }),
        }),
      );
    });

    it('should filter by status', async () => {
      jest.spyOn(prisma.student, 'findUnique').mockResolvedValue(mockStudent as any);
      const findManySpy = jest.spyOn(prisma.studentAttendance, 'findMany').mockResolvedValue([] as any);

      await service.getStudentAttendance(
        'student-1',
        { status: AttendanceStatus.PRESENT },
        'user-1',
        UserRole.STUDENT,
      );

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: AttendanceStatus.PRESENT,
          }),
        }),
      );
    });
  });

  describe('getAllStudentsAttendance', () => {
    it('should return attendance records for all students', async () => {
      jest.spyOn(prisma.studentAttendance, 'findMany').mockResolvedValue(mockAttendanceRecords as any);

      const result = await service.getAllStudentsAttendance({});

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        studentId: 'student-1',
        studentName: 'John Doe',
        className: 'Class A',
      });
    });

    it('should filter by student ID', async () => {
      const findManySpy = jest.spyOn(prisma.studentAttendance, 'findMany').mockResolvedValue([] as any);

      await service.getAllStudentsAttendance({ studentId: 'student-1' });

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            studentId: 'student-1',
          }),
        }),
      );
    });

    it('should filter by multiple criteria', async () => {
      const findManySpy = jest.spyOn(prisma.studentAttendance, 'findMany').mockResolvedValue([] as any);

      await service.getAllStudentsAttendance({
        studentId: 'student-1',
        classId: 'class-1',
        status: AttendanceStatus.PRESENT,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      });

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            studentId: 'student-1',
            status: AttendanceStatus.PRESENT,
            register: expect.objectContaining({
              classId: 'class-1',
              attendanceDate: expect.objectContaining({
                gte: expect.any(Date),
                lte: expect.any(Date),
              }),
            }),
          }),
        }),
      );
    });
  });
});
