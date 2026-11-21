import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AttendanceStatus, UserStatus, RegisterStatus } from '@prisma/client';

describe('AttendanceService', () => {
  let service: AttendanceService;

  const mockPrismaService = {
    class: {
      findUnique: jest.fn(),
    },
    student: {
      findMany: jest.fn(),
    },
    classEnrollment: {
      findMany: jest.fn(),
    },
    studentAttendanceRegister: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    studentAttendance: {
      upsert: jest.fn(),
    },
    staff: {
      findUnique: jest.fn(),
    },
    staffAttendance: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('markStaffAttendance', () => {
    const mockStaff = {
      id: 'staff-1',
      firstName: 'John',
      lastName: 'Doe',
      designation: 'Teacher',
      department: 'Mathematics',
      user: {
        id: 'user-1',
        email: 'john.doe@example.com',
        status: UserStatus.ACTIVE,
      },
    };

    const markAttendanceDto = {
      staffId: 'staff-1',
      attendanceDate: '2024-01-15',
      status: AttendanceStatus.PRESENT,
      remarks: 'On time',
    };

    it('should mark staff attendance successfully', async () => {
      const mockAttendance = {
        id: 'attendance-1',
        staffId: 'staff-1',
        attendanceDate: new Date('2024-01-15'),
        status: AttendanceStatus.PRESENT,
        remarks: 'On time',
        markedBy: 'admin-1',
        markedAt: new Date(),
        staff: mockStaff,
      };

      mockPrismaService.staff.findUnique.mockResolvedValue(mockStaff);
      mockPrismaService.staffAttendance.upsert.mockResolvedValue(mockAttendance);

      const result = await service.markStaffAttendance(
        markAttendanceDto,
        'admin-1',
      );

      expect(result).toEqual({
        id: 'attendance-1',
        staffId: 'staff-1',
        staffName: 'John Doe',
        staffEmail: 'john.doe@example.com',
        designation: 'Teacher',
        department: 'Mathematics',
        attendanceDate: mockAttendance.attendanceDate,
        status: AttendanceStatus.PRESENT,
        remarks: 'On time',
        markedBy: 'admin-1',
        markedAt: mockAttendance.markedAt,
      });

      expect(mockPrismaService.staff.findUnique).toHaveBeenCalledWith({
        where: { id: 'staff-1' },
        include: { user: true },
      });

      expect(mockPrismaService.staffAttendance.upsert).toHaveBeenCalled();
    });

    it('should throw NotFoundException if staff not found', async () => {
      mockPrismaService.staff.findUnique.mockResolvedValue(null);

      await expect(
        service.markStaffAttendance(markAttendanceDto, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if staff is inactive', async () => {
      const inactiveStaff = {
        ...mockStaff,
        user: {
          ...mockStaff.user,
          status: UserStatus.INACTIVE,
        },
      };

      mockPrismaService.staff.findUnique.mockResolvedValue(inactiveStaff);

      await expect(
        service.markStaffAttendance(markAttendanceDto, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid date format', async () => {
      mockPrismaService.staff.findUnique.mockResolvedValue(mockStaff);

      const invalidDto = {
        ...markAttendanceDto,
        attendanceDate: 'invalid-date',
      };

      await expect(
        service.markStaffAttendance(invalidDto, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update existing attendance record (correction)', async () => {
      const mockAttendance = {
        id: 'attendance-1',
        staffId: 'staff-1',
        attendanceDate: new Date('2024-01-15'),
        status: AttendanceStatus.LATE,
        remarks: 'Corrected',
        markedBy: 'admin-1',
        markedAt: new Date(),
        staff: mockStaff,
      };

      mockPrismaService.staff.findUnique.mockResolvedValue(mockStaff);
      mockPrismaService.staffAttendance.upsert.mockResolvedValue(mockAttendance);

      const correctionDto = {
        ...markAttendanceDto,
        status: AttendanceStatus.LATE,
        remarks: 'Corrected',
      };

      const result = await service.markStaffAttendance(correctionDto, 'admin-1');

      expect(result.status).toBe(AttendanceStatus.LATE);
      expect(result.remarks).toBe('Corrected');
    });
  });

  describe('getStaffAttendance', () => {
    const mockAttendanceRecords = [
      {
        id: 'attendance-1',
        staffId: 'staff-1',
        attendanceDate: new Date('2024-01-15'),
        status: AttendanceStatus.PRESENT,
        remarks: null,
        markedBy: 'admin-1',
        markedAt: new Date(),
        staff: {
          id: 'staff-1',
          firstName: 'John',
          lastName: 'Doe',
          designation: 'Teacher',
          department: 'Mathematics',
          user: {
            email: 'john.doe@example.com',
          },
        },
      },
    ];

    it('should return all staff attendance records', async () => {
      mockPrismaService.staffAttendance.findMany.mockResolvedValue(
        mockAttendanceRecords,
      );

      const result = await service.getStaffAttendance({});

      expect(result).toHaveLength(1);
      expect(result[0].staffName).toBe('John Doe');
      expect(mockPrismaService.staffAttendance.findMany).toHaveBeenCalled();
    });

    it('should filter by staff ID', async () => {
      mockPrismaService.staffAttendance.findMany.mockResolvedValue(
        mockAttendanceRecords,
      );

      await service.getStaffAttendance({ staffId: 'staff-1' });

      expect(mockPrismaService.staffAttendance.findMany).toHaveBeenCalledWith({
        where: { staffId: 'staff-1' },
        include: {
          staff: {
            include: {
              user: {
                select: { email: true },
              },
            },
          },
        },
        orderBy: { attendanceDate: 'desc' },
      });
    });

    it('should filter by date range', async () => {
      mockPrismaService.staffAttendance.findMany.mockResolvedValue(
        mockAttendanceRecords,
      );

      await service.getStaffAttendance({
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      });

      expect(mockPrismaService.staffAttendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            attendanceDate: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-01-31'),
            },
          },
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrismaService.staffAttendance.findMany.mockResolvedValue(
        mockAttendanceRecords,
      );

      await service.getStaffAttendance({ status: AttendanceStatus.PRESENT });

      expect(mockPrismaService.staffAttendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: AttendanceStatus.PRESENT },
        }),
      );
    });
  });

  describe('getStaffMemberAttendance', () => {
    const mockStaff = {
      id: 'staff-1',
      firstName: 'John',
      lastName: 'Doe',
    };

    const mockAttendanceRecords = [
      {
        id: 'attendance-1',
        staffId: 'staff-1',
        attendanceDate: new Date('2024-01-15'),
        status: AttendanceStatus.PRESENT,
        remarks: null,
        markedBy: 'admin-1',
        markedAt: new Date(),
        staff: {
          id: 'staff-1',
          firstName: 'John',
          lastName: 'Doe',
          designation: 'Teacher',
          department: 'Mathematics',
          user: {
            email: 'john.doe@example.com',
          },
        },
      },
    ];

    it('should get attendance for specific staff member', async () => {
      mockPrismaService.staff.findUnique.mockResolvedValue(mockStaff);
      mockPrismaService.staffAttendance.findMany.mockResolvedValue(
        mockAttendanceRecords,
      );

      const result = await service.getStaffMemberAttendance('staff-1');

      expect(mockPrismaService.staff.findUnique).toHaveBeenCalledWith({
        where: { id: 'staff-1' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].staffName).toBe('John Doe');
    });

    it('should throw NotFoundException if staff not found', async () => {
      mockPrismaService.staff.findUnique.mockResolvedValue(null);

      await expect(
        service.getStaffMemberAttendance('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should filter by date range', async () => {
      mockPrismaService.staff.findUnique.mockResolvedValue(mockStaff);
      mockPrismaService.staffAttendance.findMany.mockResolvedValue(
        mockAttendanceRecords,
      );

      await service.getStaffMemberAttendance(
        'staff-1',
        '2024-01-01',
        '2024-01-31',
      );

      expect(mockPrismaService.staffAttendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            staffId: 'staff-1',
            attendanceDate: expect.objectContaining({
              gte: new Date('2024-01-01'),
              lte: new Date('2024-01-31'),
            }),
          }),
        }),
      );
    });
  });

  describe('openRegister', () => {
    const mockClass = {
      id: 'class-1',
      name: 'Class 10A',
      status: 'ACTIVE',
    };

    const mockEnrollments = [
      { studentId: 'student-1' },
      { studentId: 'student-2' },
      { studentId: 'student-3' },
    ];

    const mockStudents = [
      {
        id: 'student-1',
        admissionId: 'ADM001',
        firstName: 'Alice',
        lastName: 'Smith',
        user: { email: 'alice@example.com' },
      },
      {
        id: 'student-2',
        admissionId: 'ADM002',
        firstName: 'Bob',
        lastName: 'Jones',
        user: { email: 'bob@example.com' },
      },
      {
        id: 'student-3',
        admissionId: 'ADM003',
        firstName: 'Charlie',
        lastName: 'Brown',
        user: { email: 'charlie@example.com' },
      },
    ];

    const openRegisterDto = {
      classId: 'class-1',
      attendanceDate: '2024-01-15',
    };

    it('should create new register with frozen roster when not exists', async () => {
      const mockRegister = {
        id: 'register-1',
        classId: 'class-1',
        attendanceDate: new Date('2024-01-15'),
        rosterSnapshot: ['student-1', 'student-2', 'student-3'],
        status: RegisterStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
        attendanceRecords: [],
        class: mockClass,
      };

      mockPrismaService.class.findUnique.mockResolvedValue(mockClass);
      mockPrismaService.studentAttendanceRegister.findUnique.mockResolvedValue(null);
      mockPrismaService.classEnrollment.findMany.mockResolvedValue(mockEnrollments);
      mockPrismaService.studentAttendanceRegister.create.mockResolvedValue(mockRegister);
      mockPrismaService.student.findMany.mockResolvedValue(mockStudents);

      const result = await service.openRegister(openRegisterDto);

      expect(result.id).toBe('register-1');
      expect(result.status).toBe(RegisterStatus.DRAFT);
      expect(result.students).toHaveLength(3);
      expect(result.students[0].studentId).toBe('student-1');
      expect(result.students[0].status).toBeUndefined(); // No attendance marked yet

      expect(mockPrismaService.classEnrollment.findMany).toHaveBeenCalledWith({
        where: {
          classId: 'class-1',
          status: 'ACTIVE',
        },
        select: {
          studentId: true,
        },
      });

      expect(mockPrismaService.studentAttendanceRegister.create).toHaveBeenCalledWith({
        data: {
          classId: 'class-1',
          attendanceDate: new Date('2024-01-15'),
          rosterSnapshot: ['student-1', 'student-2', 'student-3'],
          status: RegisterStatus.DRAFT,
        },
        include: {
          attendanceRecords: true,
          class: true,
        },
      });
    });

    it('should retrieve existing register when already exists', async () => {
      const mockRegister = {
        id: 'register-1',
        classId: 'class-1',
        attendanceDate: new Date('2024-01-15'),
        rosterSnapshot: ['student-1', 'student-2'],
        status: RegisterStatus.SAVED,
        createdAt: new Date(),
        updatedAt: new Date(),
        attendanceRecords: [
          {
            id: 'att-1',
            studentId: 'student-1',
            status: AttendanceStatus.PRESENT,
            remarks: null,
            markedAt: new Date(),
          },
        ],
        class: mockClass,
      };

      mockPrismaService.class.findUnique.mockResolvedValue(mockClass);
      mockPrismaService.studentAttendanceRegister.findUnique.mockResolvedValue(mockRegister);
      mockPrismaService.student.findMany.mockResolvedValue(mockStudents.slice(0, 2));

      const result = await service.openRegister(openRegisterDto);

      expect(result.id).toBe('register-1');
      expect(result.status).toBe(RegisterStatus.SAVED);
      expect(result.students[0].status).toBe(AttendanceStatus.PRESENT);
      expect(result.students[1].status).toBeUndefined(); // Student 2 not marked

      // Should NOT create a new register
      expect(mockPrismaService.studentAttendanceRegister.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if class not found', async () => {
      mockPrismaService.class.findUnique.mockResolvedValue(null);

      await expect(service.openRegister(openRegisterDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid date format', async () => {
      mockPrismaService.class.findUnique.mockResolvedValue(mockClass);

      const invalidDto = {
        classId: 'class-1',
        attendanceDate: 'invalid-date',
      };

      await expect(service.openRegister(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should preserve frozen roster when register exists', async () => {
      // Frozen roster has student-1 and student-2
      const mockRegister = {
        id: 'register-1',
        classId: 'class-1',
        attendanceDate: new Date('2024-01-15'),
        rosterSnapshot: ['student-1', 'student-2'],
        status: RegisterStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
        attendanceRecords: [],
        class: mockClass,
      };

      mockPrismaService.class.findUnique.mockResolvedValue(mockClass);
      mockPrismaService.studentAttendanceRegister.findUnique.mockResolvedValue(mockRegister);
      mockPrismaService.student.findMany.mockResolvedValue(mockStudents.slice(0, 2));

      const result = await service.openRegister(openRegisterDto);

      // Should only have students from frozen roster, not new enrollments
      expect(result.students).toHaveLength(2);
      expect(result.students.map(s => s.studentId)).toEqual(['student-1', 'student-2']);
    });
  });

  describe('markStudentAttendance', () => {
    const mockRegister = {
      id: 'register-1',
      classId: 'class-1',
      attendanceDate: new Date('2024-01-15'),
      rosterSnapshot: ['student-1', 'student-2'],
      status: RegisterStatus.DRAFT,
      class: { id: 'class-1', name: 'Class 10A' },
      // markStudentAttendance returns the reloaded register, which includes the records
      attendanceRecords: [] as any[],
    };

    const mockClass = {
      id: 'class-1',
      name: 'Class 10A',
      status: 'ACTIVE',
    };

    const mockStudents = [
      {
        id: 'student-1',
        admissionId: 'ADM001',
        firstName: 'Alice',
        lastName: 'Smith',
        user: { email: 'alice@example.com' },
      },
      {
        id: 'student-2',
        admissionId: 'ADM002',
        firstName: 'Bob',
        lastName: 'Jones',
        user: { email: 'bob@example.com' },
      },
    ];

    const markAttendanceDto = {
      marks: [
        {
          studentId: 'student-1',
          status: AttendanceStatus.PRESENT,
        },
        {
          studentId: 'student-2',
          status: AttendanceStatus.ABSENT,
          remarks: 'Sick',
        },
      ],
    };

    it('should mark student attendance successfully', async () => {
      // 1st lookup: the DRAFT register being marked; 2nd: the reload returned to the caller
      mockPrismaService.studentAttendanceRegister.findUnique.mockResolvedValueOnce(mockRegister);
      mockPrismaService.studentAttendance.upsert.mockResolvedValue({
        id: 'att-1',
        registerId: 'register-1',
        studentId: 'student-1',
        status: AttendanceStatus.PRESENT,
        remarks: null,
        markedBy: 'admin-1',
        markedAt: new Date(),
      });
      mockPrismaService.studentAttendanceRegister.update.mockResolvedValue({
        ...mockRegister,
        status: RegisterStatus.SAVED,
      });

      // Mock openRegister response
      mockPrismaService.class.findUnique.mockResolvedValue(mockClass);
      mockPrismaService.studentAttendanceRegister.findUnique.mockResolvedValueOnce({
        ...mockRegister,
        status: RegisterStatus.SAVED,
        attendanceRecords: [
          {
            id: 'att-1',
            studentId: 'student-1',
            status: AttendanceStatus.PRESENT,
            remarks: null,
            markedAt: new Date(),
          },
          {
            id: 'att-2',
            studentId: 'student-2',
            status: AttendanceStatus.ABSENT,
            remarks: 'Sick',
            markedAt: new Date(),
          },
        ],
      });
      mockPrismaService.student.findMany.mockResolvedValue(mockStudents);

      await service.markStudentAttendance(
        'register-1',
        markAttendanceDto,
        'admin-1',
      );

      expect(mockPrismaService.studentAttendance.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.studentAttendanceRegister.update).toHaveBeenCalledWith({
        where: { id: 'register-1' },
        data: { status: RegisterStatus.SAVED },
      });
    });

    it('should throw NotFoundException if register not found', async () => {
      mockPrismaService.studentAttendanceRegister.findUnique.mockResolvedValue(null);

      await expect(
        service.markStudentAttendance('non-existent', markAttendanceDto, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if student not in roster', async () => {
      mockPrismaService.studentAttendanceRegister.findUnique.mockResolvedValue(mockRegister);

      const invalidDto = {
        marks: [
          {
            studentId: 'student-999', // Not in roster
            status: AttendanceStatus.PRESENT,
          },
        ],
      };

      await expect(
        service.markStudentAttendance('register-1', invalidDto, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update existing attendance (correction)', async () => {
      const savedRegister = {
        ...mockRegister,
        status: RegisterStatus.SAVED,
      };

      mockPrismaService.studentAttendanceRegister.findUnique.mockResolvedValue(savedRegister);
      mockPrismaService.studentAttendance.upsert.mockResolvedValue({
        id: 'att-1',
        registerId: 'register-1',
        studentId: 'student-1',
        status: AttendanceStatus.LATE, // Changed from PRESENT to LATE
        remarks: 'Arrived late',
        markedBy: 'admin-1',
        markedAt: new Date(),
      });

      // Mock openRegister for return
      mockPrismaService.class.findUnique.mockResolvedValue(mockClass);
      mockPrismaService.studentAttendanceRegister.findUnique.mockResolvedValue(savedRegister);
      mockPrismaService.student.findMany.mockResolvedValue(mockStudents);

      const correctionDto = {
        marks: [
          {
            studentId: 'student-1',
            status: AttendanceStatus.LATE,
            remarks: 'Arrived late',
          },
        ],
      };

      await service.markStudentAttendance('register-1', correctionDto, 'admin-1');

      expect(mockPrismaService.studentAttendance.upsert).toHaveBeenCalledWith({
        where: {
          registerId_studentId: {
            registerId: 'register-1',
            studentId: 'student-1',
          },
        },
        create: {
          registerId: 'register-1',
          studentId: 'student-1',
          status: AttendanceStatus.LATE,
          remarks: 'Arrived late',
          markedBy: 'admin-1',
          markedAt: expect.any(Date),
        },
        update: {
          status: AttendanceStatus.LATE,
          remarks: 'Arrived late',
          markedBy: 'admin-1',
          markedAt: expect.any(Date),
        },
      });

      // Status should remain SAVED (not reverted to DRAFT)
      expect(mockPrismaService.studentAttendanceRegister.update).not.toHaveBeenCalled();
    });

    it('should allow partial marking', async () => {
      mockPrismaService.studentAttendanceRegister.findUnique.mockResolvedValue(mockRegister);
      mockPrismaService.studentAttendance.upsert.mockResolvedValue({
        id: 'att-1',
        registerId: 'register-1',
        studentId: 'student-1',
        status: AttendanceStatus.PRESENT,
        remarks: null,
        markedBy: 'admin-1',
        markedAt: new Date(),
      });
      mockPrismaService.studentAttendanceRegister.update.mockResolvedValue({
        ...mockRegister,
        status: RegisterStatus.SAVED,
      });

      // Mock openRegister
      mockPrismaService.class.findUnique.mockResolvedValue(mockClass);
      mockPrismaService.student.findMany.mockResolvedValue(mockStudents);

      const partialDto = {
        marks: [
          {
            studentId: 'student-1',
            status: AttendanceStatus.PRESENT,
          },
        ],
      };

      await service.markStudentAttendance('register-1', partialDto, 'admin-1');

      // Should only mark one student
      expect(mockPrismaService.studentAttendance.upsert).toHaveBeenCalledTimes(1);
    });

    it('should update markedBy and markedAt on correction', async () => {
      const savedRegister = {
        ...mockRegister,
        status: RegisterStatus.SAVED,
      };

      mockPrismaService.studentAttendanceRegister.findUnique.mockResolvedValue(savedRegister);
      
      const mockUpsert = jest.fn().mockResolvedValue({
        id: 'att-1',
        registerId: 'register-1',
        studentId: 'student-1',
        status: AttendanceStatus.PRESENT,
        remarks: 'Corrected',
        markedBy: 'staff-2',
        markedAt: new Date(),
      });
      
      mockPrismaService.studentAttendance.upsert = mockUpsert;

      // Mock openRegister
      mockPrismaService.class.findUnique.mockResolvedValue(mockClass);
      mockPrismaService.student.findMany.mockResolvedValue(mockStudents);

      const correctionDto = {
        marks: [
          {
            studentId: 'student-1',
            status: AttendanceStatus.PRESENT,
            remarks: 'Corrected',
          },
        ],
      };

      await service.markStudentAttendance('register-1', correctionDto, 'staff-2');

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            markedBy: 'staff-2',
            markedAt: expect.any(Date),
          }),
        }),
      );
    });
  });
});
