import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Role Hierarchy (highest to lowest authority)
 * SUPER_ADMIN > ADMINISTRATOR > STAFF > STUDENT
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 4,
  ADMINISTRATOR: 3,
  STAFF: 2,
  STUDENT: 1,
};

/**
 * Roles Guard - Role-Based Access Control
 * 
 * Enforces role requirements on protected routes with role hierarchy support.
 * If a route requires STAFF role, ADMINISTRATOR and SUPER_ADMIN are also granted access.
 * 
 * Role Hierarchy:
 * - SUPER_ADMIN: Full system access (highest authority)
 * - ADMINISTRATOR: Full system management (second highest)
 * - STAFF: Permission-based access (third)
 * - STUDENT: Own records only (lowest)
 * 
 * Usage:
 * @Roles(UserRole.ADMINISTRATOR)
 * @Get('/admin-only')
 * async adminRoute() { ... }
 * 
 * @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
 * @Get('/staff-or-admin')
 * async staffRoute() { ... }
 * 
 * @see @Roles() decorator
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from @Roles() decorator
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No roles specified = allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Extract user from request (populated by JwtAuthGuard)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User should be populated by JWT guard, but defensive check
    if (!user || !user.role) {
      throw new ForbiddenException('User role information is missing');
    }

    // Check if user's role satisfies any required role (with hierarchy)
    const hasRequiredRole = this.checkRoleHierarchy(
      user.role,
      requiredRoles,
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `Access denied. Required role(s): ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }

  /**
   * Checks if user role meets or exceeds any of the required roles
   * 
   * @param userRole Current user's role
   * @param requiredRoles Array of acceptable roles
   * @returns true if user role hierarchy level >= minimum required level
   */
  private checkRoleHierarchy(
    userRole: UserRole,
    requiredRoles: UserRole[],
  ): boolean {
    const userLevel = ROLE_HIERARCHY[userRole];

    // Find the minimum required role level
    const minRequiredLevel = Math.min(
      ...requiredRoles.map((role) => ROLE_HIERARCHY[role]),
    );

    // User must have role level >= minimum required level
    return userLevel >= minRequiredLevel;
  }
}
