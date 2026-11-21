# Staff Management API Documentation

## Overview

The Staff Management API provides endpoints for managing staff profiles and their permissions within the TAXBROS LMS. All endpoints require authentication and ADMINISTRATOR role access.

## Base URL

```
/staff
```

## Authentication

All endpoints require:
- JWT Bearer token in Authorization header
- ADMINISTRATOR role

## Endpoints

### 1. Create Staff Profile

**POST** `/staff`

Creates a new staff profile associated with a user account.

**Request Body:**
```json
{
  "userId": "uuid",
  "staffId": "string (unique)",
  "firstName": "string",
  "lastName": "string",
  "designation": "string",
  "department": "string",
  "category": "TEACHING | NON_TEACHING",
  "joiningDate": "YYYY-MM-DD",
  "phoneNumber": "string (optional)",
  "address": "string (optional)"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "staffId": "string",
  "firstName": "string",
  "lastName": "string",
  "designation": "string",
  "department": "string",
  "category": "TEACHING | NON_TEACHING",
  "joiningDate": "timestamp",
  "phoneNumber": "string",
  "address": "string",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "user": {
    "id": "uuid",
    "email": "string",
    "role": "STAFF",
    "status": "ACTIVE"
  }
}
```

**Error Responses:**
- `409 Conflict` - Staff ID already exists or user already has a staff profile
- `400 Bad Request` - Invalid input data

**Validation Rules:**
- staffId must be unique across all staff members
- userId must be unique (one staff profile per user)
- All required fields must be provided

---

### 2. List Staff

**GET** `/staff`

Retrieves a paginated list of staff members with filtering options.

**Query Parameters:**
- `department` (optional) - Filter by department name
- `category` (optional) - Filter by staff category (TEACHING | NON_TEACHING)
- `search` (optional) - Search in firstName, lastName, staffId, designation
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 10) - Items per page

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "staffId": "string",
      "firstName": "string",
      "lastName": "string",
      "designation": "string",
      "department": "string",
      "category": "TEACHING | NON_TEACHING",
      "joiningDate": "timestamp",
      "phoneNumber": "string",
      "address": "string",
      "createdAt": "timestamp",
      "updatedAt": "timestamp",
      "user": {
        "id": "uuid",
        "email": "string",
        "role": "STAFF",
        "status": "ACTIVE"
      },
      "permissions": [
        {
          "id": "uuid",
          "staffId": "uuid",
          "permission": "MARK_ATTENDANCE",
          "grantedBy": "uuid",
          "grantedAt": "timestamp"
        }
      ]
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

**Examples:**
```
GET /staff?department=Computer Science&category=TEACHING&page=1&limit=20
GET /staff?search=john&page=1
```

---

### 3. Get Staff by ID

**GET** `/staff/:id`

Retrieves detailed information about a specific staff member.

**Path Parameters:**
- `id` (required) - Staff UUID

