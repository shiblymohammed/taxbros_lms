import { Injectable } from '@nestjs/common';

interface LoginAttempt {
  count: number;
  lockedUntil: Date | null;
}

/**
 * Failed Login Tracker Service
 * 
 * In-memory service for tracking failed login attempts and account lockouts.
 * Implements requirement R37 (Failed Login Protection):
 * - Tracks failed attempts per email address
 * - Locks account for 15 minutes after 5 failed attempts
 * - Provides lockout time remaining for error messages
 * - Resets counter on successful login
 * 
 * **Validates Requirements:** R37 (Session Management)
 */
@Injectable()
export class FailedLoginTrackerService {
  // In-memory storage: Map<email, LoginAttempt>
  private readonly attempts: Map<string, LoginAttempt> = new Map();
  
  // Configuration constants
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 15;
  
  /**
   * Record a failed login attempt for an email address
   * @param email User email address
   * @returns New attempt count
   */
  recordFailedAttempt(email: string): number {
    const attempt = this.attempts.get(email) || { count: 0, lockedUntil: null };
    attempt.count += 1;
    
    // Lock account if max attempts reached
    if (attempt.count >= this.MAX_ATTEMPTS) {
      const lockoutUntil = new Date();
      lockoutUntil.setMinutes(lockoutUntil.getMinutes() + this.LOCKOUT_DURATION_MINUTES);
      attempt.lockedUntil = lockoutUntil;
    }
    
    this.attempts.set(email, attempt);
    return attempt.count;
  }
  
  /**
   * Check if an account is currently locked
   * @param email User email address
   * @returns True if locked, false otherwise
   */
  isLocked(email: string): boolean {
    const attempt = this.attempts.get(email);
    
    if (!attempt || !attempt.lockedUntil) {
      return false;
    }
    
    const now = new Date();
    
    // Check if lockout period has expired
    if (now >= attempt.lockedUntil) {
      // Lockout expired, clear it
      this.resetAttempts(email);
      return false;
    }
    
    return true;
  }
  
  /**
   * Get remaining lockout time in seconds
   * @param email User email address
   * @returns Remaining seconds, or 0 if not locked
   */
  getLockoutTimeRemaining(email: string): number {
    const attempt = this.attempts.get(email);
    
    if (!attempt || !attempt.lockedUntil) {
      return 0;
    }
    
    const now = new Date();
    const remainingMs = attempt.lockedUntil.getTime() - now.getTime();
    
    if (remainingMs <= 0) {
      return 0;
    }
    
    return Math.ceil(remainingMs / 1000); // Convert to seconds
  }
  
  /**
   * Get remaining attempts before lockout
   * @param email User email address
   * @returns Number of attempts remaining
   */
  getRemainingAttempts(email: string): number {
    const attempt = this.attempts.get(email);
    
    if (!attempt) {
      return this.MAX_ATTEMPTS;
    }
    
    const remaining = this.MAX_ATTEMPTS - attempt.count;
    return remaining > 0 ? remaining : 0;
  }
  
  /**
   * Get current attempt count
   * @param email User email address
   * @returns Current attempt count
   */
  getAttemptCount(email: string): number {
    const attempt = this.attempts.get(email);
    return attempt ? attempt.count : 0;
  }
  
  /**
   * Reset failed login attempts for an email (called on successful login)
   * @param email User email address
   */
  resetAttempts(email: string): void {
    this.attempts.delete(email);
  }
  
  /**
   * Clear all tracking data (useful for testing)
   */
  clearAll(): void {
    this.attempts.clear();
  }
  
  /**
   * Clean up expired lockouts (can be called periodically)
   * Removes entries where lockout has expired and no recent attempts
   */
  cleanupExpiredLockouts(): void {
    const now = new Date();
    
    for (const [email, attempt] of this.attempts.entries()) {
      if (attempt.lockedUntil && now >= attempt.lockedUntil) {
        this.attempts.delete(email);
      }
    }
  }
}
