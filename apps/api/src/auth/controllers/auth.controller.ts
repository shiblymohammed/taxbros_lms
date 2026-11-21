import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Response, Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { StaffAccessService } from '../staff-access.service';

/**
 * Authentication Controller
 * 
 * Handles user authentication operations including login, token refresh, and logout.
 * 
 * Endpoints:
 * - POST /auth/login - User login with email/password
 * - POST /auth/refresh - Token refresh using httpOnly cookie
 * - POST /auth/logout - User logout and token invalidation
 * 
 * **Validates Requirements:** R2 (RBAC), R36 (Authentication), R37 (Session Management)
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly staffAccess: StaffAccessService,
  ) {}

  /**
   * Login endpoint
   * 
   * Authenticates user with email and password, returns access token and user info.
   * Sets refresh token as httpOnly cookie (7-day expiry).
   * 
   * @param loginDto - Email and password credentials
   * @param res - Express response object for setting cookies
   * @returns Access token and user information
   * 
   * **Validates Requirements:** R2, R36
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description:
      'Authenticate user with email and password. Returns access token (15-minute expiry) and sets refresh token in httpOnly cookie (7-day expiry).',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
            email: { type: 'string', example: 'admin@taxbros.edu' },
            role: { type: 'string', example: 'ADMINISTRATOR' },
            mustChangePassword: { type: 'boolean', example: false },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or inactive account',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Invalid email or password' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: ['Email must be a valid email address'],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.authService.login(
      loginDto.email,
      loginDto.password,
    );

    // Set refresh token in httpOnly cookie
    // Cookie settings:
    // - httpOnly: true (prevents JavaScript access, XSS protection)
    // - secure: true in production (HTTPS only)
    // - sameSite: 'strict' (CSRF protection)
    // - maxAge: 7 days (matches token expiry)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      path: '/',
    });

    // Return access token and user info (refresh token not included in response body)
    return {
      accessToken,
      user,
    };
  }

  /**
   * Refresh token endpoint
   * 
   * Validates refresh token from httpOnly cookie and returns new access token.
   * Implements token rotation: invalidates old refresh token and issues new one.
   * 
   * @param req - Express request object for reading cookies
   * @param res - Express response object for setting new cookie
   * @returns New access token
   * 
   * **Validates Requirements:** R2, R36
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Validates refresh token from httpOnly cookie and returns a new access token. Implements token rotation for security.',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refresh successful',
    schema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Invalid or expired refresh token' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Extract refresh token from httpOnly cookie
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // Validate and rotate refresh token
    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refresh(refreshToken);

    // Set new refresh token in httpOnly cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    return {
      accessToken,
    };
  }

  /**
   * Logout endpoint
   * 
   * Invalidates refresh token and clears httpOnly cookie.
   * Requires authentication (valid access token).
   * 
   * @param req - Express request object for reading cookies
   * @param res - Express response object for clearing cookies
   * @returns Success message
   * 
   * **Validates Requirements:** R2, R36
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'User logout',
    description:
      'Invalidates refresh token and clears httpOnly cookie. Requires valid access token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Logged out successfully' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing access token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Extract refresh token from cookie
    const refreshToken = req.cookies?.refreshToken;

    // Invalidate refresh token in database
    const result = await this.authService.logout(refreshToken);

    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return result;
  }

  /**
   * Current user endpoint
   *
   * Returns the signed-in user's identity and profile IDs, so clients don't need
   * admin-only lookups to find their own Student/Staff record.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user', description: 'Identity, role and profile IDs of the signed-in user.' })
  @ApiResponse({ status: 200, description: 'Current user' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async me(@Req() req: Request & { user?: any }) {
    const user = req.user;
    // Staff permissions, read fresh so a revoked permission disappears from the app at once (R3.5)
    const permissions = await this.staffAccess.permissionsOf(user);
    const profile = user.studentProfile ?? user.staffProfile;
    return {
      id: user.userId,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      studentId: user.studentId ?? null,
      staffId: user.staffId ?? null,
      firstName: profile?.firstName ?? null,
      lastName: profile?.lastName ?? null,
      permissions,
    };
  }

  /**
   * Change password (R36)
   *
   * Requires the current password; the new one must meet the policy. Every other session is
   * signed out, and this device gets a fresh access token and refresh cookie.
   */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change password',
    description: 'Verifies the current password, applies the password policy, revokes all refresh tokens and returns a new access token.',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password changed; new access token returned and refresh cookie set' })
  @ApiResponse({ status: 400, description: 'Current password wrong, policy not met, or same as the old password' })
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    return { accessToken };
  }
}