**Response (200):**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "staffId": "string",
  "firstName": "string",
  "lastName": "string",
  "designation": "string",
  "department": "string",
  "category": "TEACHING | NON_TEACHING",
  "joiningDate": "timestamp",
  "phoneNumber": "string",
  "address": "string",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "user": {
    "id": "uuid",
    "email": "string",
    "role": "STAFF",
    "status": "ACTIVE"
  },
  "permissions": [
    {
      "id": "uuid",
      "staffId": "uuid",
      "permission": "MARK_ATTENDANCE",
      "grantedBy": "uuid",
      "grantedAt": "timestamp"
    }
  ]
}
```

**Error Responses:**
- `404 Not Found` - Staff member not found

---

### 4. Update Staff Profile

**PATCH** `/staff/:id`

Updates an existing staff profile.

**Path Parameters:**
- `id` (required) - Staff UUID

**Request Body (all fields optional):**
```json
{
  "staffId": "string",
  "firstName": "string",
  "lastName": "string",
  "designation": "string",
  "department": "string",
  "category": "TEACHING | NON_TEACHING",
  "joiningDate": "YYYY-MM-DD",
  "phoneNumber": "string",
  "address": "string"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "staffId": "string",
  "firstName": "string",
  "lastName": "string",
  "designation": "string",
  "department": "string",
  "category": "TEACHING | NON_TEACHING",
  "joiningDate": "timestamp",
  "phoneNumber": "string",
  "address": "string",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "user": {
    "id": "uuid",
    "email": "string",
    "role": "STAFF",
    "status": "ACTIVE"
  },
  "permissions": []
}
```

**Error Responses:**
- `404 Not Found` - Staff member not found
- `409 Conflict` - staffId already exists (when updating staffId)
- `400 Bad Request` - Invalid input data

---

### 5. Delete Staff Profile

**DELETE** `/staff/:id`

Deletes a staff profile. This will cascade delete all associated permissions.

**Path Parameters:**
- `id` (required) - Staff UUID

**Response (200):**
```json
{
  "message": "Staff profile deleted successfully"
}
```

**Error Responses:**
- `404 Not Found` - Staff member not found

---

### 6. Grant Permission

**POST** `/staff/:id/permissions`

Grants a specific permission to a staff member.

**Path Parameters:**
- `id` (required) - Staff UUID

**Request Body:**
```json
{
  "permission": "MARK_ATTENDANCE | VIEW_REPORTS | MANAGE_COURSES | MANAGE_STUDENTS | MANAGE_STAFF | MANAGE_CLASSES | MANAGE_LABS"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "staffId": "uuid",
  "permission": "MARK_ATTENDANCE",
  "grantedBy": "uuid",
  "grantedAt": "timestamp",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

**Error Responses:**
- `404 Not Found` - Staff member not found
- `409 Conflict` - Permission already granted to this staff member
- `400 Bad Request` - Invalid permission type

**Available Permissions:**
- `MARK_ATTENDANCE` - Can mark student and staff attendance
- `VIEW_REPORTS` - Can view attendance and progress reports
- `MANAGE_COURSES` - Can create and manage courses
- `MANAGE_LABS` - Can manage lab simulations
- `MANAGE_STUDENTS` - Can manage student accounts
- `MANAGE_STAFF` - Can manage staff accounts
- `MANAGE_CLASSES` - Can manage classes

---

### 7. Revoke Permission

**DELETE** `/staff/:id/permissions/:permissionId`

Revokes a specific permission from a staff member.

**Path Parameters:**
- `id` (required) - Staff UUID
- `permissionId` (required) - Permission UUID

**Response (200):**
```json
{
  "message": "Permission revoked successfully"
}
```

**Error Responses:**
- `404 Not Found` - Permission not found
- `400 Bad Request` - Permission does not belong to this staff member

---

### 8. List Staff Permissions

**GET** `/staff/:id/permissions`

Retrieves all permissions granted to a specific staff member.

**Path Parameters:**
- `id` (required) - Staff UUID

**Response (200):**
```json
[
  {
    "id": "uuid",
    "staffId": "uuid",
    "permission": "MARK_ATTENDANCE",
    "grantedBy": "uuid",
    "grantedAt": "timestamp",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  },
  {
    "id": "uuid",
    "staffId": "uuid",
    "permission": "VIEW_REPORTS",
    "grantedBy": "uuid",
    "grantedAt": "timestamp",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
]
```

**Error Responses:**
- `404 Not Found` - Staff member not found

---

## Business Rules

### Staff Profile Management

1. **Unique Constraints:**
   - Each staffId must be unique across all staff members
   - Each userId can have only one staff profile
   - Each (staffId, permission) combination is unique (prevents duplicate permissions)

2. **Cascade Deletion:**
   - Deleting a staff profile automatically removes all associated permissions
   - Deleting a user account cascades to their staff profile

3. **Category Types:**
   - `TEACHING` - Academic staff (professors, lecturers, instructors)
   - `NON_TEACHING` - Administrative and support staff

### Permission System

1. **Permission Types:**
   - Granular permissions allow fine-grained access control
   - ADMINISTRATOR role has all permissions by default (no explicit grants needed)
   - Staff members require explicit permission grants

2. **Permission Enforcement:**
   - Permissions are checked at runtime before executing protected operations
   - Revoking a permission takes effect immediately
   - Permission checks happen in service layer and guards

3. **Audit Trail:**
   - All permission grants record who granted them and when
   - grantedBy field tracks the administrator who granted the permission

## Data Models

### Staff Model
```typescript
interface Staff {
  id: string;                    // UUID primary key
  userId: string;                // Foreign key to User (unique)
  staffId: string;               // Unique staff identifier
  firstName: string;
  lastName: string;
  designation: string;           // Job title (e.g., "Professor", "Lecturer")
  department: string;            // Department name
  category: StaffCategory;       // TEACHING or NON_TEACHING
  joiningDate: Date;
  phoneNumber: string | null;
  address: string | null;
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

### StaffPermission Model
```typescript
interface StaffPermission {
  id: string;                         // UUID primary key
  staffId: string;                    // Foreign key to Staff
  permission: StaffPermissionType;    // Enum value
  grantedBy: string;                  // User ID of granter
  grantedAt: DateTime;
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

## Integration with Other Modules

### Users Module
- Staff profiles are linked to User accounts via userId
- User management endpoints handle user creation/activation
- Staff module focuses on profile and permission management

### Attendance Module
- MARK_ATTENDANCE permission required for attendance operations
- Staff can mark both student and staff attendance when permitted

### Reports Module
- VIEW_REPORTS permission required for accessing reports
- Administrators have unrestricted report access

### Courses Module
- MANAGE_COURSES permission required for course CRUD operations
- Instructors need this permission to create/edit courses

## Error Handling

All endpoints follow standard HTTP status codes:

- `200 OK` - Successful GET, PATCH, DELETE
- `201 Created` - Successful POST
- `400 Bad Request` - Invalid input data, validation errors
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - Insufficient permissions (requires ADMINISTRATOR)
- `404 Not Found` - Resource not found
- `409 Conflict` - Uniqueness constraint violation

Error response format:
```json
{
  "statusCode": 409,
  "message": "Staff ID already exists",
  "error": "Conflict"
}
```

## Testing

Comprehensive unit tests are provided for:
- Staff service layer (staff.service.spec.ts)
- Staff controller layer (staff.controller.spec.ts)

Test coverage includes:
- CRUD operations
- Validation and error handling
- Permission management
- Uniqueness constraints
- Pagination and filtering

## Notes

1. **Administrator Permissions:**
   - ADMINISTRATOR role has implicit access to all operations
   - No explicit permission grants needed for administrators
   - Administrators can grant/revoke permissions for staff members

2. **Database Migration:**
   - Migration file: `20261118153447_add_staff_permissions/migration.sql`
   - Run `npx prisma migrate deploy` to apply migration
   - Run `npx prisma generate` to update Prisma client

3. **Security:**
   - All endpoints require JWT authentication
   - Role-based access control enforced via guards
   - Permissions checked at service layer
   - Audit trail maintained for permission grants
