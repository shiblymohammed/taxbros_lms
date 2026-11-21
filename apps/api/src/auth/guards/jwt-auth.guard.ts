import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PASSWORD_CHANGE_ALLOWED_PATHS, PASSWORD_CHANGE_REQUIRED_CODE } from '../password-policy';

/**
 * JWT Authentication Guard
 * 
 * Extends Passport's AuthGuard to validate JWT tokens from Authorization header.
 * Automatically bypasses authentication for routes decorated with @Public().
 * 
 * Usage:
 * - Applied globally in main.ts or app.module.ts
 * - Validates JWT tokens via JwtStrategy
 * - Returns 401 Unauthorized if token is missing/invalid/expired
 * 
 * @see JwtStrategy for token validation logic
 * @see @Public() decorator to bypass authentication
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Determines if authentication should be performed
   * Checks for @Public() decorator on handler or class level
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Skip authentication for public routes
    if (isPublic) {
      return true;
    }

    // Proceed with JWT validation via passport strategy
    return super.canActivate(context);
  }

  /**
   * R36.3: a user whose account requires a password change (new account or admin reset)
   * may only read their identity, change the password, or sign out.
   */
  handleRequest<TUser = any>(err: any, user: any, info: any, context: ExecutionContext, status?: any): TUser {
    const result = super.handleRequest(err, user, info, context, status);
    if (user?.mustChangePassword) {
      const req = context.switchToHttp().getRequest();
      const path: string = req.originalUrl ?? req.url ?? '';
      if (!PASSWORD_CHANGE_ALLOWED_PATHS.test(path)) {
        throw new ForbiddenException({
          message: 'You must change your password before continuing',
          code: PASSWORD_CHANGE_REQUIRED_CODE,
        });
      }
    }
    return result as TUser;
  }
}
