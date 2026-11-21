import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockExecutionContext = (user: any, _roles?: UserRole[]): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;
  };

  describe('Role Hierarchy', () => {
    it('should allow SUPER_ADMIN to access STUDENT-level routes', () => {
      const context = createMockExecutionContext({
        userId: '1',
        role: UserRole.SUPER_ADMIN,
      });

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.STUDENT]);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow ADMINISTRATOR to access STAFF-level routes', () => {
      const context = createMockExecutionContext({
        userId: '1',
        role: UserRole.ADMINISTRATOR,
      });

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.STAFF]);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny STUDENT access to ADMINISTRATOR-level routes', () => {
      const context = createMockExecutionContext({
        userId: '1',
        role: UserRole.STUDENT,
      });

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMINISTRATOR]);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should deny STAFF access to ADMINISTRATOR-level routes', () => {
      const context = createMockExecutionContext({
        userId: '1',
        role: UserRole.STAFF,
      });

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMINISTRATOR]);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should allow exact role match', () => {
      const context = createMockExecutionContext({
        userId: '1',
        role: UserRole.STAFF,
      });

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.STAFF]);

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('Multiple Roles', () => {
    it('should allow access if user role matches any required role', () => {
      const context = createMockExecutionContext({
        userId: '1',
        role: UserRole.STAFF,
      });

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
        UserRole.STAFF,
        UserRole.ADMINISTRATOR,
      ]);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow SUPER_ADMIN when multiple roles are required', () => {
      const context = createMockExecutionContext({
        userId: '1',
        role: UserRole.SUPER_ADMIN,
      });

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
        UserRole.STAFF,
        UserRole.ADMINISTRATOR,
      ]);

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('No Role Requirements', () => {
    it('should allow access when no roles are specified', () => {
      const context = createMockExecutionContext({
        userId: '1',
        role: UserRole.STUDENT,
      });

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access when empty roles array is specified', () => {
      const context = createMockExecutionContext({
        userId: '1',
        role: UserRole.STUDENT,
      });

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('Error Cases', () => {
    it('should throw ForbiddenException when user is missing', () => {
      const context = createMockExecutionContext(null);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.STAFF]);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('User role information is missing');
    });

    it('should throw ForbiddenException when user role is missing', () => {
      const context = createMockExecutionContext({ userId: '1' });

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.STAFF]);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('User role information is missing');
    });

    it('should throw ForbiddenException with descriptive message on access denial', () => {
      const context = createMockExecutionContext({
        userId: '1',
        role: UserRole.STUDENT,
      });

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
        UserRole.ADMINISTRATOR,
        UserRole.STAFF,
      ]);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(/Access denied/);
    });
  });
});
