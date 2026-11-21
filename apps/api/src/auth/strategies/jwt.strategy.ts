import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT Strategy for Passport
 * 
 * Validates JWT access tokens and attaches user to request object.
 * Automatically used by JwtAuthGuard via Passport.
 * 
 * Token Validation:
 * - Extracts token from Authorization: Bearer header
 * - Verifies signature using JWT_SECRET
 * - Checks expiration (15 minutes)
 * - Loads user from database
 * - Validates user status (ACTIVE required)
 * 
 * @see JwtAuthGuard
 * @see @CurrentUser() decorator
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'development-secret-key',
    });
  }

  /**
   * Validate JWT payload and return user object
   * Called automatically by Passport after JWT signature verification
   * 
   * @param payload Decoded JWT payload
   * @returns User object attached to request.user
   * @throws UnauthorizedException if user not found or inactive
   */
  async validate(payload: JwtPayload) {
    const { sub: userId } = payload;

    // Load user from database
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: true,
        staffProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if account is still active
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    // Return user object (attached to request.user by Passport).
    // Must satisfy CurrentUserPayload: controllers read `userId`, and
    // PermissionsGuard reads `staffId`. `id` is kept for backward compatibility.
    return {
      id: user.id,
      userId: user.id,
      studentId: user.studentProfile?.id,
      staffId: user.staffProfile?.id,
      email: user.email,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      studentProfile: user.studentProfile,
      staffProfile: user.staffProfile,
    };
  }
}
