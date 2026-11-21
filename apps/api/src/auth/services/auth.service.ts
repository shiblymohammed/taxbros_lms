import { BadRequestException, Injectable, UnauthorizedException, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtTokenService, JwtPayload } from './jwt.service';
import { RefreshTokenService } from './refresh-token.service';
import { FailedLoginTrackerService } from './failed-login-tracker.service';
import * as bcrypt from 'bcrypt';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    mustChangePassword: boolean;
  };
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly failedLoginTracker: FailedLoginTrackerService,
  ) {}

  /**
   * Login method: validate credentials and generate tokens
   * Uses in-memory FailedLoginTracker for rate limiting and account lockout
   * @param email User email
   * @param password User password (plain text)
   * @returns Login response with access token, refresh token, and user info
   * @throws UnauthorizedException if credentials are invalid
   * @throws HttpException (429) if account is locked
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    // Check if account is locked (in-memory tracker)
    if (this.failedLoginTracker.isLocked(email)) {
      const remainingSeconds = this.failedLoginTracker.getLockoutTimeRemaining(email);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      
      throw new HttpException(
        `Account is temporarily locked due to too many failed login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        studentProfile: true,
        staffProfile: true,
      },
    });

    if (!user) {
      // Record failed attempt even for non-existent users to prevent enumeration
      this.failedLoginTracker.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if account is active
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    // Verify password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // Record failed attempt in in-memory tracker
      this.failedLoginTracker.recordFailedAttempt(email);
      const remainingAttempts = this.failedLoginTracker.getRemainingAttempts(email);

      // Check if account is now locked after this attempt
      if (this.failedLoginTracker.isLocked(email)) {
        const remainingSeconds = this.failedLoginTracker.getLockoutTimeRemaining(email);
        const remainingMinutes = Math.ceil(remainingSeconds / 60);
        
        throw new HttpException(
          `Account is temporarily locked due to too many failed login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new UnauthorizedException(
        `Invalid credentials. ${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining before lockout.`,
      );
    }

    // Reset failed login attempts on successful login (in-memory tracker)
    this.failedLoginTracker.resetAttempts(email);

    // Update last login time in database
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    // Create JWT payload
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Generate access token (15 minutes)
    const accessToken = this.jwtTokenService.generateAccessToken(payload);

    // Generate and store refresh token (7 days)
    const { token: refreshToken } = await this.refreshTokenService.createRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /**
   * Refresh method: validate refresh token and rotate tokens
   * @param refreshToken Current refresh token
   * @returns New access token and refresh token
   * @throws UnauthorizedException if refresh token is invalid or expired
   */
  async refresh(refreshToken: string): Promise<RefreshResponse> {
    // Validate refresh token and get user ID
    const userId = await this.refreshTokenService.validateRefreshToken(refreshToken);

    if (!userId) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Get user from database
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if account is still active
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    // Create JWT payload
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Generate new access token
    const accessToken = this.jwtTokenService.generateAccessToken(payload);

    // Rotate refresh token (invalidate old, create new)
    const { token: newRefreshToken } = await this.refreshTokenService.rotateRefreshToken(
      refreshToken,
      user.id,
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Logout method: invalidate refresh token
   * @param refreshToken Refresh token to invalidate
   * @returns Success boolean
   */
  async logout(refreshToken: string): Promise<{ success: boolean; message: string }> {
    if (!refreshToken) {
      return { success: false, message: 'No refresh token provided' };
    }

    const invalidated = await this.refreshTokenService.invalidateRefreshToken(refreshToken);

    if (invalidated) {
      return { success: true, message: 'Logged out successfully' };
    } else {
      return { success: false, message: 'Token not found or already invalidated' };
    }
  }

  /**
   * Validate user credentials (used by Passport local strategy)
   * @param email User email
   * @param password User password
   * @returns User object if credentials are valid, null otherwise
   */
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return null;
    }

    if (user.status !== 'ACTIVE') {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = user;
    return result;
  }

  /**
   * Change user password
   * @param userId User ID
   * @param currentPassword Current password for verification
   * @param newPassword New password
   * @throws UnauthorizedException if current password is invalid
   * @throws NotFoundException if user not found
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // R36.1: verify the current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestException('The new password must be different from the current one');
    }

    // R36.6: bcrypt with 12 salt rounds
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
      },
    });

    // R36.5: sign out every other session, then start a fresh one for this device
    await this.refreshTokenService.invalidateAllUserTokens(userId);
    const accessToken = this.jwtTokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const { token: refreshToken } = await this.refreshTokenService.createRefreshToken(user.id);

    return { accessToken, refreshToken };
  }
}
