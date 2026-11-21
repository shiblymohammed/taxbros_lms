# Account Lockout Feature - Testing Guide

This document provides manual testing steps to verify the account lockout functionality.

## Overview

The account lockout feature implements Requirement R37:
- Tracks failed login attempts in the User model
- Locks account after 5 failed attempts
- Enforces a 30-minute lockout period
- Resets failed attempts counter on successful login
- Provides clear error messages about remaining attempts and lockout status

## Database Schema Changes

The following fields were added to the User model:
- `failedLoginAttempts` (Int, default 0): Counter for failed login attempts
- `lockedUntil` (DateTime, nullable): Timestamp when lockout expires
- Index on `lockedUntil` for efficient queries

Migration: `20261117124115_add_account_lockout`

## Implementation Details

### AuthService.login() Method Logic

1. **Pre-login checks:**
   - Check if account is locked (lockedUntil > now)
   - If locked, return: "Account is temporarily locked. Please try again later."
   - If lockout expired, clear failedLoginAttempts and lockedUntil

2. **Failed login:**
   - Increment failedLoginAttempts
   - Calculate remainingAttempts = 5 - newFailedAttempts
   - If newFailedAttempts >= 5:
     - Set lockedUntil = now + 30 minutes
     - Return: "Account is temporarily locked. Please try again later."
   - Otherwise return: "Invalid credentials. X attempt(s) remaining before lockout."

3. **Successful login:**
   - Reset failedLoginAttempts to 0
   - Clear lockedUntil (set to null)
   - Update lastLoginAt timestamp
   - Generate and return tokens

## Manual Testing Steps

### Prerequisites
1. Ensure the database migration has been applied
2. Create a test user account (or use an existing one)
3. Have an API client ready (Postman, curl, or Thunder Client)

### Test 1: Failed Login Tracking

**Steps:**
1. Attempt login with incorrect password (1st attempt)
   ```
   POST /api/auth/login
   {
     "email": "test@example.com",
     "password": "wrongpassword"
   }
   ```

**Expected Result:**
- Status: 401 Unauthorized
- Message: "Invalid credentials. 4 attempts remaining before lockout."
- Database: `failedLoginAttempts` = 1

### Test 2: Progressive Attempt Counting

**Steps:**
1. Repeat failed login attempts with wrong password (2nd, 3rd, 4th attempts)

**Expected Results:**
- 2nd attempt: "Invalid credentials. 3 attempts remaining before lockout."
- 3rd attempt: "Invalid credentials. 2 attempts remaining before lockout."
- 4th attempt: "Invalid credentials. 1 attempt remaining before lockout."

### Test 3: Account Lockout on 5th Attempt

**Steps:**
1. Attempt login with incorrect password (5th attempt)

**Expected Result:**
- Status: 401 Unauthorized
- Message: "Account is temporarily locked. Please try again later."
- Database: 
  - `failedLoginAttempts` = 5
  - `lockedUntil` = current timestamp + 30 minutes

### Test 4: Login Blocked During Lockout

**Steps:**
1. Immediately attempt login with CORRECT password

**Expected Result:**
- Status: 401 Unauthorized
- Message: "Account is temporarily locked. Please try again later."
- Login is denied even with correct credentials

### Test 5: Lockout Expiry

**Steps:**
1. Wait 30 minutes (or manually update database to set `lockedUntil` to past time)
2. Attempt login with CORRECT password

**Expected Result:**
- Status: 200 OK
- Successful login with tokens returned
- Database:
  - `failedLoginAttempts` = 0
  - `lockedUntil` = null
  - `lastLoginAt` = current timestamp

### Test 6: Reset on Successful Login

**Steps:**
1. Fail login 3 times with wrong password
2. Login successfully with correct password

**Expected Result:**
- Successful login
- Database:
  - `failedLoginAttempts` = 0
  - `lockedUntil` = null

### Test 7: Multiple Users Independent Tracking

**Steps:**
1. Fail login 4 times for User A
2. Fail login 2 times for User B
3. Check both user records

**Expected Result:**
- User A: `failedLoginAttempts` = 4
- User B: `failedLoginAttempts` = 2
- Counters are tracked independently

## Database Verification Queries

```sql
-- Check failed attempts and lockout status
SELECT 
  email, 
  "failedLoginAttempts", 
  "lockedUntil",
  CASE 
    WHEN "lockedUntil" > NOW() THEN 'LOCKED'
    ELSE 'UNLOCKED'
  END as lock_status
FROM users
WHERE email = 'test@example.com';

-- Manually reset lockout for testing
UPDATE users 
SET "failedLoginAttempts" = 0, "lockedUntil" = NULL 
WHERE email = 'test@example.com';

-- Manually expire lockout for testing
UPDATE users 
SET "lockedUntil" = NOW() - INTERVAL '1 minute'
WHERE email = 'test@example.com';
```

## Unit Test Coverage

The following test cases are implemented in `auth.service.spec.ts`:

1. ✓ Successfully login with correct credentials and reset failed attempts
2. ✓ Increment failedLoginAttempts on incorrect password (1st attempt)
3. ✓ Show correct remaining attempts message (singular)
4. ✓ Lock account after 5 failed attempts
5. ✓ Reject login when account is locked
6. ✓ Clear lockout after expiry and allow login
7. ✓ Reject login if account is inactive
8. ✓ Reject login if user not found
9. ✓ Change password successfully
10. ✓ Throw error if current password is incorrect
11. ✓ Throw error if user not found during password change

## Security Considerations

- **Timing Attacks**: The implementation does not reveal whether a user exists based on response timing
- **Error Messages**: Generic "Invalid credentials" message for failed logins (doesn't reveal if email exists)
- **Lockout Duration**: 30-minute lockout is reasonable to prevent brute force while not overly inconveniencing users
- **Index Performance**: The `lockedUntil` index ensures efficient queries for locked accounts
- **Password Hashing**: bcrypt with 12 salt rounds as per requirements
- **Token Security**: JWT tokens are not affected by account lockout on subsequent requests

## Requirement Validation

This implementation validates **Requirement R37: Account Lockout after failed login attempts**

✓ Failed login attempts are tracked
✓ Account locks after 5 consecutive failed attempts
✓ Lockout duration is 30 minutes
✓ Failed attempts reset to 0 on successful login
✓ Specific error messages for locked accounts
✓ Index on lockedUntil for efficient queries
✓ Lockout is checked before password validation
✓ Expired lockouts are automatically cleared
