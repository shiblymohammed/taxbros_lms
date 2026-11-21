# JWT Authentication Service - Integration Test Guide

This document provides manual integration testing steps to verify the JWT authentication services.

## Services Implemented

### 1. JwtTokenService (`src/auth/services/jwt.service.ts`)
- ✅ `generateAccessToken(payload)` - Generates 15-minute JWT access token
- ✅ `generateRefreshToken(payload)` - Generates 7-day JWT refresh token
- ✅ `validateAccessToken(token)` - Validates and decodes access token
- ✅ `validateRefreshToken(token)` - Validates and decodes refresh token
- ✅ `generateTokenPair(payload)` - Generates both tokens at once

### 2. RefreshTokenService (`src/auth/services/refresh-token.service.ts`)
- ✅ `generateSecureToken()` - Generates cryptographically secure 64-char hex token
- ✅ `createRefreshToken(userId)` - Stores refresh token in database with 7-day expiry
- ✅ `validateRefreshToken(token)` - Checks token validity and expiry, auto-deletes expired
- ✅ `invalidateRefreshToken(token)` - Removes token from database (logout)
- ✅ `invalidateAllUserTokens(userId)` - Security action to revoke all user tokens
- ✅ `rotateRefreshToken(oldToken, userId)` - Token rotation for refresh endpoint
- ✅ `cleanupExpiredTokens()` - Maintenance function to remove expired tokens

### 3. AuthService (`src/auth/services/auth.service.ts`)
- ✅ `login(email, password)` - Validates credentials, generates tokens, updates lastLoginAt
- ✅ `refresh(refreshToken)` - Validates refresh token, rotates tokens
- ✅ `logout(refreshToken)` - Invalidates refresh token
- ✅ `validateUser(email, password)` - Passport strategy helper
- ✅ `changePassword(userId, currentPassword, newPassword)` - Password change with bcrypt

## Token Configuration

### Access Token
- **Expiry**: 15 minutes (configurable via `JWT_EXPIRY`)
- **Secret**: `JWT_SECRET` environment variable
- **Purpose**: Short-lived token for API authentication
- **Format**: JWT with payload `{ sub, email, role }`

### Refresh Token
- **Expiry**: 7 days (configurable via `REFRESH_TOKEN_EXPIRY`)
- **Secret**: `JWT_REFRESH_SECRET` environment variable (separate from access token secret)
- **Storage**: Database (RefreshToken table) with cascade delete on user deletion
- **Purpose**: Long-lived token to obtain new access tokens
- **Format**: Cryptographically secure random 64-character hex string

## Security Features

1. **Password Hashing**: bcrypt with 12 salt rounds (as per R36)
2. **Token Rotation**: Refresh tokens are rotated on each refresh request
3. **Expiry Validation**: Expired tokens are auto-deleted from database
4. **Account Status Check**: Login and refresh check if account is ACTIVE
5. **Cascade Delete**: Refresh tokens are deleted when user is deleted
6. **Separate Secrets**: Access and refresh tokens use different secrets

## Database Schema

The RefreshToken model includes:
```prisma
model RefreshToken {
  id         String   @id @default(uuid())
  token      String   @unique
  userId     String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## Environment Variables Required

```env
JWT_SECRET="your-super-secret-jwt-key-change-in-production-minimum-256-bits"
JWT_REFRESH_SECRET="your-super-secret-refresh-token-key-change-in-production-minimum-256-bits"
JWT_EXPIRY="15m"
REFRESH_TOKEN_EXPIRY="7d"
```

## Integration with Requirements

### Validates Requirement R2 (Role-Based Access Control)
- JWT tokens contain user role in payload
- Token validation provides user context for authorization
- Access tokens have 15-minute expiry for security

### Validates Requirement R36 (Password Security)
- Uses bcrypt.compare() for password verification
- Passwords hashed with 12 salt rounds
- Password change includes current password verification

### Validates Requirement R3 (Session Management)
- Refresh tokens stored in database with 7-day expiry
- Token rotation on refresh prevents token reuse
- Logout properly invalidates refresh tokens
- Account deactivation cascades to token deletion

## Manual Testing Steps

### Prerequisites
1. Database is running and migrated
2. At least one ACTIVE user exists in database
3. Environment variables are configured

### Test 1: Login Flow
```typescript
// POST /auth/login
{
  "email": "test@example.com",
  "password": "password123"
}

// Expected Response:
{
  "accessToken": "eyJhbG...",  // JWT format
  "refreshToken": "a1b2c3...",  // 64 hex chars
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "role": "STUDENT",
    "mustChangePassword": false
  }
}

// Verify:
// - accessToken is valid JWT
// - refreshToken exists in database
// - user.lastLoginAt is updated
```

### Test 2: Token Refresh Flow
```typescript
// POST /auth/refresh
{
  "refreshToken": "a1b2c3..."  // from login response
}

// Expected Response:
{
  "accessToken": "eyJhbG...",  // New access token
  "refreshToken": "d4e5f6..."  // New refresh token
}

// Verify:
// - Old refresh token is deleted from database
// - New refresh token is stored in database
// - Access token contains correct user payload
```

### Test 3: Logout Flow
```typescript
// POST /auth/logout
{
  "refreshToken": "d4e5f6..."
}

// Expected Response:
{
  "success": true,
  "message": "Logged out successfully"
}

// Verify:
// - Refresh token is removed from database
// - Subsequent refresh with same token fails
```

### Test 4: Invalid Credentials
```typescript
// POST /auth/login
{
  "email": "test@example.com",
  "password": "wrongpassword"
}

// Expected Response: 401 Unauthorized
{
  "statusCode": 401,
  "message": "Invalid email or password"
}
```

### Test 5: Inactive Account
```typescript
// Given: User account status is INACTIVE

// POST /auth/login
{
  "email": "inactive@example.com",
  "password": "password123"
}

// Expected Response: 401 Unauthorized
{
  "statusCode": 401,
  "message": "Account is not active"
}
```

### Test 6: Expired Refresh Token
```typescript
// Given: Refresh token has expiresAt < now()

// POST /auth/refresh
{
  "refreshToken": "expired-token"
}

// Expected Response: 401 Unauthorized
{
  "statusCode": 401,
  "message": "Invalid or expired refresh token"
}

// Verify:
// - Expired token is deleted from database
```

### Test 7: Password Change
```typescript
// POST /auth/change-password
{
  "userId": "user-uuid",
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}

// Expected Response:
{
  "success": true,
  "message": "Password changed successfully"
}

// Verify:
// - User can login with new password
// - User cannot login with old password
// - mustChangePassword flag is set to false
```

## Code Quality Verification

✅ All services follow NestJS best practices
✅ Proper dependency injection
✅ TypeScript strict mode compatible
✅ Error handling with appropriate HTTP exceptions
✅ Comprehensive JSDoc comments
✅ Secure token generation using crypto.randomBytes
✅ Database operations use Prisma ORM
✅ Cascade delete configured for refresh tokens
✅ Token expiry configured from environment variables

## Next Steps (Task 5)

The following will be implemented in the next task:
- JwtAuthGuard with Passport JWT strategy
- RolesGuard for role-based authorization
- @Public() decorator for public endpoints
- @Roles() decorator for role requirements
- @CurrentUser() decorator for request.user access
- JWT strategy configuration
