import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtTokenService, JwtPayload } from './jwt.service';

describe('JwtTokenService', () => {
  let service: JwtTokenService;

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        JWT_SECRET: 'test-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_EXPIRY: '15m',
        REFRESH_TOKEN_EXPIRY: '7d',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtTokenService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<JwtTokenService>(JwtTokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateAccessToken', () => {
    it('should generate access token with correct payload and expiry', () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'STUDENT',
      };

      mockJwtService.sign.mockReturnValue('mock-access-token');

      const token = service.generateAccessToken(payload);

      expect(token).toBe('mock-access-token');
      expect(mockJwtService.sign).toHaveBeenCalledWith(payload, {
        secret: 'test-secret',
        expiresIn: '15m',
      });
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token with correct payload and expiry', () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'STUDENT',
      };

      mockJwtService.sign.mockReturnValue('mock-refresh-token');

      const token = service.generateRefreshToken(payload);

      expect(token).toBe('mock-refresh-token');
      expect(mockJwtService.sign).toHaveBeenCalledWith(payload, {
        secret: 'test-refresh-secret',
        expiresIn: '7d',
      });
    });
  });

  describe('validateAccessToken', () => {
    it('should validate and decode access token', () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'STUDENT',
      };

      mockJwtService.verify.mockReturnValue(payload);

      const result = service.validateAccessToken('valid-token');

      expect(result).toEqual(payload);
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token', {
        secret: 'test-secret',
      });
    });

    it('should throw error for invalid access token', () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => service.validateAccessToken('invalid-token')).toThrow(
        'Invalid or expired access token',
      );
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate and decode refresh token', () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'STUDENT',
      };

      mockJwtService.verify.mockReturnValue(payload);

      const result = service.validateRefreshToken('valid-token');

      expect(result).toEqual(payload);
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token', {
        secret: 'test-refresh-secret',
      });
    });

    it('should throw error for invalid refresh token', () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => service.validateRefreshToken('invalid-token')).toThrow(
        'Invalid or expired refresh token',
      );
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'STUDENT',
      };

      mockJwtService.sign
        .mockReturnValueOnce('mock-access-token')
        .mockReturnValueOnce('mock-refresh-token');

      const result = service.generateTokenPair(payload);

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
    });
  });
});
