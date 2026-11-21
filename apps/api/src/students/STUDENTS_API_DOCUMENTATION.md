# Students API Documentation

## Overview

The Students API provides comprehensive student profile management functionality for administrators and limited self-service capabilities for students. This module was implemented as part of Task 9 in the TAXBROS LMS project.

## Requirements

**Validates Requirements:**
- R1: User management (Student accounts)

**Test Coverage:**
- T1: User management (Student accounts)

## Authentication

All endpoints require JWT authentication via the `Authorization: Bearer <token>` header. Role-based access control is enforced on each endpoint.

## Endpoints

### POST /api/students

Create a new student account with User and Student profile.

**Access:** ADMINISTRATOR only

**Request Body:**
```json
{
  "email": "student@example.com",
  "password": "SecurePass123",
  "admissionId": "STU2024001",
  "firstName": "John",
  "lastName": "Doe",
  "admissionDate": "2024-01-15",
  "dateOfBirth": "2005-05-20",
  "gender": "Male",
  "phoneNumber": "1234567890",
  "address": "123 Main St",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001"
}
```

**Required Fields:**
- `email` (string): Valid email address
- `password` (string): Minimum 8 characters
- `admissionId` (string): Unique student identifier
- `firstName` (string): Student's first name
- `lastName` (string): Student's last name
- `admissionDate` (string): ISO date format (YYYY-MM-DD)

**Optional Fields:**
- `dateOfBirth` (string): ISO date format
- `gender` (string): Gender identity
- `phoneNumber` (string): Contact number
- `address` (string): Street address
- `city` (string): City name
- `state` (string): State/province
- `pincode` (string): Postal code

**Success Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "660e8400-e29b-41d4-a716-446655440000",
  "admissionId": "STU2024001",
  "firstName": "John",
  "lastName": "Doe",
  "admissionDate": "2024-01-15T00:00:00.000Z",
  "dateOfBirth": "2005-05-20T00:00:00.000Z",
  "gender": "Male",
  "phoneNumber": "1234567890",
  "address": "123 Main St",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "createdAt": "2024-11-18T10:00:00.000Z",
  "updatedAt": "2024-11-18T10:00:00.000Z",
  "user": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "email": "student@example.com",
    "role": "STUDENT",
    "status": "PENDING",
    "mustChangePassword": true,
    "lastLoginAt": null,
    "createdAt": "2024-11-18T10:00:00.000Z",
    "updatedAt": "2024-11-18T10:00:00.000Z"
  }
}
```

**Error Responses:**

400 Bad Request - Missing required fields or validation errors:
```json
{
  "statusCode": 400,
  "message": ["password must be longer than or equal to 8 characters"],
  "error": "Bad Request"
}
```

409 Conflict - Email or admissionId already in use:
```json
{
  "statusCode": 409,
  "message": "Email address is already in use",
  "error": "Conflict"
}
```

**Business Rules:**
- Email must be unique across all users (not just students)
- admissionId must be unique across all students
- Password is hashed with bcrypt (12 salt rounds)
- New accounts default to PENDING status with mustChangePassword=true
- Role is automatically set to STUDENT
- Created user is tracked via createdBy field

---

### GET /api/students

List students with filtering, searching, and pagination.

**Access:** ADMINISTRATOR only

**Query Parameters:**
- `search` (optional): Search by name, email, or admission ID (case-insensitive partial match)
- `classId` (optional): Filter by class enrollment (UUID) - *Note: Will be functional after Task 12*
- `admissionDateFrom` (optional): Filter students admitted on or after this date (ISO format)
- `admissionDateTo` (optional): Filter students admitted on or before this date (ISO format)
- `page` (optional): Page number (default: 1, minimum: 1)
- `limit` (optional): Results per page (default: 10, minimum: 1, maximum: 100)

**Example Requests:**
```
GET /api/students?search=john&page=1&limit=20
GET /api/students?classId=uuid&page=1
GET /api/students?admissionDateFrom=2024-01-01&admissionDateTo=2024-12-31
GET /api/students?search=STU2024&page=2&limit=50
```

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "660e8400-e29b-41d4-a716-446655440000",
      "admissionId": "STU2024001",
      "firstName": "John",
      "lastName": "Doe",
      "admissionDate": "2024-01-15T00:00:00.000Z",
      "dateOfBirth": "2005-05-20T00:00:00.000Z",
      "gender": "Male",
      "phoneNumber": "1234567890",
      "address": "123 Main St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "createdAt": "2024-11-18T10:00:00.000Z",
      "updatedAt": "2024-11-18T10:00:00.000Z",
      "user": {
        "id": "660e8400-e29b-41d4-a716-446655440000",
        "email": "john@example.com",
        "role": "STUDENT",
        "status": "ACTIVE",
        "mustChangePassword": false,
        "lastLoginAt": "2024-11-18T09:00:00.000Z",
        "createdAt": "2024-11-18T08:00:00.000Z",
        "updatedAt": "2024-11-18T09:00:00.000Z"
      }
    },
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "userId": "880e8400-e29b-41d4-a716-446655440000",
      "admissionId": "STU2024002",
      "firstName": "Jane",
      "lastName": "Smith",
      "admissionDate": "2024-01-16T00:00:00.000Z",
      "user": {
        "id": "880e8400-e29b-41d4-a716-446655440000",
        "email": "jane@example.com",
        "role": "STUDENT",
        "status": "ACTIVE"
      }
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

**Business Rules:**
- Search is case-insensitive and performs partial matching
- Search applies to: admissionId, firstName, lastName, email
- Results are ordered by createdAt descending (newest first)
- Maximum 100 results per page enforced
- passwordHash is never included in responses
- classId filter will be enabled once ClassEnrollment model is available (Task 12)

---

### GET /api/students/:id

Retrieve a single student by ID with full profile and enrollments.

**Access:** ADMINISTRATOR or STUDENT (students can view their own profile)

**Path Parameters:**
- `id` (required): Student UUID

**Example Requests:**
```
GET /api/students/550e8400-e29b-41d4-a716-446655440000
```

**Success Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "660e8400-e29b-41d4-a716-446655440000",
  "admissionId": "STU2024001",
  "firstName": "John",
  "lastName": "Doe",
  "admissionDate": "2024-01-15T00:00:00.000Z",
  "dateOfBirth": "2005-05-20T00:00:00.000Z",
  "gender": "Male",
  "phoneNumber": "1234567890",
  "address": "123 Main St",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "createdAt": "2024-11-18T10:00:00.000Z",
  "updatedAt": "2024-11-18T10:00:00.000Z",
  "user": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "email": "student@example.com",
    "role": "STUDENT",
    "status": "ACTIVE",
    "mustChangePassword": false,
    "lastLoginAt": "2024-11-18T09:00:00.000Z",
    "createdAt": "2024-11-18T08:00:00.000Z",
    "updatedAt": "2024-11-18T09:00:00.000Z"
  }
}
```

