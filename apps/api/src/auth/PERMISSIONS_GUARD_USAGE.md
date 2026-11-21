# PermissionsGuard Usage Guide

## Overview

The PermissionsGuard enforces fine-grained access control for staff members by checking the StaffPermission table. It works with the @RequirePermission decorator to specify permission requirements on routes.

## Permission Enforcement Logic

1. **ADMINISTRATOR role** → Automatically granted access (bypass permission check)
2. **STAFF role** → Query StaffPermission table for required permission
3. **STUDENT role** → Denied access (students don't have permissions)
4. **Missing permission** → Return HTTP 403 Forbidden

## Guard Chain Order

The PermissionsGuard should be applied after JwtAuthGuard and RolesGuard:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
```

Or apply globally in main.ts (recommended):

```typescript
// main.ts
const reflector = app.get(Reflector);
app.useGlobalGuards(
  new JwtAuthGuard(reflector),
  new RolesGuard(reflector),
  new PermissionsGuard(reflector, prismaService),
);
```

## Basic Usage

### Mark Attendance Endpoint

```typescript
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, PermissionsGuard } from '../auth/guards';
import { Roles, RequirePermission } from '../auth/decorators';
import { UserRole, StaffPermissionType } from '@prisma/client';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AttendanceController {
  @Post('mark')
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @RequirePermission(StaffPermissionType.MARK_ATTENDANCE)
  async markAttendance(@Body() dto: MarkAttendanceDto) {
    // Only accessible by:
    // - ADMINISTRATOR (automatic bypass)
    // - STAFF with MARK_ATTENDANCE permission
    return this.attendanceService.markAttendance(dto);
  }
}
```

### View Reports Endpoint

```typescript
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ReportsController {
  @Get('monthly')
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @RequirePermission(StaffPermissionType.VIEW_REPORTS)
  async getMonthlyReport(@Query() query: MonthlyReportDto) {
    // Only accessible by:
    // - ADMINISTRATOR (automatic bypass)
    // - STAFF with VIEW_REPORTS permission
    return this.reportsService.getMonthlyReport(query);
  }
}
```

### Manage Courses Endpoint

```typescript
@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CoursesController {
  @Post()
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  async createCourse(@Body() dto: CreateCourseDto) {
    // Only accessible by:
    // - ADMINISTRATOR (automatic bypass)
    // - STAFF with MANAGE_COURSES permission
    return this.coursesService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  async updateCourse(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.coursesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @RequirePermission(StaffPermissionType.MANAGE_COURSES)
  async deleteCourse(@Param('id') id: string) {
    return this.coursesService.delete(id);
  }
}
```

## Available Permission Types

From `@prisma/client`:

- `MARK_ATTENDANCE` - Can mark student/staff attendance
- `VIEW_REPORTS` - Can view attendance and progress reports
- `MANAGE_COURSES` - Can create/edit/delete courses
- `MANAGE_LABS` - Can manage lab exercises
- `MANAGE_STUDENTS` - Can create/edit students
- `MANAGE_STAFF` - Can create/edit staff
- `MANAGE_CLASSES` - Can manage classes

## Controller-Level Permission

You can apply permissions at the controller level:

```typescript
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
@RequirePermission(StaffPermissionType.MANAGE_STUDENTS)
export class UserManagementController {
  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    // Permission check applies to all routes in this controller
    return this.usersService.create(dto);
  }

  @Get()
  async listUsers() {
    // Permission check applies here too
    return this.usersService.findAll();
  }
}
```

## Mixing Permissions

For different permissions on different routes:

```typescript
@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class StaffController {
  // View operations - VIEW_REPORTS permission
  @Get('list')
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @RequirePermission(StaffPermissionType.VIEW_REPORTS)
  async listStaff() {
    return this.staffService.findAll();
  }

  // Management operations - MANAGE_STUDENTS permission
  @Post()
  @Roles(UserRole.STAFF, UserRole.ADMINISTRATOR)
  @RequirePermission(StaffPermissionType.MANAGE_STUDENTS)
  async createStaff(@Body() dto: CreateStaffDto) {
    return this.staffService.create(dto);
  }
}
```

## Error Responses

### Missing Permission (Staff without permission)

```json
HTTP 403 Forbidden
{
  "statusCode": 403,
  "message": "Access denied. Required permission: MARK_ATTENDANCE"
}
```

### Student Attempting Access

```json
HTTP 403 Forbidden
{
  "statusCode": 403,
  "message": "Students do not have permission to access this resource"
}
```

### Missing Staff Profile

```json
HTTP 403 Forbidden
{
  "statusCode": 403,
  "message": "Staff profile information is missing"
}
```

## Testing Permission Checks

### Unit Test Example

```typescript
describe('AttendanceController', () => {
  it('should allow ADMINISTRATOR to mark attendance', async () => {
    const user = {
      userId: 'admin-1',
      email: 'admin@test.com',
      role: UserRole.ADMINISTRATOR,
    };

    const result = await controller.markAttendance(dto);
    expect(result).toBeDefined();
  });

  it('should allow STAFF with MARK_ATTENDANCE permission', async () => {
    const user = {
      userId: 'user-1',
      email: 'staff@test.com',
      role: UserRole.STAFF,
      staffId: 'staff-1',
    };

    // Mock permission exists
    jest.spyOn(prisma.staffPermission, 'findUnique').mockResolvedValue({
      id: 'perm-1',
      staffId: 'staff-1',
      permission: StaffPermissionType.MARK_ATTENDANCE,
      grantedBy: 'admin-1',
      grantedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await controller.markAttendance(dto);
    expect(result).toBeDefined();
  });

  it('should deny STAFF without MARK_ATTENDANCE permission', async () => {
    const user = {
      userId: 'user-1',
      email: 'staff@test.com',
      role: UserRole.STAFF,
      staffId: 'staff-1',
    };

    // Mock permission doesn't exist
    jest.spyOn(prisma.staffPermission, 'findUnique').mockResolvedValue(null);

    await expect(controller.markAttendance(dto)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
```

## Integration with JWT Payload

The PermissionsGuard uses the `CurrentUserPayload` interface populated by JwtAuthGuard:

```typescript
export interface CurrentUserPayload {
  userId: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  studentId?: string;  // Present if user is a student
  staffId?: string;    // Present if user is a staff member
}
```

The `staffId` field is crucial for querying the StaffPermission table.

## Granting Permissions

Permissions are managed through the Staff module:

```typescript
// Grant permission to a staff member
await prisma.staffPermission.create({
  data: {
    staffId: 'staff-1',
    permission: StaffPermissionType.MARK_ATTENDANCE,
    grantedBy: currentUserId,
  },
});

// Revoke permission
await prisma.staffPermission.delete({
  where: {
    staffId_permission: {
      staffId: 'staff-1',
      permission: StaffPermissionType.MARK_ATTENDANCE,
    },
  },
});
```

## Best Practices

1. **Always use @Roles() with @RequirePermission()**
   - @Roles() ensures basic role check
   - @RequirePermission() adds fine-grained control

2. **Apply guards in correct order**
   - JwtAuthGuard (authentication)
   - RolesGuard (role check)
   - PermissionsGuard (permission check)

3. **Use global guards when possible**
   - Reduces boilerplate in controllers
   - Ensures consistent security

4. **Administrator bypass is automatic**
   - No need to check for admin role in service layer
   - Focus on business logic

5. **Test permission checks thoroughly**
   - Test with admin (should bypass)
   - Test with staff having permission (should allow)
   - Test with staff lacking permission (should deny)
   - Test with student (should deny)

## Implementation Details

### Database Query

The guard uses Prisma's compound unique constraint to efficiently check permissions:

```typescript
const staffPermission = await this.prisma.staffPermission.findUnique({
  where: {
    staffId_permission: {
      staffId: user.staffId,
      permission: requiredPermission,
    },
  },
});
```

This query is fast because it uses the unique index on `(staffId, permission)`.

### Caching Considerations

For high-traffic applications, consider implementing permission caching:

```typescript
// Example with Redis cache
const cacheKey = `permission:${staffId}:${permission}`;
const cached = await redis.get(cacheKey);

if (cached !== null) {
  return cached === '1';
}

const hasPermission = await checkStaffPermission(staffId, permission);
await redis.setex(cacheKey, 300, hasPermission ? '1' : '0'); // 5-minute TTL

return hasPermission;
```

## Related Files

- `src/auth/guards/permissions.guard.ts` - Guard implementation
- `src/auth/decorators/require-permission.decorator.ts` - Decorator
- `src/auth/guards/permissions.guard.spec.ts` - Unit tests
- `prisma/schema.prisma` - StaffPermission model definition
