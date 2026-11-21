import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a secure random refresh token
   * @returns 64-character hexadecimal token
   */
  generateSecureToken(): string {
    // Generate 32 random bytes and convert to hex (64 characters)
    return randomBytes(32).toString('hex');
  }

  /**
   * Calculate expiry date for refresh token (7 days from now)
   * @returns Date object representing expiry time
   */
  private calculateExpiryDate(): Date {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);
    return expiryDate;
  }

  /**
   * Create and store a new refresh token in the database
   * @param userId User ID to associate with the token
   * @returns Created refresh token object with token string and expiry date
   */
  async createRefreshToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = this.generateSecureToken();
    const expiresAt = this.calculateExpiryDate();

    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  /**
   * Validate a refresh token
   * @param token Token string to validate
   * @returns User ID if token is valid, null if invalid or expired
   */
  async validateRefreshToken(token: string): Promise<string | null> {
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token },
    });

    if (!refreshToken) {
      return null;
    }

    // Check if token has expired
    if (refreshToken.expiresAt < new Date()) {
      // Delete expired token
      await this.prisma.refreshToken.delete({
        where: { token },
      });
      return null;
    }

    return refreshToken.userId;
  }

  /**
   * Invalidate a refresh token (used for logout)
   * @param token Token string to invalidate
   * @returns True if token was deleted, false if not found
   */
  async invalidateRefreshToken(token: string): Promise<boolean> {
    try {
      await this.prisma.refreshToken.delete({
        where: { token },
      });
      return true;
    } catch (error) {
      // Token not found
      return false;
    }
  }

  /**
   * Invalidate all refresh tokens for a user (used for security actions)
   * @param userId User ID whose tokens should be invalidated
   * @returns Number of tokens deleted
   */
  async invalidateAllUserTokens(userId: string): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
    return result.count;
  }

  /**
   * Rotate refresh token - invalidate old token and create new one
   * @param oldToken Token to invalidate
   * @param userId User ID for the new token
   * @returns New refresh token object
   */
  async rotateRefreshToken(oldToken: string, userId: string): Promise<{ token: string; expiresAt: Date }> {
    // Delete old token
    await this.invalidateRefreshToken(oldToken);
    
    // Create new token
    return this.createRefreshToken(userId);
  }

  /**
   * Clean up expired tokens (should be run periodically)
   * @returns Number of tokens deleted
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }
}