**Note:** Class enrollments and course enrollments will be included in the response once those models are implemented:
```json
{
  "...": "...",
  "classEnrollments": [
    {
      "id": "uuid",
      "classId": "uuid",
      "status": "ACTIVE",
      "enrolledAt": "2024-01-15T00:00:00.000Z",
      "class": {
        "id": "uuid",
        "name": "Class A"
      }
    }
  ],
  "courseEnrollments": [
    {
      "id": "uuid",
      "courseId": "uuid",
      "status": "ACTIVE",
      "progressPercentage": 45,
      "lastAccessedAt": "2024-11-18T09:00:00.000Z",
      "course": {
        "id": "uuid",
        "title": "Tax Fundamentals"
      }
    }
  ]
}
```

**Error Responses:**

404 Not Found - Student does not exist:
```json
{
  "statusCode": 404,
  "message": "Student not found",
  "error": "Not Found"
}
```

403 Forbidden - Student attempting to access another student's profile:
```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

**Business Rules:**
- Administrators can view any student profile
- Students can only view their own profile (ownership check to be added in future task)
- passwordHash is never included in response
- Related User account details are included
- Enrollments will be included once those modules are implemented

---

### PATCH /api/students/:id

Update an existing student profile.

**Access:** ADMINISTRATOR only

**Path Parameters:**
- `id` (required): Student UUID

**Request Body (all fields optional):**
```json
{
  "email": "newemail@example.com",
  "admissionId": "STU2024999",
  "firstName": "Jane",
  "lastName": "Doe-Smith",
  "admissionDate": "2024-01-20",
  "dateOfBirth": "2005-05-25",
  "gender": "Female",
  "phoneNumber": "9876543210",
  "address": "456 New St",
  "city": "Delhi",
  "state": "Delhi",
  "pincode": "110001"
}
```

**Success Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "660e8400-e29b-41d4-a716-446655440000",
  "admissionId": "STU2024999",
  "firstName": "Jane",
  "lastName": "Doe-Smith",
  "admissionDate": "2024-01-20T00:00:00.000Z",
  "dateOfBirth": "2005-05-25T00:00:00.000Z",
  "gender": "Female",
  "phoneNumber": "9876543210",
  "address": "456 New St",
  "city": "Delhi",
  "state": "Delhi",
  "pincode": "110001",
  "createdAt": "2024-11-18T10:00:00.000Z",
  "updatedAt": "2024-11-18T11:30:00.000Z",
  "user": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "email": "newemail@example.com",
    "role": "STUDENT",
    "status": "ACTIVE",
    "updatedAt": "2024-11-18T11:30:00.000Z"
  }
}
```

