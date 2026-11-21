# Authentication Guards and Decorators - Usage Examples

This document provides practical examples of how to use the authentication guards and decorators in the TAXBROS LMS API.

## Table of Contents
1. [Global Guard Setup](#global-guard-setup)
2. [Controller Examples](#controller-examples)
3. [Common Patterns](#common-patterns)
4. [Error Handling](#error-handling)

## Global Guard Setup

### In `main.ts` (Recommended)

```typescript
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { JwtAuthGuard, RolesGuard } from './auth';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Get Reflector for metadata reading
  const reflector = app.get(Reflector);
  
  // Apply guards globally - order matters!
  // 1. JwtAuthGuard validates token and populates request.user
  // 2. RolesGuard checks user role against requirements
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new RolesGuard(reflector),
  );
  
  await app.listen(3000);
}
bootstrap();
```

### Alternative: In `app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule, JwtAuthGuard, RolesGuard } from './auth';

@Module({
  imports: [AuthModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
```

## Controller Examples

### 1. Public Authentication Controller

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '../auth';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Public login endpoint - no authentication required
   * Returns access token and sets refresh token in httpOnly cookie
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * Public token refresh endpoint
   * Reads refresh token from cookie
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request) {
    return this.authService.refresh(req.cookies['refresh_token']);
  }

  /**
   * Protected logout endpoint
   * Requires valid JWT token
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('userId') userId: string) {
    return this.authService.logout(userId);
  }
}
```

### 2. User Profile Controller (Mixed Access Levels)

```typescript
import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, CurrentUserPayload, Roles } from '../auth';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  /**
   * Get current user's own profile
   * Any authenticated user can access
   */
  @Get('me')
  getCurrentUser(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.findOne(user.userId);
  }

  /**
   * Update current user's profile
   * Any authenticated user can update their own profile
   */
  @Patch('me')
  updateCurrentUser(
    @CurrentUser('userId') userId: string,
    @Body() updateDto: UpdateProfileDto,
  ) {
    return this.usersService.update(userId, updateDto);
  }

  /**
   * Get all users - Admin only
   * SUPER_ADMIN and ADMINISTRATOR can access (via hierarchy)
   */
  @Roles(UserRole.ADMINISTRATOR)
  @Get()
  getAllUsers() {
    return this.usersService.findAll();
  }

  /**
   * Get specific user by ID - Admin only
   * SUPER_ADMIN and ADMINISTRATOR can access
   */
  @Roles(UserRole.ADMINISTRATOR)
  @Get(':id')
  getUserById(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  /**
   * Deactivate user - Admin only
   */
  @Roles(UserRole.ADMINISTRATOR)
  @Patch(':id/deactivate')
  deactivateUser(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }
}
```

### 3. Attendance Controller (Permission-Based Access)

```typescript
import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  /**
   * Mark student attendance
   * Available to STAFF (with MARK_ATTENDANCE permission), ADMINISTRATOR, and SUPER_ADMIN
   */
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @Post('student/mark')
  markStudentAttendance(
    @CurrentUser('userId') markedBy: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: MarkAttendanceDto,
  ) {
    // Additional permission check for STAFF happens in service layer
    return this.attendanceService.markStudentAttendance(dto, markedBy, role);
  }

  /**
   * View student's own attendance
   * Students can only see their own attendance
   */
  @Roles(UserRole.STUDENT)
  @Get('me')
  getMyAttendance(
    @CurrentUser('studentId') studentId: string,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.attendanceService.getStudentAttendance(studentId, month, year);
  }

  /**
   * View any student's attendance - Admin only
   */
  @Roles(UserRole.ADMINISTRATOR)
  @Get('student/:studentId')
  getStudentAttendance(
    @Param('studentId') studentId: string,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.attendanceService.getStudentAttendance(studentId, month, year);
  }

  /**
   * Generate attendance reports - Admin and Staff with VIEW_REPORTS permission
   */
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @Get('reports/monthly')
  generateMonthlyReport(
    @CurrentUser('role') role: UserRole,
    @CurrentUser('staffId') staffId: string,
    @Query('month') month: number,
    @Query('year') year: number,
    @Query('classId') classId?: string,
  ) {
    // Additional permission check for STAFF happens in service layer
    return this.attendanceService.generateMonthlyReport(
      month,
      year,
      classId,
      role,
      staffId,
    );
  }
}
```

### 4. Courses Controller (Student Access with Enrollment Check)

```typescript
import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';

@Controller('courses')
export class CoursesController {
  constructor(private coursesService: CoursesService) {}

  /**
   * Create course - Admin only
   */
  @Roles(UserRole.ADMINISTRATOR)
  @Post()
  createCourse(@Body() createDto: CreateCourseDto) {
    return this.coursesService.create(createDto);
  }

  /**
   * Get all courses
   * Students see only published courses they're enrolled in
   * Admins see all courses
   */
  @Get()
  getAllCourses(
    @CurrentUser('role') role: UserRole,
    @CurrentUser('studentId') studentId?: string,
  ) {
    if (role === UserRole.STUDENT) {
      return this.coursesService.getEnrolledCourses(studentId);
    }
    return this.coursesService.findAll();
  }

  /**
   * Get course details
   * Students can only access courses they're enrolled in
   * Service layer enforces enrollment check
   */
  @Get(':id')
  getCourse(
    @Param('id') id: string,
    @CurrentUser('role') role: UserRole,
    @CurrentUser('studentId') studentId?: string,
  ) {
    return this.coursesService.findOne(id, role, studentId);
  }

  /**
   * Publish course - Admin only
   */
  @Roles(UserRole.ADMINISTRATOR)
  @Patch(':id/publish')
  publishCourse(@Param('id') id: string) {
    return this.coursesService.publish(id);
  }
}
```

## Common Patterns

### Pattern 1: Student Data Isolation

```typescript
@Controller('progress')
export class ProgressController {
  /**
   * Students automatically get filtered to their own data
   * Admins can view any student's progress
   */
  @Get('lessons/:lessonId')
  getLessonProgress(
    @Param('lessonId') lessonId: string,
    @CurrentUser('role') role: UserRole,
    @CurrentUser('studentId') studentId?: string,
    @Query('studentId') queriedStudentId?: string,
  ) {
    // Admin can query any student, student can only query self
    const targetStudentId = 
      role === UserRole.ADMINISTRATOR && queriedStudentId
        ? queriedStudentId
        : studentId;
    
    return this.progressService.getLessonProgress(lessonId, targetStudentId);
  }
}
```

### Pattern 2: Multiple Role Options

```typescript
@Controller('reports')
export class ReportsController {
  /**
   * Available to multiple roles
   * STAFF needs additional permission check in service
   */
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @Get('attendance/summary')
  getAttendanceSummary(
    @CurrentUser('role') role: UserRole,
    @CurrentUser('staffId') staffId?: string,
  ) {
    // Service layer checks if STAFF has VIEW_REPORTS permission
    return this.reportsService.getAttendanceSummary(role, staffId);
  }
}
```

### Pattern 3: Extracting Multiple User Properties

```typescript
@Controller('quizzes')
export class QuizzesController {
  @Post(':id/submit')
  submitQuiz(
    @Param('id') quizId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('studentId') studentId: string,
    @CurrentUser('email') email: string,
    @Body() answers: SubmitQuizDto,
  ) {
    return this.quizzesService.submitQuiz(
      quizId,
      studentId,
      answers,
      { userId, email }, // metadata
    );
  }
}
```

### Pattern 4: Full User Object When Needed

```typescript
@Controller('admin')
export class AdminController {
  @Roles(UserRole.ADMINISTRATOR)
  @Get('audit-log')
  getAuditLog(@CurrentUser() user: CurrentUserPayload) {
    // Pass full user context for audit logging
    return this.auditService.getLog({
      performedBy: user.userId,
      role: user.role,
      email: user.email,
    });
  }
}
```

## Error Handling

### Expected HTTP Status Codes

```typescript
// 401 Unauthorized - Missing or invalid JWT token
{
  "statusCode": 401,
  "message": "Unauthorized"
}

// 403 Forbidden - Valid token but insufficient role
{
  "statusCode": 403,
  "message": "Access denied. Required role(s): ADMINISTRATOR"
}

// 403 Forbidden - Missing user information
{
  "statusCode": 403,
  "message": "User role information is missing"
}
```

### Custom Error Handling

```typescript
import { 
  ExceptionFilter, 
  Catch, 
  ArgumentsHost, 
  HttpException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

@Catch(ForbiddenException, UnauthorizedException)
export class AuthExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();

    // Custom logging
    console.log(`Auth error: ${exception.message}`);

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

## Testing Guards

### Mocking Guards in Unit Tests

```typescript
import { Test } from '@nestjs/testing';
import { JwtAuthGuard, RolesGuard } from '../auth';
import { UsersController } from './users.controller';

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    })
      // Disable guards for unit testing
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
```

### Testing with Mock User

```typescript
describe('UsersController with user context', () => {
  let controller: UsersController;
  
  const mockUser: CurrentUserPayload = {
    userId: 'test-user-id',
    email: 'test@example.com',
    role: UserRole.ADMINISTRATOR,
    status: UserStatus.ACTIVE,
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [UsersService],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context.switchToHttp().getRequest();
          request.user = mockUser;
          return true;
        },
      })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  // Tests with user context...
});
```

## Best Practices

1. **Always Apply Guards in Order**
   - JwtAuthGuard first (authentication)
   - RolesGuard second (authorization)

2. **Use @Public() Sparingly**
   - Only for truly public endpoints
   - Document why each endpoint is public

3. **Prefer Role Hierarchy**
   - Don't list all higher roles explicitly
   - `@Roles(UserRole.STAFF)` automatically allows ADMINISTRATOR and SUPER_ADMIN

4. **Extract What You Need**
   - Use `@CurrentUser('userId')` for single properties
   - Use `@CurrentUser()` when you need multiple properties

5. **Service Layer Validation**
   - Guards handle authentication and role checks
   - Services handle business logic permissions (e.g., STAFF permissions)
   - Services enforce data isolation (students see only their data)

6. **Error Messages**
   - Keep them generic for security
   - Don't expose sensitive information
   - Log detailed information server-side

## Conclusion

These guards and decorators provide a robust, type-safe foundation for authentication and authorization in the TAXBROS LMS API. The role hierarchy system reduces boilerplate while maintaining security, and the decorator API makes route protection declarative and easy to understand.
