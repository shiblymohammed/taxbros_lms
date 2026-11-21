import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Metadata key for role requirements
 */
export const ROLES_KEY = 'roles';

/**
 * Roles Decorator
 * 
 * Specifies which user roles are allowed to access a route or controller.
 * Works in conjunction with RolesGuard to enforce role-based access control.
 * 
 * Role hierarchy is automatically enforced:
 * SUPER_ADMIN > ADMINISTRATOR > STAFF > STUDENT
 * 
 * If you specify @Roles(UserRole.STAFF), then ADMINISTRATOR and SUPER_ADMIN
 * will also be granted access automatically.
 * 
 * Usage:
 * // Single role requirement
 * @Roles(UserRole.ADMINISTRATOR)
 * @Get('/admin/users')
 * async getAllUsers() { ... }
 * 
 * // Multiple acceptable roles
 * @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
 * @Post('/attendance/mark')
 * async markAttendance() { ... }
 * 
 * // Can be applied at class level
 * @Roles(UserRole.ADMINISTRATOR)
 * @Controller('admin')
 * export class AdminController { ... }
 * 
 * @param roles One or more UserRole values
 * @see RolesGuard which enforces these role requirements
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
