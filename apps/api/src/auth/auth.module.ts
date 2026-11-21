import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { AuthService } from './services/auth.service';
import { JwtTokenService } from './services/jwt.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { FailedLoginTrackerService } from './services/failed-login-tracker.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './controllers/auth.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Authentication Module
 * 
 * Provides JWT-based authentication and role-based authorization.
 * 
 * Features:
 * - JWT token generation and validation (15-minute access tokens)
 * - Refresh token management (7-day expiry, httpOnly cookies)
 * - Role-based access control with hierarchy (SUPER_ADMIN > ADMINISTRATOR > STAFF > STUDENT)
 * - Public route support via @Public() decorator
 * - Current user extraction via @CurrentUser() decorator
 * 
 * Endpoints:
 * - POST /auth/login - User authentication
 * - POST /auth/refresh - Token refresh
 * - POST /auth/logout - User logout
 * 
 * Exports:
 * - Guards: JwtAuthGuard, RolesGuard, PermissionsGuard
 * - Services: AuthService, JwtTokenService, RefreshTokenService
 * - Strategies: JwtStrategy
 * - JwtModule for token operations
 * - PassportModule for strategy support
 * 
 * Usage:
 * Import this module in AppModule and any feature modules that need authentication.
 */
@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'development-secret-key',
        signOptions: {
          expiresIn: '15m', // 15-minute access token expiry
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtTokenService,
    RefreshTokenService,
    FailedLoginTrackerService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
  ],
  exports: [
    AuthService,
    JwtTokenService,
    RefreshTokenService,
    FailedLoginTrackerService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}
