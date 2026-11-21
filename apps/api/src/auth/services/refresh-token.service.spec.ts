import { Test, TestingModule } from '@nestjs/testing';
import { RefreshTokenService } from './refresh-token.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;

  const mockPrismaService = {
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSecureToken', () => {
    it('should generate a 64-character hexadecimal token', () => {
      const token = service.generateSecureToken();
      
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });

    it('should generate unique tokens', () => {
      const token1 = service.generateSecureToken();
      const token2 = service.generateSecureToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('createRefreshToken', () => {
    it('should create and store refresh token', async () => {
      const userId = 'user-123';
      const mockToken = 'a'.repeat(64);
      const mockExpiresAt = new Date();

      jest.spyOn(service, 'generateSecureToken').mockReturnValue(mockToken);
      mockPrismaService.refreshToken.create.mockResolvedValue({
        id: 'token-id',
        token: mockToken,
        userId,
        expiresAt: mockExpiresAt,
        createdAt: new Date(),
      });

      const result = await service.createRefreshToken(userId);

      expect(result.token).toBe(mockToken);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockPrismaService.refreshToken.create).toHaveBeenCalledWith({
        data: {
          token: mockToken,
          userId,
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should set expiry date 7 days in the future', async () => {
      const userId = 'user-123';
      const beforeCreate = new Date();
      
      mockPrismaService.refreshToken.create.mockResolvedValue({
        id: 'token-id',
        token: 'mock-token',
        userId,
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      const result = await service.createRefreshToken(userId);
      const afterCreate = new Date();

      const expectedMinExpiry = new Date(beforeCreate);
      expectedMinExpiry.setDate(expectedMinExpiry.getDate() + 7);
      
      const expectedMaxExpiry = new Date(afterCreate);
      expectedMaxExpiry.setDate(expectedMaxExpiry.getDate() + 7);

      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExpiry.getTime() - 1000);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiry.getTime() + 1000);
    });
  });

  describe('validateRefreshToken', () => {
    it('should return userId for valid non-expired token', async () => {
      const userId = 'user-123';
      const token = 'valid-token';
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'token-id',
        token,
        userId,
        expiresAt: futureDate,
        createdAt: new Date(),
      });

      const result = await service.validateRefreshToken(token);

      expect(result).toBe(userId);
      expect(mockPrismaService.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { token },
      });
    });

    it('should return null for non-existent token', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(null);

      const result = await service.validateRefreshToken('non-existent-token');

      expect(result).toBeNull();
    });

    it('should delete and return null for expired token', async () => {
      const token = 'expired-token';
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'token-id',
        token,
        userId: 'user-123',
        expiresAt: pastDate,
        createdAt: new Date(),
      });

      const result = await service.validateRefreshToken(token);

      expect(result).toBeNull();
      expect(mockPrismaService.refreshToken.delete).toHaveBeenCalledWith({
        where: { token },
      });
    });
  });

  describe('invalidateRefreshToken', () => {
    it('should delete token and return true', async () => {
      const token = 'token-to-invalidate';
      mockPrismaService.refreshToken.delete.mockResolvedValue({
        id: 'token-id',
        token,
        userId: 'user-123',
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      const result = await service.invalidateRefreshToken(token);

      expect(result).toBe(true);
      expect(mockPrismaService.refreshToken.delete).toHaveBeenCalledWith({
        where: { token },
      });
    });

    it('should return false if token not found', async () => {
      mockPrismaService.refreshToken.delete.mockRejectedValue(
        new Error('Record not found'),
      );

      const result = await service.invalidateRefreshToken('non-existent-token');

      expect(result).toBe(false);
    });
  });

  describe('invalidateAllUserTokens', () => {
    it('should delete all tokens for a user', async () => {
      const userId = 'user-123';
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.invalidateAllUserTokens(userId);

      expect(result).toBe(3);
      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });
  });

  describe('rotateRefreshToken', () => {
    it('should invalidate old token and create new one', async () => {
      const oldToken = 'old-token';
      const userId = 'user-123';
      const newToken = 'new-token';

      mockPrismaService.refreshToken.delete.mockResolvedValue({
        id: 'old-token-id',
        token: oldToken,
        userId,
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      jest.spyOn(service, 'generateSecureToken').mockReturnValue(newToken);
      mockPrismaService.refreshToken.create.mockResolvedValue({
        id: 'new-token-id',
        token: newToken,
        userId,
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      const result = await service.rotateRefreshToken(oldToken, userId);

      expect(result.token).toBe(newToken);
      expect(mockPrismaService.refreshToken.delete).toHaveBeenCalledWith({
        where: { token: oldToken },
      });
      expect(mockPrismaService.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete all expired tokens', async () => {
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(5);
      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });
});
