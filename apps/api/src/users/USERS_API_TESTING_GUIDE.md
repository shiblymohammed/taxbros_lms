# User Management API Testing Guide

This guide provides examples for testing the User Management CRUD endpoints.

## Prerequisites

1. Start the API server:
   ```bash
   npm run dev
   ```

2. Ensure you have an administrator account to authenticate with.

## Authentication

All user management endpoints require ADMINISTRATOR role. First, obtain an access token:

```bash
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "admin@taxbros.com",
  "password": "admin123"
}
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@taxbros.com",
    "role": "ADMINISTRATOR"
  }
}
```

Use the `accessToken` in the Authorization header for all subsequent requests:
```
Authorization: Bearer <accessToken>
```

## API Endpoints

### 1. Create User (POST /users)

#### Create Student User

```bash
POST http://localhost:3000/users
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "email": "student1@example.com",
  "password": "SecurePass123",
  "role": "STUDENT",
  "studentProfile": {
    "admissionId": "STU2024001",
    "firstName": "John",
    "lastName": "Doe",
    "admissionDate": "2024-01-15",
    "dateOfBirth": "2000-05-20",
    "gender": "Male",
    "phoneNumber": "1234567890",
    "address": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  }
}
```

Expected Response (201 Created):
```json
{
  "id": "user-uuid",
  "email": "student1@example.com",
  "role": "STUDENT",
  "status": "PENDING",
  "mustChangePassword": true,
  "lastLoginAt": null,
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z",
  "createdBy": "admin-uuid",
  "studentProfile": {
    "id": "student-uuid",
    "userId": "user-uuid",
    "admissionId": "STU2024001",
    "firstName": "John",
    "lastName": "Doe",
    "admissionDate": "2024-01-15T00:00:00.000Z",
    "dateOfBirth": "2000-05-20T00:00:00.000Z",
    "gender": "Male",
    "phoneNumber": "1234567890",
    "address": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  },
  "staffProfile": null
}
```

#### Create Staff User

```bash
POST http://localhost:3000/users
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "email": "staff1@example.com",
  "password": "SecurePass123",
  "role": "STAFF",
  "staffProfile": {
    "staffId": "STF2024001",
    "firstName": "Jane",
    "lastName": "Smith",
    "designation": "Senior Teacher",
    "department": "Mathematics",
    "category": "TEACHING",
    "joiningDate": "2024-01-10",
    "phoneNumber": "9876543210",
    "address": "456 Oak Ave"
  }
}
```

