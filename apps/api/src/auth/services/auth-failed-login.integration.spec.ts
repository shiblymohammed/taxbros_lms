import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { FailedLoginTrackerService } from './failed-login-tracker.service';
import { JwtTokenService } from './jwt.service';
import { RefreshTokenService } from './refresh-token.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * In-memory stand-in for the parts of Prisma that AuthService.login touches. The suite used to
 * write test users into the configured (development) database; it now runs entirely in memory
 * while still exercising the real AuthService and FailedLoginTrackerService together.
 */
function createInMemoryPrisma() {
  const users = new Map<string, any>();
  let seq = 0;
  return {
    user: {
      create: jest.fn(async ({ data }: any) => {
        const user = { id: `user-${++seq}`, studentProfile: null, staffProfile: null, ...data };
        users.set(user.email, user);
        return user;
      }),
      findUnique: jest.fn(async ({ where }: any) =>
        where.email ? users.get(where.email) ?? null : [...users.values()].find((u) => u.id === where.id) ?? null,
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const user = [...users.values()].find((u) => u.id === where.id);
        Object.assign(user, data);
        return user;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const emails: string[] = typeof where.email === 'string' ? [where.email] : where.email?.in ?? [];
        return { count: emails.filter((e) => users.delete(e)).length };
      }),
    },
    $disconnect: jest.fn(),
  };
}

