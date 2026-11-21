import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, StaffPermissionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { CurrentUserPayload } from '../decorators/current-user.decorator';

/**
 * Permissions Guard - Fine-Grained Access Control for Staff
 * 
 * Enforces permission requirements on protected routes with role-specific logic:
 * 
 * Permission Check Logic:
 * 1. ADMINISTRATOR role → Automatically allow (bypass permission check)
 * 2. STAFF role → Query StaffPermission table for required permission
 * 3. STUDENT role → Deny access (students don't have permissions)
 * 4. Missing permission → Return HTTP 403 Forbidden
 * 
 * This guard works in conjunction with:
 * - JwtAuthGuard: Ensures user is authenticated
 * - RolesGuard: Ensures user has appropriate role
 * - @RequirePermission decorator: Specifies required permission
 * 
 * Guard Chain Order:
 * 1. JwtAuthGuard (authentication)
 * 2. RolesGuard (role check)
 * 3. PermissionsGuard (permission check) ← This guard
 * 
 * Usage:
 * // Apply globally or at controller/method level
 * @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
 * @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
 * @RequirePermission(StaffPermissionType.MARK_ATTENDANCE)
 * @Post('/attendance/mark')
 * async markAttendance() { ... }
 * 
 * Permission Types:
 * - MARK_ATTENDANCE: Can mark student/staff attendance
 * - VIEW_REPORTS: Can view attendance and progress reports
 * - MANAGE_COURSES: Can create/edit/delete courses
 * - MANAGE_STUDENTS: Can create/edit student accounts
 * - MANAGE_STAFF: Can create/edit staff accounts
 * - MANAGE_CLASSES: Can manage classes and class enrolments
 * - MANAGE_LABS: Can manage lab exercises
 * 
 * @see @RequirePermission() decorator
 * @see StaffPermission model in Prisma schema
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permission from @RequirePermission() decorator
    const requiredPermission = this.reflector.getAllAndOverride<StaffPermissionType>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permission specified = allow access
    if (!requiredPermission) {
      return true;
    }

    // Expose the requirement so HttpExceptionFilter can log denials (R39.3)
    context.switchToHttp().getRequest().requiredPermissions = [requiredPermission];

    // Extract user from request (populated by JwtAuthGuard)
    const request = context.switchToHttp().getRequest();
    const user = request.user as CurrentUserPayload;

    // User should be populated by JWT guard, but defensive check
    if (!user || !user.role) {
      throw new ForbiddenException('User information is missing');
    }

    // ADMINISTRATOR bypass: Allow all operations automatically
    if (user.role === UserRole.ADMINISTRATOR || user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // STUDENT denial: Students don't have permissions
    if (user.role === UserRole.STUDENT) {
      throw new ForbiddenException(
        'Students do not have permission to access this resource',
      );
    }

    // STAFF permission check: Query StaffPermission table
    if (user.role === UserRole.STAFF) {
      // Ensure staffId is present in user payload
      if (!user.staffId) {
        throw new ForbiddenException('Staff profile information is missing');
      }

      // Query StaffPermission table for required permission
      const hasPermission = await this.checkStaffPermission(
        user.staffId,
        requiredPermission,
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          `Access denied. Required permission: ${requiredPermission}`,
        );
      }

      return true;
    }

    // Unknown role - deny by default
    throw new ForbiddenException('Invalid user role');
  }

  /**
   * Checks if a staff member has a specific permission
   * 
   * @param staffId Staff member's ID
   * @param permission Required permission type
   * @returns true if permission exists, false otherwise
   */
  private async checkStaffPermission(
    staffId: string,
    permission: StaffPermissionType,
  ): Promise<boolean> {
    const staffPermission = await this.prisma.staffPermission.findUnique({
      where: {
        staffId_permission: {
          staffId,
          permission,
        },
      },
    });

    return staffPermission !== null;
  }
}