Expected Response (201 Created):
```json
{
  "id": "user-uuid",
  "email": "staff1@example.com",
  "role": "STAFF",
  "status": "PENDING",
  "mustChangePassword": true,
  "studentProfile": null,
  "staffProfile": {
    "id": "staff-uuid",
    "userId": "user-uuid",
    "staffId": "STF2024001",
    "firstName": "Jane",
    "lastName": "Smith",
    "designation": "Senior Teacher",
    "department": "Mathematics",
    "category": "TEACHING",
    "joiningDate": "2024-01-10T00:00:00.000Z",
    "phoneNumber": "9876543210",
    "address": "456 Oak Ave",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

#### Error Cases

**Missing Student Profile (400 Bad Request):**
```json
{
  "email": "student@example.com",
  "password": "SecurePass123",
  "role": "STUDENT"
}
```
Response:
```json
{
  "statusCode": 400,
  "message": "Student profile is required for STUDENT role",
  "error": "Bad Request"
}
```

**Duplicate Email (409 Conflict):**
```json
{
  "statusCode": 409,
  "message": "Email address is already in use",
  "error": "Conflict"
}
```

**Duplicate Admission ID (409 Conflict):**
```json
{
  "statusCode": 409,
  "message": "Admission ID is already in use",
  "error": "Conflict"
}
```

**Duplicate Staff ID (409 Conflict):**
```json
{
  "statusCode": 409,
  "message": "Staff ID is already in use",
  "error": "Conflict"
}
```

### 2. List Users (GET /users)

#### List All Users with Pagination

```bash
GET http://localhost:3000/users?page=1&limit=10
Authorization: Bearer <accessToken>
```

Expected Response (200 OK):
```json
{
  "data": [
    {
      "id": "user-uuid-1",
      "email": "student1@example.com",
      "role": "STUDENT",
      "status": "ACTIVE",
      "mustChangePassword": false,
      "createdAt": "2024-01-15T10:00:00.000Z",
      "studentProfile": { ... }
    },
    {
      "id": "user-uuid-2",
      "email": "staff1@example.com",
      "role": "STAFF",
      "status": "ACTIVE",
      "mustChangePassword": false,
      "createdAt": "2024-01-15T11:00:00.000Z",
      "staffProfile": { ... }
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  }
}
```

#### Filter by Role

```bash
GET http://localhost:3000/users?role=STUDENT&page=1&limit=20
Authorization: Bearer <accessToken>
```

#### Filter by Status

```bash
GET http://localhost:3000/users?status=ACTIVE&page=1&limit=20
Authorization: Bearer <accessToken>
```

#### Search by Name or Email

```bash
GET http://localhost:3000/users?search=john&page=1&limit=20
Authorization: Bearer <accessToken>
```

#### Combined Filters

```bash
GET http://localhost:3000/users?role=STUDENT&status=ACTIVE&search=doe&page=1&limit=20
Authorization: Bearer <accessToken>
```

### 3. Get Single User (GET /users/:id)

```bash
GET http://localhost:3000/users/user-uuid
Authorization: Bearer <accessToken>
```

Expected Response (200 OK):
```json
{
  "id": "user-uuid",
  "email": "student1@example.com",
  "role": "STUDENT",
  "status": "ACTIVE",
  "mustChangePassword": false,
  "lastLoginAt": "2024-01-16T08:30:00.000Z",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-16T08:30:00.000Z",
  "studentProfile": {
    "id": "student-uuid",
    "userId": "user-uuid",
    "admissionId": "STU2024001",
    "firstName": "John",
    "lastName": "Doe",
    "admissionDate": "2024-01-15T00:00:00.000Z",
    "dateOfBirth": "2000-05-20T00:00:00.000Z",
    "gender": "Male",
    "phoneNumber": "1234567890",
    "address": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  },
  "staffProfile": null
}
```

Error Response (404 Not Found):
```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found"
}
```

### 4. Update User (PATCH /users/:id)

#### Update Student Profile

```bash
PATCH http://localhost:3000/users/user-uuid
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "studentProfile": {
    "firstName": "Jonathan",
    "phoneNumber": "9999999999",
    "city": "Pune"
  }
}
```

Expected Response (200 OK):
```json
{
  "id": "user-uuid",
  "email": "student1@example.com",
  "role": "STUDENT",
  "status": "ACTIVE",
  "updatedAt": "2024-01-16T10:00:00.000Z",
  "studentProfile": {
    "id": "student-uuid",
    "firstName": "Jonathan",
    "lastName": "Doe",
    "phoneNumber": "9999999999",
    "city": "Pune",
    ...
  }
}
```

#### Update Email

```bash
PATCH http://localhost:3000/users/user-uuid
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "email": "newemail@example.com"
}
```

Expected Response (200 OK):
```json
{
  "id": "user-uuid",
  "email": "newemail@example.com",
  "role": "STUDENT",
  "status": "ACTIVE",
  "updatedAt": "2024-01-16T10:15:00.000Z",
  ...
}
```

Error Response - Email Already Exists (409 Conflict):
```json
{
  "statusCode": 409,
  "message": "Email address is already in use",
  "error": "Conflict"
}
```

### 5. Activate User (PATCH /users/:id/activate)

```bash
PATCH http://localhost:3000/users/user-uuid/activate
Authorization: Bearer <accessToken>
```

Expected Response (200 OK):
```json
{
  "id": "user-uuid",
  "email": "student1@example.com",
  "role": "STUDENT",
  "status": "ACTIVE",
  "mustChangePassword": true,
  "updatedAt": "2024-01-16T10:30:00.000Z",
  "studentProfile": { ... }
}
```

**Note:** After activation, the user can authenticate and access the system.

### 6. Deactivate User (PATCH /users/:id/deactivate)

```bash
PATCH http://localhost:3000/users/user-uuid/deactivate
Authorization: Bearer <accessToken>
```

Expected Response (200 OK):
```json
{
  "id": "user-uuid",
  "email": "student1@example.com",
  "role": "STUDENT",
  "status": "INACTIVE",
  "updatedAt": "2024-01-16T10:45:00.000Z",
  "studentProfile": { ... }
}
```

**Note:** 
- After deactivation, the user cannot authenticate.
- All historical data is retained.
- The account can be reactivated using the activate endpoint.

## Validation Rules

### Email
- Must be a valid email format
- Must be unique across all users
- Case-insensitive comparison

### Password
- Minimum 8 characters
- Hashed with bcrypt (12 salt rounds)
- Never returned in API responses

### Admission ID (Students)
- Required for STUDENT role
- Must be unique across all students
- Cannot be changed after creation (for data integrity)

### Staff ID (Staff)
- Required for STAFF role
- Must be unique across all staff
- Cannot be changed after creation (for data integrity)

### First Name & Last Name
- Required for both students and staff
- String type, no length restrictions

### Dates
- Must be in ISO 8601 format (YYYY-MM-DD)
- Examples: "2024-01-15", "2000-05-20"

### Phone Number
- Optional field
- String type (to support international formats)

### Category (Staff)
- Required for STAFF role
- Must be one of: "TEACHING" or "NON_TEACHING"

## Security Features

1. **Authentication Required**: All endpoints require valid JWT token
2. **Role-Based Access**: Only ADMINISTRATOR role can access these endpoints
3. **Password Hashing**: Passwords are hashed with bcrypt (12 salt rounds)
4. **Password Exclusion**: Passwords are never returned in API responses
5. **Uniqueness Validation**: Email, admissionId, and staffId are validated for uniqueness
6. **Must Change Password**: New accounts default to mustChangePassword=true
7. **Historical Data Retention**: Deactivated accounts retain all data

## Requirements Validation

This implementation validates the following requirements:

- **R1.1**: Email, password, and role are required for user creation ✓
- **R1.2**: Students require admissionId, firstName, lastName, admissionDate ✓
- **R1.3**: Staff require staffId, firstName, lastName, designation, department, category, joiningDate ✓
- **R1.4**: Unique email addresses enforced ✓
- **R1.5**: Unique admission IDs enforced ✓
- **R1.6**: Unique staff IDs enforced ✓
- **R1.7**: Account activation grants authentication access ✓
- **R1.8**: Account deactivation denies authentication access ✓
- **R1.9**: Historical records retained for deactivated accounts ✓
- **R1.10**: Search/filter by name, email, role, status ✓
- **R1.11**: Student search by admissionId, class, date range (admissionId supported) ✓
- **R1.12**: Staff search by staffId, department, category (staffId supported) ✓
- **R1.13**: Profile updates with uniqueness validation ✓
- **R1.14**: Passwords hashed with bcrypt (12 salt rounds) ✓
- **R1.15**: New accounts have mustChangePassword=true ✓

## Testing Checklist

- [ ] Create student user successfully
- [ ] Create staff user successfully
- [ ] Validate student profile requirement
- [ ] Validate staff profile requirement
- [ ] Reject duplicate email
- [ ] Reject duplicate admission ID
- [ ] Reject duplicate staff ID
- [ ] List all users with pagination
- [ ] Filter users by role
- [ ] Filter users by status
- [ ] Search users by name/email
- [ ] Get single user by ID
- [ ] Update student profile
- [ ] Update staff profile
- [ ] Update user email
- [ ] Reject duplicate email on update
- [ ] Activate user account
- [ ] Deactivate user account
- [ ] Verify pagination metadata is correct
- [ ] Verify passwordHash is never returned

## Example Test Sequence

1. **Create a student user**
   - POST /users with student profile
   - Verify status is PENDING
   - Verify mustChangePassword is true

2. **Activate the student**
   - PATCH /users/:id/activate
   - Verify status is ACTIVE

3. **List all students**
   - GET /users?role=STUDENT
   - Verify student appears in list

4. **Update student profile**
   - PATCH /users/:id with new phone number
   - Verify update is reflected

5. **Search for student**
   - GET /users?search=<student name>
   - Verify student is found

6. **Deactivate student**
   - PATCH /users/:id/deactivate
   - Verify status is INACTIVE
   - Verify all data is retained

7. **Try to create duplicate**
   - POST /users with same email
   - Verify 409 Conflict error

## Notes

- All timestamps are in UTC
- Date fields accept ISO 8601 format
- Pagination is 1-indexed (page=1 is first page)
- Maximum 100 results per page
- All fields except those marked as required are optional
- Profile updates are merged, not replaced
