import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for public route marking
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Public Route Decorator
 * 
 * Marks a route or controller as publicly accessible, bypassing JWT authentication.
 * Used for endpoints that should not require authentication (e.g., login, health checks).
 * 
 * Usage:
 * @Public()
 * @Post('login')
 * async login(@Body() loginDto: LoginDto) {
 *   return this.authService.login(loginDto);
 * }
 * 
 * Can be applied at class level to make all routes public:
 * @Public()
 * @Controller('public')
 * export class PublicController { ... }
 * 
 * @see JwtAuthGuard which checks this metadata
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
