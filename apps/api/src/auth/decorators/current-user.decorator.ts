import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';

/**
 * User payload interface extracted from JWT token
 * This matches the payload structure created during authentication
 */
export interface CurrentUserPayload {
  userId: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  studentId?: string;  // Present if user is a student
  staffId?: string;    // Present if user is a staff member
}

/**
 * Current User Decorator
 * 
 * Extracts the authenticated user information from the request object.
 * The user object is populated by JwtAuthGuard after validating the JWT token.
 * 
 * Returns the full user payload by default, or a specific property if requested.
 * 
 * Usage:
 * // Get entire user object
 * @Get('profile')
 * async getProfile(@CurrentUser() user: CurrentUserPayload) {
 *   return user;
 * }
 * 
 * // Get specific property
 * @Get('my-courses')
 * async getMyCourses(@CurrentUser('userId') userId: string) {
 *   return this.coursesService.getByStudent(userId);
 * }
 * 
 * // Check user role
 * @Post('mark-attendance')
 * async markAttendance(
 *   @CurrentUser('role') role: UserRole,
 *   @CurrentUser('userId') userId: string,
 *   @Body() dto: MarkAttendanceDto,
 * ) {
 *   return this.attendanceService.mark(dto, userId, role);
 * }
 * 
 * Note: This decorator should only be used in routes protected by JwtAuthGuard.
 * Using it on public routes will return undefined.
 * 
 * @param property Optional property name to extract from user object
 * @returns Full user object or specific property value
 */
export const CurrentUser = createParamDecorator(
  (property: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserPayload;

    // Return specific property if requested
    if (property) {
      return user?.[property];
    }

    // Return full user object
    return user;
  },
);
