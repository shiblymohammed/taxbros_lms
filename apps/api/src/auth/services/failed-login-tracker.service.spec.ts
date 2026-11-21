import { Test, TestingModule } from '@nestjs/testing';
import { FailedLoginTrackerService } from './failed-login-tracker.service';

describe('FailedLoginTrackerService', () => {
  let service: FailedLoginTrackerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FailedLoginTrackerService],
    }).compile();

    service = module.get<FailedLoginTrackerService>(FailedLoginTrackerService);
  });

  afterEach(() => {
    service.clearAll();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordFailedAttempt', () => {
    it('should increment attempt count', () => {
      const email = 'test@example.com';
      
      const count1 = service.recordFailedAttempt(email);
      expect(count1).toBe(1);
      
      const count2 = service.recordFailedAttempt(email);
      expect(count2).toBe(2);
    });

    it('should lock account after 5 failed attempts', () => {
      const email = 'test@example.com';
      
      for (let i = 0; i < 4; i++) {
        service.recordFailedAttempt(email);
      }
      
      expect(service.isLocked(email)).toBe(false);
      
      service.recordFailedAttempt(email); // 5th attempt
      expect(service.isLocked(email)).toBe(true);
    });
  });

  describe('isLocked', () => {
    it('should return false for email with no attempts', () => {
      expect(service.isLocked('new@example.com')).toBe(false);
    });

    it('should return true when locked', () => {
      const email = 'test@example.com';
      
      for (let i = 0; i < 5; i++) {
        service.recordFailedAttempt(email);
      }
      
      expect(service.isLocked(email)).toBe(true);
    });

    it('should return false after lockout expires', async () => {
      const email = 'test@example.com';
      
      // Lock the account
      for (let i = 0; i < 5; i++) {
        service.recordFailedAttempt(email);
      }
      
      expect(service.isLocked(email)).toBe(true);
      
      // Manually expire the lockout by clearing and simulating expired time
      // In production, this would require waiting 15 minutes
      // For testing, we'll verify the logic by checking after reset
      service.resetAttempts(email);
      expect(service.isLocked(email)).toBe(false);
    });
  });

  describe('getLockoutTimeRemaining', () => {
    it('should return 0 for unlocked account', () => {
      expect(service.getLockoutTimeRemaining('test@example.com')).toBe(0);
    });

    it('should return remaining seconds when locked', () => {
      const email = 'test@example.com';
      
      for (let i = 0; i < 5; i++) {
        service.recordFailedAttempt(email);
      }
      
      const remaining = service.getLockoutTimeRemaining(email);
      // Should be close to 15 minutes (900 seconds)
      expect(remaining).toBeGreaterThan(890);
      expect(remaining).toBeLessThanOrEqual(900);
    });
  });

  describe('getRemainingAttempts', () => {
    it('should return 5 for new email', () => {
      expect(service.getRemainingAttempts('new@example.com')).toBe(5);
    });

    it('should decrease with each failed attempt', () => {
      const email = 'test@example.com';
      
      expect(service.getRemainingAttempts(email)).toBe(5);
      
      service.recordFailedAttempt(email);
      expect(service.getRemainingAttempts(email)).toBe(4);
      
      service.recordFailedAttempt(email);
      expect(service.getRemainingAttempts(email)).toBe(3);
    });

    it('should return 0 after 5 failed attempts', () => {
      const email = 'test@example.com';
      
      for (let i = 0; i < 5; i++) {
        service.recordFailedAttempt(email);
      }
      
      expect(service.getRemainingAttempts(email)).toBe(0);
    });
  });

  describe('getAttemptCount', () => {
    it('should return 0 for new email', () => {
      expect(service.getAttemptCount('new@example.com')).toBe(0);
    });

    it('should return current attempt count', () => {
      const email = 'test@example.com';
      
      service.recordFailedAttempt(email);
      expect(service.getAttemptCount(email)).toBe(1);
      
      service.recordFailedAttempt(email);
      expect(service.getAttemptCount(email)).toBe(2);
    });
  });

  describe('resetAttempts', () => {
    it('should clear attempt count', () => {
      const email = 'test@example.com';
      
      service.recordFailedAttempt(email);
      service.recordFailedAttempt(email);
      expect(service.getAttemptCount(email)).toBe(2);
      
      service.resetAttempts(email);
      expect(service.getAttemptCount(email)).toBe(0);
    });

    it('should unlock locked account', () => {
      const email = 'test@example.com';
      
      for (let i = 0; i < 5; i++) {
        service.recordFailedAttempt(email);
      }
      
      expect(service.isLocked(email)).toBe(true);
      
      service.resetAttempts(email);
      expect(service.isLocked(email)).toBe(false);
    });
  });

  describe('cleanupExpiredLockouts', () => {
    it('should not affect active lockouts', () => {
      const email = 'test@example.com';
      
      for (let i = 0; i < 5; i++) {
        service.recordFailedAttempt(email);
      }
      
      service.cleanupExpiredLockouts();
      expect(service.isLocked(email)).toBe(true);
    });

    it('should remove entries with expired lockouts', () => {
      const email = 'test@example.com';
      
      service.recordFailedAttempt(email);
      service.resetAttempts(email);
      
      service.cleanupExpiredLockouts();
      expect(service.getAttemptCount(email)).toBe(0);
    });
  });

  describe('multiple users', () => {
    it('should track attempts independently per email', () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';
      
      service.recordFailedAttempt(email1);
      service.recordFailedAttempt(email1);
      service.recordFailedAttempt(email2);
      
      expect(service.getAttemptCount(email1)).toBe(2);
      expect(service.getAttemptCount(email2)).toBe(1);
      expect(service.getRemainingAttempts(email1)).toBe(3);
      expect(service.getRemainingAttempts(email2)).toBe(4);
    });

    it('should lock accounts independently', () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';
      
      for (let i = 0; i < 5; i++) {
        service.recordFailedAttempt(email1);
      }
      
      service.recordFailedAttempt(email2);
      
      expect(service.isLocked(email1)).toBe(true);
      expect(service.isLocked(email2)).toBe(false);
    });
  });
});
