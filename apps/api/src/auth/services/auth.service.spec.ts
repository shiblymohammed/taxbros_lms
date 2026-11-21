import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpStatus, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtTokenService } from './jwt.service';
import { RefreshTokenService } from './refresh-token.service';
import { FailedLoginTrackerService } from './failed-login-tracker.service';

/**
 * AuthService unit tests (R2, R36, R37).
 * Lockout is counted in memory per email by FailedLoginTrackerService (5 attempts, 15 minutes);
 * the real tracker is used so the two are tested together.
 */
describe('AuthService', () => {
  let service: AuthService;
  let tracker: FailedLoginTrackerService;

  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    passwordHash: '',
    role: 'STUDENT' as const,
    status: 'ACTIVE' as const,
    mustChangePassword: false,
    studentProfile: null,
    staffProfile: null,
  };

  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
  };
  const jwt = { generateAccessToken: jest.fn().mockReturnValue('mock-access-token') };
  const refreshTokens = {
    createRefreshToken: jest.fn().mockResolvedValue({ token: 'mock-refresh-token' }),
    invalidateAllUserTokens: jest.fn().mockResolvedValue(1),
    validateRefreshToken: jest.fn(),
    rotateRefreshToken: jest.fn(),
    invalidateRefreshToken: jest.fn(),
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('correctPassword', 4);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        FailedLoginTrackerService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtTokenService, useValue: jwt },
        { provide: RefreshTokenService, useValue: refreshTokens },
      ],
    }).compile();

    service = module.get(AuthService);
    tracker = module.get(FailedLoginTrackerService);
    prisma.user.findUnique.mockResolvedValue({ ...mockUser });
    prisma.user.update.mockResolvedValue({});
  });

  async function failLogin(times: number) {
    for (let i = 0; i < times; i++) {
      await service.login(mockUser.email, 'wrong').catch(() => undefined);
    }
  }

  describe('login', () => {
    it('returns tokens and the user, records the login time and resets earlier failures', async () => {
      await failLogin(2);
      const result = await service.login(mockUser.email, 'correctPassword');

      expect(result).toMatchObject({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: { id: mockUser.id, email: mockUser.email, role: 'STUDENT', mustChangePassword: false },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(tracker.getAttemptCount(mockUser.email)).toBe(0);
    });

    it('counts down remaining attempts on wrong passwords', async () => {
      await expect(service.login(mockUser.email, 'wrong')).rejects.toThrow('4 attempts remaining');
      await failLogin(2);
      await expect(service.login(mockUser.email, 'wrong')).rejects.toThrow('1 attempt remaining');
    });

    it('locks the account with 429 on the 5th failure and refuses even the right password', async () => {
      await failLogin(4);
      const fifth = await service.login(mockUser.email, 'wrong').catch((e) => e);
      expect(fifth.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(fifth.message).toMatch(/temporarily locked.*15 minutes/);

      const locked = await service.login(mockUser.email, 'correctPassword').catch((e) => e);
      expect(locked.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(jwt.generateAccessToken).not.toHaveBeenCalled();
    });

    it('allows login again once the lockout has expired', async () => {
      jest.useFakeTimers({ now: new Date('2026-11-21T10:00:00Z') });
      try {
        await failLogin(5);
        expect(tracker.isLocked(mockUser.email)).toBe(true);

        jest.setSystemTime(new Date('2026-11-21T10:16:00Z'));
        await expect(service.login(mockUser.email, 'correctPassword')).resolves.toMatchObject({
          accessToken: 'mock-access-token',
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it('rejects inactive accounts (R1.8)', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, status: 'INACTIVE' });
      await expect(service.login(mockUser.email, 'correctPassword')).rejects.toThrow(UnauthorizedException);
    });

    it('gives the same message for unknown emails and still counts the attempt', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login('nobody@example.com', 'x')).rejects.toThrow('Invalid email or password');
      expect(tracker.getAttemptCount('nobody@example.com')).toBe(1);
    });
  });

  describe('changePassword (R36)', () => {
    it('stores a new 12-round hash, clears the flag, revokes sessions and issues new tokens', async () => {
      const result = await service.changePassword(mockUser.id, 'correctPassword', 'N3w#Password');

      const data = prisma.user.update.mock.calls[0][0].data;
      expect(bcrypt.getRounds(data.passwordHash)).toBe(12);
      expect(data.mustChangePassword).toBe(false);
      expect(refreshTokens.invalidateAllUserTokens).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({ accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token' });
    });

    it('rejects a wrong current password without changing anything', async () => {
      await expect(service.changePassword(mockUser.id, 'wrong', 'N3w#Password')).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(refreshTokens.invalidateAllUserTokens).not.toHaveBeenCalled();
    });

    it('throws NotFound for an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.changePassword('missing', 'a', 'N3w#Password')).rejects.toThrow(NotFoundException);
    });
  });
});
