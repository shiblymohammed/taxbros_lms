import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StaffCategory, UserRole } from '@prisma/client';
import { StudentsService } from './students.service';
import { buildStaffFilter, buildStudentFilter, UsersService } from '../users/users.service';

/**
 * Student profile (R2.5, R5.4, R26.5) and user search filters (R1.11, R1.12).
 */
describe('StudentsService.findOne (profile)', () => {
  const student = {
    id: 'stu-1',
    userId: 'user-1',
    admissionId: 'TB-001',
    firstName: 'Aarav',
    lastName: 'Pillai',
    user: { id: 'user-1', email: 'a@taxbros.test', passwordHash: 'hash', passwordResetToken: 'tok', passwordResetExpiry: null },
    courseEnrollments: [{ id: 'ce-1', progressPercentage: 40, course: { id: 'c1', title: 'GST Basics' } }],
    classEnrollments: [],
    quizAttempts: [{ id: 'qa-1', score: 4, passed: true, quiz: { title: 'GST quiz', totalMarks: 5, passMark: 3 } }],
  };
  const prisma = { student: { findUnique: jest.fn() } };
  const service = new StudentsService(prisma as any);

  beforeEach(() => prisma.student.findUnique.mockResolvedValue(structuredClone(student)));

  it('returns course progress and every quiz attempt for an administrator, without secrets', async () => {
    const result: any = await service.findOne('stu-1', 'admin-1', UserRole.ADMINISTRATOR);

    expect(result.courseEnrollments[0].progressPercentage).toBe(40);
    expect(result.quizAttempts).toHaveLength(1);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user).not.toHaveProperty('passwordResetToken');

    const include = prisma.student.findUnique.mock.calls[0][0].include;
    expect(include).toHaveProperty('courseEnrollments');
    expect(include).toHaveProperty('classEnrollments');
    expect(include.quizAttempts.orderBy).toEqual({ submittedAt: 'desc' });
  });

  it('lets a student read their own profile but not anyone else\'s (R2.5)', async () => {
    await expect(service.findOne('stu-1', 'user-1', UserRole.STUDENT)).resolves.toMatchObject({ id: 'stu-1' });
    await expect(service.findOne('stu-1', 'user-2', UserRole.STUDENT)).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFound for an unknown student', async () => {
    prisma.student.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing', 'admin-1', UserRole.ADMINISTRATOR)).rejects.toThrow(NotFoundException);
  });
});

describe('StudentsService.findAll class filter (R1.11)', () => {
  it('limits results to students actively enrolled in the class', async () => {
    const prisma = { student: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) } };
    await new StudentsService(prisma as any).findAll({ classId: 'class-1' });
    expect(prisma.student.findMany.mock.calls[0][0].where.classEnrollments).toEqual({
      some: { classId: 'class-1', status: 'ACTIVE' },
    });
  });
});

describe('user search filters', () => {
  it('builds student filters for admission ID, class and admission date range (R1.11)', () => {
    expect(buildStudentFilter({})).toBeNull();
    expect(
      buildStudentFilter({ admissionId: ' tb-0 ', classId: 'class-1', admissionDateFrom: '2026-06-01', admissionDateTo: '2026-06-30' }),
    ).toEqual({
      admissionId: { contains: 'tb-0', mode: 'insensitive' },
      classEnrollments: { some: { classId: 'class-1', status: 'ACTIVE' } },
      admissionDate: { gte: new Date('2026-06-01'), lte: new Date('2026-06-30') },
    });
  });

  it('builds staff filters for staff ID, department, category and designation (R1.12)', () => {
    expect(buildStaffFilter({ department: '  ' })).toBeNull();
    expect(
      buildStaffFilter({ staffId: 'ST-1', department: 'GST', category: StaffCategory.TEACHING, designation: 'Trainer' }),
    ).toEqual({
      staffId: { contains: 'ST-1', mode: 'insensitive' },
      department: { contains: 'GST', mode: 'insensitive' },
      designation: { contains: 'Trainer', mode: 'insensitive' },
      category: StaffCategory.TEACHING,
    });
  });

  it('applies them to the user search', async () => {
    const prisma = { user: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) } };
    const service = new UsersService(prisma as any);
    await service.findAll({ role: UserRole.STUDENT, classId: 'class-1', department: 'GST' });

    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.role).toBe(UserRole.STUDENT);
    expect(where.studentProfile).toEqual({ is: { classEnrollments: { some: { classId: 'class-1', status: 'ACTIVE' } } } });
    expect(where.staffProfile).toEqual({ is: { department: { contains: 'GST', mode: 'insensitive' } } });
  });
});