describe('AuthService - Failed Login Integration', () => {
  let authService: AuthService;
  let failedLoginTracker: FailedLoginTrackerService;
  let prismaService: any;

  const testEmail = 'test@example.com';
  const testPassword = 'Test123!@#';
  const wrongPassword = 'WrongPassword123';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        FailedLoginTrackerService,
        { provide: JwtTokenService, useValue: { generateAccessToken: () => 'access-token' } },
        {
          provide: RefreshTokenService,
          useValue: { createRefreshToken: async () => ({ token: 'refresh-token', expiresAt: new Date() }) },
        },
        { provide: PrismaService, useValue: createInMemoryPrisma() },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    failedLoginTracker = module.get<FailedLoginTrackerService>(FailedLoginTrackerService);
    prismaService = module.get(PrismaService);
  });

  afterEach(async () => {
    // Clean up test data
    failedLoginTracker.clearAll();
    await prismaService.user.deleteMany({
      where: { email: testEmail },
    });
  });

  afterAll(async () => {
    await prismaService.$disconnect();
  });

  describe('Failed Login Tracking', () => {
    beforeEach(async () => {
      // Create test user
      const passwordHash = await bcrypt.hash(testPassword, 4);
      await prismaService.user.create({
        data: {
          email: testEmail,
          passwordHash,
          role: 'STUDENT',
          status: 'ACTIVE',
          mustChangePassword: false,
        },
      });
    });

    it('should track failed login attempts', async () => {
      expect(failedLoginTracker.getAttemptCount(testEmail)).toBe(0);

      // First failed attempt
      try {
        await authService.login(testEmail, wrongPassword);
      } catch (error) {
        expect(error.message).toContain('Invalid credentials');
        expect(error.message).toContain('4 attempts remaining');
      }

      expect(failedLoginTracker.getAttemptCount(testEmail)).toBe(1);
    });

    it('should decrease remaining attempts with each failure', async () => {
      for (let i = 1; i <= 4; i++) {
        try {
          await authService.login(testEmail, wrongPassword);
        } catch (error) {
          const remaining = 5 - i;
          expect(error.message).toContain(`${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining`);
        }
      }

      expect(failedLoginTracker.getRemainingAttempts(testEmail)).toBe(1);
    });

    it('should lock account after 5 failed attempts', async () => {
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        try {
          await authService.login(testEmail, wrongPassword);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(failedLoginTracker.isLocked(testEmail)).toBe(true);

      // Next attempt should return HTTP 429
      try {
        await authService.login(testEmail, wrongPassword);
        fail('Should have thrown 429 error');
      } catch (error) {
        expect(error.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(error.message).toContain('Account is temporarily locked');
        expect(error.message).toContain('minute');
      }
    });

    it('should return 429 with lockout time remaining', async () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        try {
          await authService.login(testEmail, wrongPassword);
        } catch (error) {
          // Expected
        }
      }

      // Try to login while locked
      try {
        await authService.login(testEmail, testPassword);
        fail('Should have thrown 429 error');
      } catch (error) {
        expect(error.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(error.message).toContain('15 minute');
        
        const remainingSeconds = failedLoginTracker.getLockoutTimeRemaining(testEmail);
        expect(remainingSeconds).toBeGreaterThan(890); // Close to 15 minutes
        expect(remainingSeconds).toBeLessThanOrEqual(900);
      }
    });

    it('should reset counter on successful login', async () => {
      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        try {
          await authService.login(testEmail, wrongPassword);
        } catch (error) {
          // Expected
        }
      }

      expect(failedLoginTracker.getAttemptCount(testEmail)).toBe(3);

      // Successful login
      const result = await authService.login(testEmail, testPassword);
      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe(testEmail);

      // Counter should be reset
      expect(failedLoginTracker.getAttemptCount(testEmail)).toBe(0);
      expect(failedLoginTracker.getRemainingAttempts(testEmail)).toBe(5);
    });

    it('should not allow login even with correct password when locked', async () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        try {
          await authService.login(testEmail, wrongPassword);
        } catch (error) {
          // Expected
        }
      }

      // Try correct password while locked
      try {
        await authService.login(testEmail, testPassword);
        fail('Should have thrown 429 error');
      } catch (error) {
        expect(error.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('should track failed attempts for non-existent users', async () => {
      const nonExistentEmail = 'nonexistent@example.com';

      try {
        await authService.login(nonExistentEmail, wrongPassword);
      } catch (error) {
        expect(error.message).toBe('Invalid email or password');
      }

      expect(failedLoginTracker.getAttemptCount(nonExistentEmail)).toBe(1);
    });

    it('should handle lockout for 15 minutes (not 30)', async () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        try {
          await authService.login(testEmail, wrongPassword);
        } catch (error) {
          // Expected
        }
      }

      const remainingSeconds = failedLoginTracker.getLockoutTimeRemaining(testEmail);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      
      // Should be 15 minutes, not 30
      expect(remainingMinutes).toBe(15);
    });
  });

  describe('Multiple Users', () => {
    const user1Email = 'user1@example.com';
    const user2Email = 'user2@example.com';

    beforeEach(async () => {
      const passwordHash = await bcrypt.hash(testPassword, 4);
      
      await prismaService.user.create({
        data: {
          email: user1Email,
          passwordHash,
          role: 'STUDENT',
          status: 'ACTIVE',
          mustChangePassword: false,
        },
      });

      await prismaService.user.create({
        data: {
          email: user2Email,
          passwordHash,
          role: 'STUDENT',
          status: 'ACTIVE',
          mustChangePassword: false,
        },
      });
    });

    afterEach(async () => {
      await prismaService.user.deleteMany({
        where: {
          email: {
            in: [user1Email, user2Email],
          },
        },
      });
    });

    it('should track attempts independently per user', async () => {
      // User 1: 3 failed attempts
      for (let i = 0; i < 3; i++) {
        try {
          await authService.login(user1Email, wrongPassword);
        } catch (error) {
          // Expected
        }
      }

      // User 2: 1 failed attempt
      try {
        await authService.login(user2Email, wrongPassword);
      } catch (error) {
        // Expected
      }

      expect(failedLoginTracker.getAttemptCount(user1Email)).toBe(3);
      expect(failedLoginTracker.getAttemptCount(user2Email)).toBe(1);
      expect(failedLoginTracker.getRemainingAttempts(user1Email)).toBe(2);
      expect(failedLoginTracker.getRemainingAttempts(user2Email)).toBe(4);
    });

    it('should lock users independently', async () => {
      // Lock user 1
      for (let i = 0; i < 5; i++) {
        try {
          await authService.login(user1Email, wrongPassword);
        } catch (error) {
          // Expected
        }
      }

      // User 2: 1 failed attempt
      try {
        await authService.login(user2Email, wrongPassword);
      } catch (error) {
        // Expected
      }

      expect(failedLoginTracker.isLocked(user1Email)).toBe(true);
      expect(failedLoginTracker.isLocked(user2Email)).toBe(false);

      // User 2 can still login successfully
      const result = await authService.login(user2Email, testPassword);
      expect(result).toBeDefined();
      expect(result.user.email).toBe(user2Email);
    });
  });
});
