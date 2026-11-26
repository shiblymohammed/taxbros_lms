import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** One row of the per-request user lookup (user joined with its student and staff profile). */
interface SessionRow {
  id: string;
  email: string;
  role: string;
  status: string;
  mustChangePassword: boolean;
  studentId: string | null;
  studentFirstName: string | null;
  studentLastName: string | null;
  staffId: string | null;
  staffFirstName: string | null;
  staffLastName: string | null;
}

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

    // Load the user and both profiles in ONE query. This runs on every authenticated request;
    // `findUnique` with `include` sends one query per relation (three round trips to the database).
    const rows = await this.prisma.$queryRaw<SessionRow[]>`
      SELECT u."id", u."email", u."role"::text AS "role", u."status"::text AS "status", u."mustChangePassword",
             s."id" AS "studentId", s."firstName" AS "studentFirstName", s."lastName" AS "studentLastName",
             st."id" AS "staffId", st."firstName" AS "staffFirstName", st."lastName" AS "staffLastName"
      FROM "users" u
      LEFT JOIN "students" s ON s."userId" = u."id"
      LEFT JOIN "staff" st ON st."userId" = u."id"
      WHERE u."id" = ${userId}
      LIMIT 1`;
    const row = rows[0];
    const user = row && {
      id: row.id,
      email: row.email,
      role: row.role as UserRole,
      status: row.status as UserStatus,
      mustChangePassword: row.mustChangePassword,
      // Only the fields callers read (auth/me shows the name)
      studentProfile: row.studentId
        ? { id: row.studentId, firstName: row.studentFirstName, lastName: row.studentLastName }
        : null,
      staffProfile: row.staffId
        ? { id: row.staffId, firstName: row.staffFirstName, lastName: row.staffLastName }
        : null,
    };

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
