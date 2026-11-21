# Authentication Module

This module provides JWT-based authentication and role-based authorization for the TAXBROS LMS API.

## Features

- **JWT Authentication**: 15-minute access tokens with Passport.js
- **Role-Based Access Control**: Hierarchical role enforcement (SUPER_ADMIN > ADMINISTRATOR > STAFF > STUDENT)
- **Public Routes**: Bypass authentication with `@Public()` decorator
- **Current User Access**: Extract authenticated user with `@CurrentUser()` decorator

## Components

### Guards

#### JwtAuthGuard
Validates JWT tokens from the Authorization header. Automatically bypasses authentication for routes decorated with `@Public()`.

**Applied globally**: Should be registered as a global guard in `main.ts` or `app.module.ts`.

#### RolesGuard
Enforces role requirements with hierarchy support. If a route requires `STAFF` role, `ADMINISTRATOR` and `SUPER_ADMIN` are also granted access.

**Role Hierarchy**:
- `SUPER_ADMIN` (level 4): Full system access
- `ADMINISTRATOR` (level 3): Full system management
- `STAFF` (level 2): Permission-based access
- `STUDENT` (level 1): Own records only

### Decorators

#### @Public()
Marks a route or controller as publicly accessible, bypassing JWT authentication.

```typescript
@Public()
@Post('login')
async login(@Body() loginDto: LoginDto) {
  return this.authService.login(loginDto);
}
```

#### @Roles(...roles)
Specifies which user roles are allowed to access a route. Supports role hierarchy.

```typescript
// Single role
@Roles(UserRole.ADMINISTRATOR)
@Get('/admin/users')
async getAllUsers() { ... }

// Multiple roles
@Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
@Post('/attendance/mark')
async markAttendance() { ... }
```

#### @CurrentUser(property?)
Extracts authenticated user information from the request.

```typescript
// Get entire user object
@Get('profile')
async getProfile(@CurrentUser() user: CurrentUserPayload) {
  return user;
}

// Get specific property
@Get('my-courses')
async getMyCourses(@CurrentUser('userId') userId: string) {
  return this.coursesService.getByStudent(userId);
}
```

## Usage Examples

### Controller with Mixed Access

```typescript
import { Controller, Get, Post, UseGuards, Body } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { 
  Public, 
  Roles, 
  CurrentUser, 
  CurrentUserPayload,
  JwtAuthGuard,
  RolesGuard 
} from '../auth';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  
  // Public endpoint - no authentication required
  @Public()
  @Get('health')
  healthCheck() {
    return { status: 'ok' };
  }

  // Protected endpoint - any authenticated user
  @Get('me')
  getCurrentUser(@CurrentUser() user: CurrentUserPayload) {
    return user;
  }

  // Role-restricted endpoint - ADMINISTRATOR only (SUPER_ADMIN also allowed via hierarchy)
  @Roles(UserRole.ADMINISTRATOR)
  @Get()
  async getAllUsers() {
    return this.usersService.findAll();
  }

  // Role-restricted endpoint - STAFF or higher
  @Roles(UserRole.STAFF)
  @Post('update-profile')
  async updateProfile(
    @CurrentUser('userId') userId: string,
    @Body() updateDto: UpdateProfileDto,
  ) {
    return this.usersService.update(userId, updateDto);
  }
}
```

### Global Guard Registration

In `main.ts`:

```typescript
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { JwtAuthGuard, RolesGuard } from './auth';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Get Reflector instance for metadata reading
  const reflector = app.get(Reflector);
  
  // Apply guards globally
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new RolesGuard(reflector),
  );
  
  await app.listen(3000);
}
bootstrap();
```

## Integration with AuthService

The guards expect the JWT payload to contain:

```typescript
interface CurrentUserPayload {
  userId: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  studentId?: string;  // Present if user is a student
  staffId?: string;    // Present if user is a staff member
}
```

This payload should be created during login in the `AuthService.login()` method and validated by `JwtStrategy`.

## Security Considerations

1. **Token Expiry**: Access tokens expire in 15 minutes. Implement refresh token flow for longer sessions.
2. **Role Hierarchy**: Higher roles automatically inherit lower role permissions.
3. **Public Routes**: Use `@Public()` sparingly and only for truly public endpoints (login, health checks).
4. **User Context**: The `@CurrentUser()` decorator only works on protected routes. Using it on public routes returns `undefined`.

## Testing

Guards can be mocked in unit tests:

```typescript
import { Test } from '@nestjs/testing';
import { JwtAuthGuard, RolesGuard } from '../auth';

describe('UsersController', () => {
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [UsersService],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });
  
  // Tests...
});
```

## Next Steps

This task (Task 5) creates the guards and decorators. The next task (Task 6) will:
1. Implement the `AuthService` with login/logout/refresh methods
2. Create the `JwtStrategy` for token validation
3. Build the authentication endpoints

The `JwtStrategy` is referenced in `JwtAuthGuard` but will be implemented in Task 4/6 of the implementation plan.
