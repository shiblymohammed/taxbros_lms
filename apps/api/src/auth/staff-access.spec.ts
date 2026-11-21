import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { StaffPermissionType as P, UserRole } from '@prisma/client';
import { StaffAccessService, AccessUser } from './staff-access.service';
import { PERMISSION_KEY } from './decorators/require-permission.decorator';
import { ROLES_KEY } from './decorators/roles.decorator';
import { PermissionsGuard } from './guards/permissions.guard';
import { CoursesController } from '../courses/courses.controller';
import { ModulesController } from '../courses/modules.controller';
import { LessonsController } from '../courses/lessons.controller';
import { QuizzesController } from '../quizzes/quizzes.controller';
import { UploadController } from '../upload/upload.controller';
import { ClassesController } from '../classes/classes.controller';
import { LabController } from '../lab/lab.controller';
import { UsersController } from '../users/users.controller';
import { StaffController } from '../staff/staff.controller';

/** Staff access to admin features through MANAGE_* permissions (R2.7, R2.8, R3). */
describe('admin routes opened to staff by permission', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gated: Array<[new (...args: any[]) => unknown, string[], P]> = [
    [CoursesController, ['create', 'update', 'remove'], P.MANAGE_COURSES],
    [ModulesController, ['create', 'update', 'remove'], P.MANAGE_COURSES],
    [LessonsController, ['create', 'update', 'publish', 'unpublish', 'remove'], P.MANAGE_COURSES],
    [QuizzesController, ['create', 'update', 'publish', 'remove', 'addQuestion', 'updateQuestion', 'removeQuestion'], P.MANAGE_COURSES],
    [UploadController, ['uploadCourseCover', 'deleteCourseCover'], P.MANAGE_COURSES],
    [ClassesController, ['create', 'update', 'enrollStudent', 'unenrollStudent'], P.MANAGE_CLASSES],
    [LabController, ['updateSampleData', 'updateLabStatus'], P.MANAGE_LABS],
  ];

  it.each(gated)('%p write routes need the permission', (controller, methods, permission) => {
    expect(Reflect.getMetadata(GUARDS_METADATA, controller)).toContain(PermissionsGuard);
    for (const m of methods) {
      const handler = (controller.prototype as any)[m];
      expect([m, Reflect.getMetadata(PERMISSION_KEY, handler)]).toEqual([m, permission]);
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toContain(UserRole.STAFF);
    }
  });

  it('keeps granting permissions for administrators only (no self-promotion)', () => {
    for (const m of ['grantPermission', 'revokePermission', 'getPermissions']) {
      expect(Reflect.getMetadata(ROLES_KEY, (StaffController.prototype as any)[m])).toEqual([UserRole.ADMINISTRATOR]);
    }
  });

  it('opens the users area to staff, with checks per account', () => {
    expect(Reflect.getMetadata(ROLES_KEY, UsersController)).toEqual([UserRole.STAFF]);
  });
});

