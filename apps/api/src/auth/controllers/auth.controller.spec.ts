import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { Response, Request } from 'express';
import { StaffAccessService } from '../staff-access.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };

  const mockResponse = () => {
    const res: Partial<Response> = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    return res as Response;
  };

  const mockRequest = (cookies: any = {}) => {
    const req: Partial<Request> = {
      cookies,
    };
    return req as Request;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: StaffAccessService, useValue: { permissionsOf: jest.fn().mockResolvedValue([]) } },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const validLoginDto = {
      email: 'admin@taxbros.edu',
      password: 'SecurePassword123!',
    };

    const mockLoginResponse = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'admin@taxbros.edu',
        role: 'ADMINISTRATOR',
        mustChangePassword: false,
      },
    };

    it('should login successfully and set httpOnly cookie', async () => {
      mockAuthService.login.mockResolvedValue(mockLoginResponse);
      const res = mockResponse();

      const result = await controller.login(validLoginDto, res);

      expect(authService.login).toHaveBeenCalledWith(
        validLoginDto.email,
        validLoginDto.password,
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        mockLoginResponse.refreshToken,
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
        }),
      );
      expect(result).toEqual({
        accessToken: mockLoginResponse.accessToken,
        user: mockLoginResponse.user,
      });
    });

    it('should set secure flag in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockAuthService.login.mockResolvedValue(mockLoginResponse);
      const res = mockResponse();

      await controller.login(validLoginDto, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.any(String),
        expect.objectContaining({
          secure: true,
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should not set secure flag in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockAuthService.login.mockResolvedValue(mockLoginResponse);
      const res = mockResponse();

      await controller.login(validLoginDto, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.any(String),
        expect.objectContaining({
          secure: false,
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Invalid email or password'),
      );
      const res = mockResponse();

      await expect(controller.login(validLoginDto, res)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for inactive account', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Account is not active'),
      );
      const res = mockResponse();

      await expect(controller.login(validLoginDto, res)).rejects.toThrow(
        'Account is not active',
      );
    });

    it('should not return refresh token in response body', async () => {
      mockAuthService.login.mockResolvedValue(mockLoginResponse);
      const res = mockResponse();

      const result = await controller.login(validLoginDto, res);

      expect(result).not.toHaveProperty('refreshToken');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('user');
    });
  });

  describe('refresh', () => {
    const mockRefreshResponse = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    };

    it('should refresh tokens successfully', async () => {
      const req = mockRequest({ refreshToken: 'old-refresh-token' });
      const res = mockResponse();
      mockAuthService.refresh.mockResolvedValue(mockRefreshResponse);

      const result = await controller.refresh(req, res);

      expect(authService.refresh).toHaveBeenCalledWith('old-refresh-token');
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        mockRefreshResponse.refreshToken,
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
        }),
      );
      expect(result).toEqual({
        accessToken: mockRefreshResponse.accessToken,
      });
    });

    it('should throw UnauthorizedException when refresh token is missing', async () => {
      const req = mockRequest({});
      const res = mockResponse();

      await expect(controller.refresh(req, res)).rejects.toThrow(
        'Refresh token not found',
      );
      expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      const req = mockRequest({ refreshToken: 'invalid-token' });
      const res = mockResponse();
      mockAuthService.refresh.mockRejectedValue(
        new UnauthorizedException('Invalid or expired refresh token'),
      );

      await expect(controller.refresh(req, res)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should rotate refresh token (invalidate old, create new)', async () => {
      const req = mockRequest({ refreshToken: 'old-token' });
      const res = mockResponse();
      mockAuthService.refresh.mockResolvedValue(mockRefreshResponse);

      await controller.refresh(req, res);

      expect(authService.refresh).toHaveBeenCalledWith('old-token');
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'new-refresh-token',
        expect.any(Object),
      );
    });
  });

  describe('logout', () => {
    it('should logout successfully and clear cookie', async () => {
      const req = mockRequest({ refreshToken: 'valid-refresh-token' });
      const res = mockResponse();
      mockAuthService.logout.mockResolvedValue({
        success: true,
        message: 'Logged out successfully',
      });

      const result = await controller.logout(req, res);

      expect(authService.logout).toHaveBeenCalledWith('valid-refresh-token');
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
        }),
      );
      expect(result).toEqual({
        success: true,
        message: 'Logged out successfully',
      });
    });

    it('should handle logout when refresh token is missing', async () => {
      const req = mockRequest({});
      const res = mockResponse();
      mockAuthService.logout.mockResolvedValue({
        success: false,
        message: 'No refresh token provided',
      });

      const result = await controller.logout(req, res);

      expect(authService.logout).toHaveBeenCalledWith(undefined);
      expect(res.clearCookie).toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should clear cookie even if token invalidation fails', async () => {
      const req = mockRequest({ refreshToken: 'non-existent-token' });
      const res = mockResponse();
      mockAuthService.logout.mockResolvedValue({
        success: false,
        message: 'Token not found or already invalidated',
      });

      const result = await controller.logout(req, res);

      expect(res.clearCookie).toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should set correct cookie options when clearing', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const req = mockRequest({ refreshToken: 'token' });
      const res = mockResponse();
      mockAuthService.logout.mockResolvedValue({
        success: true,
        message: 'Logged out successfully',
      });

      await controller.logout(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/',
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('cookie configuration', () => {
    it('should set 7-day expiry for refresh token cookie', async () => {
      const mockLoginResponse = {
        accessToken: 'token',
        refreshToken: 'refresh',
        user: {
          id: '123',
          email: 'test@test.com',
          role: 'STUDENT',
          mustChangePassword: false,
        },
      };

      mockAuthService.login.mockResolvedValue(mockLoginResponse);
      const res = mockResponse();

      await controller.login(
        { email: 'test@test.com', password: 'password' },
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.any(String),
        expect.objectContaining({
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
        }),
      );
    });

    it('should set httpOnly flag to prevent XSS attacks', async () => {
      const mockLoginResponse = {
        accessToken: 'token',
        refreshToken: 'refresh',
        user: {
          id: '123',
          email: 'test@test.com',
          role: 'STUDENT',
          mustChangePassword: false,
        },
      };

      mockAuthService.login.mockResolvedValue(mockLoginResponse);
      const res = mockResponse();

      await controller.login(
        { email: 'test@test.com', password: 'password' },
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
        }),
      );
    });

    it('should set sameSite strict for CSRF protection', async () => {
      const mockLoginResponse = {
        accessToken: 'token',
        refreshToken: 'refresh',
        user: {
          id: '123',
          email: 'test@test.com',
          role: 'STUDENT',
          mustChangePassword: false,
        },
      };

      mockAuthService.login.mockResolvedValue(mockLoginResponse);
      const res = mockResponse();

      await controller.login(
        { email: 'test@test.com', password: 'password' },
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.any(String),
        expect.objectContaining({
          sameSite: 'strict',
        }),
      );
    });
  });
});
