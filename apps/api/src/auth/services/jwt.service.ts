import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string; // user ID
  email: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: NestJwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate access token with 15-minute expiry
   * @param payload JWT payload containing user information
   * @returns Signed JWT access token
   */
  generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRY', '15m'),
    });
  }

  /**
   * Generate refresh token with 7-day expiry
   * @param payload JWT payload containing user information
   * @returns Signed JWT refresh token
   */
  generateRefreshToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('REFRESH_TOKEN_EXPIRY', '7d'),
    });
  }

  /**
   * Validate and decode access token
   * @param token JWT access token
   * @returns Decoded JWT payload
   * @throws Error if token is invalid or expired
   */
  validateAccessToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Validate and decode refresh token
   * @param token JWT refresh token
   * @returns Decoded JWT payload
   * @throws Error if token is invalid or expired
   */
  validateRefreshToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Generate both access and refresh tokens
   * @param payload JWT payload containing user information
   * @returns Object containing both access and refresh tokens
   */
  generateTokenPair(payload: JwtPayload): TokenPair {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }
}
