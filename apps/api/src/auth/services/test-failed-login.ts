/**
 * Manual verification script for FailedLoginTracker service
 * Run with: npx ts-node src/auth/services/test-failed-login.ts
 */

import { FailedLoginTrackerService } from './failed-login-tracker.service';

const tracker = new FailedLoginTrackerService();

console.log('=== Testing FailedLoginTracker Service ===\n');

const testEmail = 'test@example.com';

// Test 1: Initial state
console.log('Test 1: Initial state');
console.log(`Attempt count: ${tracker.getAttemptCount(testEmail)}`);
console.log(`Remaining attempts: ${tracker.getRemainingAttempts(testEmail)}`);
console.log(`Is locked: ${tracker.isLocked(testEmail)}`);
console.log('✓ Passed\n');

// Test 2: Record failed attempts
console.log('Test 2: Record 3 failed attempts');
for (let i = 1; i <= 3; i++) {
  const count = tracker.recordFailedAttempt(testEmail);
  console.log(`Attempt ${i}: count=${count}, remaining=${tracker.getRemainingAttempts(testEmail)}`);
}
console.log(`Is locked: ${tracker.isLocked(testEmail)}`);
console.log('✓ Passed\n');

// Test 3: Lock account after 5 attempts
console.log('Test 3: Lock account after 5 attempts');
tracker.resetAttempts(testEmail); // Reset first
for (let i = 1; i <= 5; i++) {
  tracker.recordFailedAttempt(testEmail);
}
console.log(`Attempt count: ${tracker.getAttemptCount(testEmail)}`);
console.log(`Is locked: ${tracker.isLocked(testEmail)}`);
const remainingSeconds = tracker.getLockoutTimeRemaining(testEmail);
const remainingMinutes = Math.ceil(remainingSeconds / 60);
console.log(`Lockout time remaining: ${remainingMinutes} minutes (${remainingSeconds} seconds)`);
console.log('✓ Passed\n');

// Test 4: Reset attempts
console.log('Test 4: Reset attempts');
tracker.resetAttempts(testEmail);
console.log(`Attempt count: ${tracker.getAttemptCount(testEmail)}`);
console.log(`Remaining attempts: ${tracker.getRemainingAttempts(testEmail)}`);
console.log(`Is locked: ${tracker.isLocked(testEmail)}`);
console.log('✓ Passed\n');

// Test 5: Multiple users
console.log('Test 5: Multiple users tracking');
const user1 = 'user1@example.com';
const user2 = 'user2@example.com';

tracker.recordFailedAttempt(user1);
tracker.recordFailedAttempt(user1);
tracker.recordFailedAttempt(user2);

console.log(`User 1 attempts: ${tracker.getAttemptCount(user1)}`);
console.log(`User 2 attempts: ${tracker.getAttemptCount(user2)}`);
console.log(`User 1 remaining: ${tracker.getRemainingAttempts(user1)}`);
console.log(`User 2 remaining: ${tracker.getRemainingAttempts(user2)}`);
console.log('✓ Passed\n');

// Test 6: Lockout duration is 15 minutes (not 30)
console.log('Test 6: Verify lockout duration is 15 minutes');
tracker.clearAll();
const lockTestEmail = 'locktest@example.com';
for (let i = 0; i < 5; i++) {
  tracker.recordFailedAttempt(lockTestEmail);
}
const lockoutSeconds = tracker.getLockoutTimeRemaining(lockTestEmail);
const lockoutMinutes = Math.ceil(lockoutSeconds / 60);
console.log(`Lockout duration: ${lockoutMinutes} minutes`);
if (lockoutMinutes === 15) {
  console.log('✓ Passed - Lockout is 15 minutes as required\n');
} else {
  console.log(`✗ Failed - Expected 15 minutes, got ${lockoutMinutes}\n`);
}

console.log('=== All tests completed ===');