describe('StaffAccessService', () => {
  const prisma = {
    staffPermission: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    student: { findUnique: jest.fn() },
    staff: { findUnique: jest.fn() },
  };
  const service = new StaffAccessService(prisma as any);
  const admin: AccessUser = { userId: 'admin', role: UserRole.ADMINISTRATOR };
  const staff: AccessUser = { userId: 'me', role: UserRole.STAFF, staffId: 'staff-me' };
  const student: AccessUser = { userId: 'stu', role: UserRole.STUDENT };

  const grant = (...perms: P[]) =>
    prisma.staffPermission.findMany.mockResolvedValue(perms.map((permission) => ({ permission })));
  const target = (role: UserRole, perms: P[] = []) =>
    prisma.user.findUnique.mockResolvedValue({
      role,
      staffProfile: role === UserRole.STAFF ? { permissions: perms.map((permission) => ({ permission })) } : null,
    });

  beforeEach(() => jest.resetAllMocks());

  it('gives administrators everything and students nothing', async () => {
    expect(await service.permissionsOf(admin)).toEqual(Object.values(P));
    expect(await service.permissionsOf(student)).toEqual([]);
    await expect(service.assertAny(student, [P.MANAGE_COURSES])).rejects.toThrow(ForbiddenException);
    expect(prisma.staffPermission.findMany).not.toHaveBeenCalled();
  });

  it('reads staff permissions on every check, so revoking works at once (R3.5)', async () => {
    grant(P.MANAGE_CLASSES);
    await expect(service.assertAny(staff, [P.MANAGE_CLASSES])).resolves.toBeUndefined();
    grant();
    await expect(service.assertAny(staff, [P.MANAGE_CLASSES])).rejects.toThrow('MANAGE_CLASSES');
  });

  it('limits account creation to the roles staff manage', async () => {
    grant(P.MANAGE_STUDENTS);
    await expect(service.assertCanCreate(staff, UserRole.STUDENT)).resolves.toBeUndefined();
    await expect(service.assertCanCreate(staff, UserRole.STAFF)).rejects.toThrow('MANAGE_STAFF');
    await expect(service.assertCanCreate(staff, UserRole.ADMINISTRATOR)).rejects.toThrow(/administrator/);
    expect(await service.manageableRoles(admin)).toBeNull();
  });

  it('lets staff manage students only with MANAGE_STUDENTS, and never administrators', async () => {
    grant(P.MANAGE_STUDENTS);
    target(UserRole.STUDENT);
    await expect(service.assertCanManageUser(staff, 'stu-1')).resolves.toBeUndefined();
    target(UserRole.ADMINISTRATOR);
    await expect(service.assertCanManageUser(staff, 'admin-1')).rejects.toThrow(/administrator/);
    grant(P.MANAGE_CLASSES);
    target(UserRole.STUDENT);
    await expect(service.assertCanManageUser(staff, 'stu-1')).rejects.toThrow('MANAGE_STUDENTS');
  });

  it('stops staff from taking over a more powerful staff account', async () => {
    grant(P.MANAGE_STAFF, P.MARK_ATTENDANCE);
    target(UserRole.STAFF, [P.MARK_ATTENDANCE]);
    await expect(service.assertCanManageUser(staff, 'staff-2')).resolves.toBeUndefined();
    target(UserRole.STAFF, [P.MARK_ATTENDANCE, P.MANAGE_COURSES]);
    await expect(service.assertCanManageUser(staff, 'staff-3')).rejects.toThrow(/MANAGE_COURSES/);
  });

  it("doesn't let staff manage their own account here", async () => {
    grant(P.MANAGE_STAFF);
    await expect(service.assertCanManageUser(staff, 'me')).rejects.toThrow(/your own account/);
  });

  it('checks profile IDs through their user account, and still needs the permission for unknown IDs', async () => {
    grant(P.MANAGE_STUDENTS);
    prisma.student.findUnique.mockResolvedValue({ userId: 'stu-1' });
    target(UserRole.STUDENT);
    await expect(service.assertCanManageProfile(staff, 'student', 'profile-1')).resolves.toBeUndefined();

    prisma.staff.findUnique.mockResolvedValue(null);
    await expect(service.assertCanManageProfile(staff, 'staff', 'missing')).rejects.toThrow('MANAGE_STAFF');
  });
});

describe('UsersController with staff', () => {
  const usersService = { findAll: jest.fn().mockResolvedValue({ data: [] }), create: jest.fn() };
  const access = {
    manageableRoles: jest.fn(),
    assertCanCreate: jest.fn(),
  };
  const controller = new UsersController(usersService as any, access as any);
  const req = { user: { userId: 'me', role: UserRole.STAFF, staffId: 's' } };

  it('lists only the account types staff manage', async () => {
    access.manageableRoles.mockResolvedValue([UserRole.STUDENT]);
    await controller.findAll({} as any, req);
    expect(usersService.findAll).toHaveBeenCalledWith({}, [UserRole.STUDENT]);
    await expect(controller.findAll({ role: UserRole.ADMINISTRATOR } as any, req)).rejects.toThrow(ForbiddenException);
    access.manageableRoles.mockResolvedValue([]);
    await expect(controller.findAll({} as any, req)).rejects.toThrow(ForbiddenException);
  });

  it('checks the role before creating an account', async () => {
    access.assertCanCreate.mockRejectedValue(new ForbiddenException('no'));
    await expect(controller.create({ role: UserRole.STAFF } as any, 'me', req)).rejects.toThrow(ForbiddenException);
    expect(usersService.create).not.toHaveBeenCalled();
  });
});
