import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { generateTemporaryPassword, meetsPasswordPolicy } from './password-policy';
import { AuthService } from './services/auth.service';
import { UsersService } from '../users/users.service';

describe('Password policy (R36.2)', () => {
  it.each(['Abcdef1!', 'N3w#Password', 'Tax$2026bros'])('accepts %s', (p) => expect(meetsPasswordPolicy(p)).toBe(true));
  it.each([
    ['too short', 'Ab1!'],
    ['no uppercase', 'abcdef1!'],
    ['no number', 'Abcdefg!'],
    ['no special character', 'Abcdefg1'],
  ])('rejects %s', (_label, p) => expect(meetsPasswordPolicy(p)).toBe(false));

  it('generates temporary passwords that always meet the policy and differ each time', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = generateTemporaryPassword();
      expect(p).toHaveLength(12);
      expect(meetsPasswordPolicy(p)).toBe(true);
      expect(p).not.toMatch(/[0O1lI]/);
      seen.add(p);
    }
    expect(seen.size).toBe(200);
  });
});

describe('JwtAuthGuard forced password change (R36.3)', () => {
  const guard = new JwtAuthGuard(new Reflector());
  const ctx = (url: string) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ originalUrl: url }) }) }) as unknown as ExecutionContext;

  it('blocks other routes while a password change is required', () => {
    expect(() => guard.handleRequest(null, { userId: 'u', mustChangePassword: true }, null, ctx('/api/labs'))).toThrow(
      ForbiddenException,
    );
  });

  it('still allows /auth/me, change-password and logout', () => {
    for (const url of ['/api/auth/me', '/api/auth/change-password', '/api/auth/logout']) {
      expect(guard.handleRequest(null, { userId: 'u', mustChangePassword: true }, null, ctx(url))).toMatchObject({
        userId: 'u',
      });
    }
  });

  it('does not affect users who have changed their password', () => {
    expect(guard.handleRequest(null, { userId: 'u', mustChangePassword: false }, null, ctx('/api/labs'))).toMatchObject({
      userId: 'u',
    });
  });
});

describe('AuthService.changePassword (R36.1, R36.5, R36.6)', () => {
  let prisma: any;
  let refreshTokens: any;
  let service: AuthService;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          email: 'a@taxbros.test',
          role: 'STUDENT',
          passwordHash: await bcrypt.hash('Old#Pass1', 4),
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    refreshTokens = {
      invalidateAllUserTokens: jest.fn().mockResolvedValue(2),
      createRefreshToken: jest.fn().mockResolvedValue({ token: 'new-refresh', expiresAt: new Date() }),
    };
    const jwt = { generateAccessToken: jest.fn().mockReturnValue('new-access') };
    service = new AuthService(prisma, jwt as any, refreshTokens, {} as any);
  });

  it('rejects a wrong current password', async () => {
    await expect(service.changePassword('u1', 'Wrong#1x', 'New#Pass2')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password', async () => {
    await expect(service.changePassword('u1', 'Old#Pass1', 'Old#Pass1')).rejects.toThrow(/different/);
  });

  it('stores a 12-round bcrypt hash, clears the flag, revokes sessions and issues new tokens', async () => {
    const result = await service.changePassword('u1', 'Old#Pass1', 'New#Pass2');

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.mustChangePassword).toBe(false);
    expect(bcrypt.getRounds(data.passwordHash)).toBe(12);
    expect(await bcrypt.compare('New#Pass2', data.passwordHash)).toBe(true);
    expect(refreshTokens.invalidateAllUserTokens).toHaveBeenCalledWith('u1');
    expect(result).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  });
});

describe('UsersService password reset and deactivation (R36.4, R2.10)', () => {
  let prisma: any;
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u2', email: 's@taxbros.test', role: 'STUDENT' }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'u2', passwordHash: 'x', ...data })),
      },
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    service = new UsersService(prisma);
  });

  it('returns a policy-compliant temporary password once and forces a change', async () => {
    const result = await service.resetPassword('u2', 'admin-1');

    expect(meetsPasswordPolicy(result.temporaryPassword)).toBe(true);
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.mustChangePassword).toBe(true);
    expect(await bcrypt.compare(result.temporaryPassword, data.passwordHash)).toBe(true);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u2' } });
  });

  it('refuses to reset your own or a super admin password', async () => {
    await expect(service.resetPassword('u2', 'u2')).rejects.toBeInstanceOf(BadRequestException);
    prisma.user.findUnique.mockResolvedValue({ id: 'sa', role: 'SUPER_ADMIN' });
    await expect(service.resetPassword('sa', 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('revokes refresh tokens when deactivating', async () => {
    await service.deactivate('u2');
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u2' } });
    expect(prisma.user.update.mock.calls[0][0].data.status).toBe('INACTIVE');
  });
});
