import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, StaffPermissionType } from '@prisma/client';
import { CurrentUserPayload } from '../decorators/current-user.decorator';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let prismaService: PrismaService;

  // Mock execution context factory
  const createMockExecutionContext = (
    user: Partial<CurrentUserPayload>,
    _requiredPermission?: StaffPermissionType,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            staffPermission: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
    reflector = module.get<Reflector>(Reflector);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('No Permission Required', () => {
    it('should allow access when no permission is specified', async () => {
      const user: CurrentUserPayload = {
        userId: 'user-1',
        email: 'staff@test.com',
        role: UserRole.STAFF,
        status: 'ACTIVE' as any,
        staffId: 'staff-1',
      };

      const context = createMockExecutionContext(user);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prismaService.staffPermission.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('ADMINISTRATOR Role', () => {
    it('should allow ADMINISTRATOR to access without permission check', async () => {
      const user: CurrentUserPayload = {
        userId: 'user-1',
        email: 'admin@test.com',
        role: UserRole.ADMINISTRATOR,
        status: 'ACTIVE' as any,
      };

      const context = createMockExecutionContext(
        user,
        StaffPermissionType.MARK_ATTENDANCE,
      );
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(StaffPermissionType.MARK_ATTENDANCE);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prismaService.staffPermission.findUnique).not.toHaveBeenCalled();
    });

    it('should allow SUPER_ADMIN to access without permission check', async () => {
      const user: CurrentUserPayload = {
        userId: 'user-1',
        email: 'superadmin@test.com',
        role: UserRole.SUPER_ADMIN,
        status: 'ACTIVE' as any,
      };

      const context = createMockExecutionContext(
        user,
        StaffPermissionType.VIEW_REPORTS,
      );
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(StaffPermissionType.VIEW_REPORTS);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prismaService.staffPermission.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('STUDENT Role', () => {
    it('should deny STUDENT access when permission is required', async () => {
      const user: CurrentUserPayload = {
        userId: 'user-1',
        email: 'student@test.com',
        role: UserRole.STUDENT,
        status: 'ACTIVE' as any,
        studentId: 'student-1',
      };

      const context = createMockExecutionContext(
        user,
        StaffPermissionType.MARK_ATTENDANCE,
      );
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(StaffPermissionType.MARK_ATTENDANCE);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Students do not have permission to access this resource',
      );
      expect(prismaService.staffPermission.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('STAFF Role - With Permission', () => {
    it('should allow STAFF with MARK_ATTENDANCE permission', async () => {
      const user: CurrentUserPayload = {
        userId: 'user-1',
        email: 'staff@test.com',
        role: UserRole.STAFF,
        status: 'ACTIVE' as any,
        staffId: 'staff-1',
      };

      const context = createMockExecutionContext(
        user,
        StaffPermissionType.MARK_ATTENDANCE,
      );
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(StaffPermissionType.MARK_ATTENDANCE);

      jest.spyOn(prismaService.staffPermission, 'findUnique').mockResolvedValue({
        id: 'perm-1',
        staffId: 'staff-1',
        permission: StaffPermissionType.MARK_ATTENDANCE,
        grantedBy: 'admin-1',
        grantedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prismaService.staffPermission.findUnique).toHaveBeenCalledWith({
        where: {
          staffId_permission: {
            staffId: 'staff-1',
            permission: StaffPermissionType.MARK_ATTENDANCE,
          },
        },
      });
    });

    it('should allow STAFF with VIEW_REPORTS permission', async () => {
      const user: CurrentUserPayload = {
        userId: 'user-2',
        email: 'staff2@test.com',
        role: UserRole.STAFF,
        status: 'ACTIVE' as any,
        staffId: 'staff-2',
      };

      const context = createMockExecutionContext(
        user,
        StaffPermissionType.VIEW_REPORTS,
      );
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(StaffPermissionType.VIEW_REPORTS);

      jest.spyOn(prismaService.staffPermission, 'findUnique').mockResolvedValue({
        id: 'perm-2',
        staffId: 'staff-2',
        permission: StaffPermissionType.VIEW_REPORTS,
        grantedBy: 'admin-1',
        grantedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prismaService.staffPermission.findUnique).toHaveBeenCalledWith({
        where: {
          staffId_permission: {
            staffId: 'staff-2',
            permission: StaffPermissionType.VIEW_REPORTS,
          },
        },
      });
    });

    it('should allow STAFF with MANAGE_COURSES permission', async () => {
      const user: CurrentUserPayload = {
        userId: 'user-3',
        email: 'staff3@test.com',
        role: UserRole.STAFF,
        status: 'ACTIVE' as any,
        staffId: 'staff-3',
      };

      const context = createMockExecutionContext(
        user,
        StaffPermissionType.MANAGE_COURSES,
      );
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(StaffPermissionType.MANAGE_COURSES);

      jest.spyOn(prismaService.staffPermission, 'findUnique').mockResolvedValue({
        id: 'perm-3',
        staffId: 'staff-3',
        permission: StaffPermissionType.MANAGE_COURSES,
        grantedBy: 'admin-1',
        grantedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('STAFF Role - Without Permission', () => {
    it('should deny STAFF without MARK_ATTENDANCE permission', async () => {
      const user: CurrentUserPayload = {
        userId: 'user-1',
        email: 'staff@test.com',
        role: UserRole.STAFF,
        status: 'ACTIVE' as any,
        staffId: 'staff-1',
      };

      const context = createMockExecutionContext(
        user,
        StaffPermissionType.MARK_ATTENDANCE,
      );
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(StaffPermissionType.MARK_ATTENDANCE);

      jest.spyOn(prismaService.staffPermission, 'findUnique').mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Access denied. Required permission: MARK_ATTENDANCE',
      );
      expect(prismaService.staffPermission.findUnique).toHaveBeenCalled();
    });

    it('should deny STAFF without VIEW_REPORTS permission', async () => {
      const user: CurrentUserPayload = {
        userId: 'user-2',
        email: 'staff2@test.com',
        role: UserRole.STAFF,
        status: 'ACTIVE' as any,
        staffId: 'staff-2',
      };

      const context = createMockExecutionContext(
        user,
        StaffPermissionType.VIEW_REPORTS,
      );
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(StaffPermissionType.VIEW_REPORTS);

      jest.spyOn(prismaService.staffPermission, 'findUnique').mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Access denied. Required permission: VIEW_REPORTS',
      );
    });

    it('should deny STAFF without MANAGE_STUDENTS permission', async () => {
      const user: CurrentUserPayload = {
        userId: 'user-3',
        email: 'staff3@test.com',
        role: UserRole.STAFF,
        status: 'ACTIVE' as any,
        staffId: 'staff-3',
      };

      const context = createMockExecutionContext(
        user,
        StaffPermissionType.MANAGE_STUDENTS,
      );
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(StaffPermissionType.MANAGE_STUDENTS);

      jest.spyOn(prismaService.staffPermission, 'findUnique').mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Access denied. Required permission: MANAGE_STUDENTS',
      );
    });
  });

  describe('Error Cases', () => {
    it('should throw ForbiddenException when user is missing', async () => {
      const context = createMockExecutionContext({});
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(StaffPermissionType.MARK_ATTENDANCE);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'User information is missing',
      );
    });

    it('should throw ForbiddenException when user role is missing', async () => {
      const user = {
        userId: 'user-1',
        email: 'test@test.com',
      };

      const context = createMockExecutionContext(user);
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(StaffPermissionType.MARK_ATTENDANCE);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'User information is missing',
      );
    });

    it('should throw ForbiddenException when STAFF user has no staffId', async () => {
      const user: Partial<CurrentUserPayload> = {
        userId: 'user-1',
        email: 'staff@test.com',
        role: UserRole.STAFF,
        status: 'ACTIVE' as any,
        // staffId is missing
      };

      const context = createMockExecutionContext(
        user,
        StaffPermissionType.MARK_ATTENDANCE,
      );
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(StaffPermissionType.MARK_ATTENDANCE);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Staff profile information is missing',
      );
    });
  });

  describe('Permission Type Coverage', () => {
    it.each([
      StaffPermissionType.MARK_ATTENDANCE,
      StaffPermissionType.VIEW_REPORTS,
      StaffPermissionType.MANAGE_COURSES,
      StaffPermissionType.MANAGE_STUDENTS,
      StaffPermissionType.MANAGE_STAFF,
      StaffPermissionType.MANAGE_CLASSES,
      StaffPermissionType.MANAGE_LABS,
    ])('should handle %s permission correctly', async (permissionType) => {
      const user: CurrentUserPayload = {
        userId: 'user-1',
        email: 'staff@test.com',
        role: UserRole.STAFF,
        status: 'ACTIVE' as any,
        staffId: 'staff-1',
      };

      const context = createMockExecutionContext(user, permissionType);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(permissionType);

      jest.spyOn(prismaService.staffPermission, 'findUnique').mockResolvedValue({
        id: 'perm-1',
        staffId: 'staff-1',
        permission: permissionType,
        grantedBy: 'admin-1',
        grantedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prismaService.staffPermission.findUnique).toHaveBeenCalledWith({
        where: {
          staffId_permission: {
            staffId: 'staff-1',
            permission: permissionType,
          },
        },
      });
    });
  });

  describe('Database Query', () => {
    it('should use correct compound unique constraint in query', async () => {
      const user: CurrentUserPayload = {
        userId: 'user-1',
        email: 'staff@test.com',
        role: UserRole.STAFF,
        status: 'ACTIVE' as any,
        staffId: 'staff-123',
      };

      const context = createMockExecutionContext(
        user,
        StaffPermissionType.MARK_ATTENDANCE,
      );
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(StaffPermissionType.MARK_ATTENDANCE);

      jest.spyOn(prismaService.staffPermission, 'findUnique').mockResolvedValue({
        id: 'perm-1',
        staffId: 'staff-123',
        permission: StaffPermissionType.MARK_ATTENDANCE,
        grantedBy: 'admin-1',
        grantedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await guard.canActivate(context);

      expect(prismaService.staffPermission.findUnique).toHaveBeenCalledWith({
        where: {
          staffId_permission: {
            staffId: 'staff-123',
            permission: StaffPermissionType.MARK_ATTENDANCE,
          },
        },
      });
    });
  });
});