**Error Responses:**

404 Not Found - Student does not exist:
```json
{
  "statusCode": 404,
  "message": "Student not found",
  "error": "Not Found"
}
```

409 Conflict - New email or admissionId already in use:
```json
{
  "statusCode": 409,
  "message": "Email address is already in use",
  "error": "Conflict"
}
```

**Business Rules:**
- All fields are optional for partial updates
- Email uniqueness validated across all users (not just students)
- admissionId uniqueness validated across all students
- Only provided fields are updated (merge behavior)
- User account and Student profile updated in a transaction
- Null values accepted for optional fields (phoneNumber, address, etc.)
- updatedAt timestamp automatically updated

---

## Data Model

### Student Schema

```typescript
interface Student {
  id: string;                    // UUID primary key
  userId: string;                // Foreign key to User (unique one-to-one)
  admissionId: string;           // Unique student identifier
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  gender: string | null;
  phoneNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  admissionDate: Date;
  createdAt: DateTime;
  updatedAt: DateTime;
  
  // Relations
  user: User;
  classEnrollments: ClassEnrollment[];  // Available after Task 12
  courseEnrollments: CourseEnrollment[]; // Available after Task 30
}
```

### User Schema (related)

```typescript
interface User {
  id: string;
  email: string;                 // Unique
  passwordHash: string;          // Never returned in API responses
  role: 'STUDENT' | 'ADMINISTRATOR' | 'STAFF';
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  mustChangePassword: boolean;
  lastLoginAt: DateTime | null;
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

## Database Indexes

The following indexes are created on the Student table for optimal query performance:

- **admissionId**: Unique index for fast lookup by admission ID
- **userId**: Unique index for one-to-one User relationship
- **admissionDate**: Index for date range filtering

## Security

- **Password Hashing**: All passwords are hashed using bcrypt with 12 salt rounds
- **JWT Authentication**: All endpoints require valid JWT access token
- **Role-Based Access Control**: Endpoints enforce role requirements (ADMINISTRATOR, STUDENT)
- **Password Exclusion**: passwordHash is never included in API responses
- **Data Isolation**: Students can only access their own data (ownership checks applied)

## Error Handling

All endpoints return standardized error responses:

- **400 Bad Request**: Validation errors, missing required fields
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: Insufficient role permissions or ownership violation
- **404 Not Found**: Resource does not exist
- **409 Conflict**: Uniqueness constraint violation

## Testing

Comprehensive unit tests are provided for:
- **StudentsService**: Business logic validation
- **StudentsController**: Endpoint behavior

Run tests with:
```bash
npm test -- --testPathPattern=students
```

## Future Enhancements

The following features will be added in future tasks:

1. **Task 12**: Class enrollment filtering via `classId` query parameter
2. **Task 30**: Course enrollment tracking and display
3. **Ownership checks**: Students restricted to viewing only their own profile
4. **Integration tests**: End-to-end API testing with database

## Module Structure

```
src/students/
├── dto/
│   ├── create-student.dto.ts     # Request validation for POST
│   ├── update-student.dto.ts     # Request validation for PATCH
│   ├── filter-students.dto.ts    # Query parameter validation
│   └── index.ts                  # DTO exports
├── students.controller.ts         # Route handlers
├── students.controller.spec.ts    # Controller tests
├── students.service.ts            # Business logic
├── students.service.spec.ts       # Service tests
├── students.module.ts             # Module configuration
└── STUDENTS_API_DOCUMENTATION.md  # This file
```

## Implementation Notes

- Student creation automatically creates both User and Student records in a transaction
- The admissionId field serves as the primary business identifier for students
- Email is validated at the User level and must be unique across all user types
- Default status for new students is PENDING, requiring administrator activation
- The mustChangePassword flag forces password change on first login for security
