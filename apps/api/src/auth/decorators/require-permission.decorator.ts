import { SetMetadata } from '@nestjs/common';
import { StaffPermissionType } from '@prisma/client';

/**
 * Metadata key for permission requirements
 */
export const PERMISSION_KEY = 'permission';

/**
 * RequirePermission Decorator
 * 
 * Specifies the permission required to access a route or controller.
 * Works in conjunction with PermissionsGuard to enforce fine-grained access control.
 * 
 * Permission Enforcement Logic:
 * - ADMINISTRATOR role: Automatically granted access (bypass permission check)
 * - STAFF role: Must have the specified permission in StaffPermission table
 * - STUDENT role: Denied access (students don't have permissions)
 * 
 * This decorator should be used together with @Roles() decorator:
 * - @Roles() ensures user has appropriate role
 * - @RequirePermission() ensures staff has specific permission
 * 
 * Usage:
 * // Mark attendance endpoint - requires MARK_ATTENDANCE permission
 * @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
 * @RequirePermission(StaffPermissionType.MARK_ATTENDANCE)
 * @Post('/attendance/mark')
 * async markAttendance(@Body() dto: MarkAttendanceDto) { ... }
 * 
 * // View reports endpoint - requires VIEW_REPORTS permission
 * @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
 * @RequirePermission(StaffPermissionType.VIEW_REPORTS)
 * @Get('/reports/monthly')
 * async getMonthlyReport() { ... }
 * 
 * // Manage courses - requires MANAGE_COURSES permission
 * @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
 * @RequirePermission(StaffPermissionType.MANAGE_COURSES)
 * @Post('/courses')
 * async createCourse(@Body() dto: CreateCourseDto) { ... }
 * 
 * Note: This decorator requires PermissionsGuard to be applied.
 * The guard should be placed after RolesGuard in the guards chain.
 * 
 * @param permission The StaffPermissionType required for access
 * @see PermissionsGuard which enforces these permission requirements
 */
export const RequirePermission = (permission: StaffPermissionType) =>
  SetMetadata(PERMISSION_KEY, permission);
