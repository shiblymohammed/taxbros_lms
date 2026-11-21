# Class Management Module - Testing Guide

This guide provides comprehensive instructions for testing the Class Management Module, which implements **Requirement R4: Class Management**.

## Overview

The Classes module provides endpoints for:
- Creating classes with unique name validation
- Listing classes with status filtering (ACTIVE, ARCHIVED)
- Getting class details with active enrollments
- Updating class information
- Enrolling students in classes
- Unenrolling students (soft delete with INACTIVE status)

## Prerequisites

1. **Database Setup**: Ensure PostgreSQL is running and migrations are applied
2. **Test Data**: Create at least one student account for enrollment testing
3. **Authentication**: Obtain a valid JWT token with ADMINISTRATOR role

## API Endpoints

### 1. Create Class

**Endpoint**: `POST /classes`

**Access**: ADMINISTRATOR or SUPER_ADMIN only

**Request Body**:
```json
{
  "name": "Batch 2024 Morning",
  "description": "Morning batch for 2024 intake"
}
```

**Expected Response** (201 Created):
```json
{
  "id": "uuid-here",
  "name": "Batch 2024 Morning",
  "description": "Morning batch for 2024 intake",
  "status": "ACTIVE",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

**Test Cases**:
- ✅ **T4.1**: Create class with unique name → Returns 201 with ACTIVE status
- ❌ **T4.2**: Create class with duplicate name → Returns 409 Conflict
- ❌ **T4.3**: Create class without name → Returns 400 Bad Request
- ❌ **T4.4**: Create class as STAFF user → Returns 403 Forbidden
- ✅ **T4.5**: Create class with description omitted → Returns 201 with null description

**Validates**:
- R4.1: Require unique class name
- R4.2: Status defaults to ACTIVE

---

### 2. List All Classes

**Endpoint**: `GET /classes`

**Access**: ADMINISTRATOR, SUPER_ADMIN, or STAFF

**Query Parameters**:
- `status` (optional): ACTIVE or ARCHIVED
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 10): Items per page

**Example Requests**:
```
GET /classes
GET /classes?status=ACTIVE
GET /classes?status=ARCHIVED&page=1&limit=20
```

**Expected Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid-here",
      "name": "Batch 2024 Morning",
      "description": "Morning batch",
      "status": "ACTIVE",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z",
      "_count": {
        "enrollments": 5
      }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

**Test Cases**:
- ✅ **T4.6**: List all classes without filter → Returns all classes with enrollment counts
- ✅ **T4.7**: List classes with status=ACTIVE → Returns only ACTIVE classes
- ✅ **T4.8**: List classes with status=ARCHIVED → Returns only ARCHIVED classes
- ✅ **T4.9**: List classes with pagination → Returns correct page with meta
- ✅ **T4.10**: Enrollment count only includes ACTIVE enrollments

**Validates**:
- R4: Support status filtering

---

### 3. Get Single Class

**Endpoint**: `GET /classes/:id`

**Access**: ADMINISTRATOR, SUPER_ADMIN, or STAFF

**Expected Response** (200 OK):
```json
{
  "id": "uuid-here",
  "name": "Batch 2024 Morning",
  "description": "Morning batch",
  "status": "ACTIVE",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z",
  "enrollments": [
    {
      "id": "enrollment-uuid",
      "studentId": "student-uuid",
      "classId": "class-uuid",
      "status": "ACTIVE",
      "enrolledAt": "2024-01-15T10:00:00.000Z",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z",
      "student": {
        "id": "student-uuid",
        "userId": "user-uuid",
        "admissionId": "STU001",
        "firstName": "John",
        "lastName": "Doe",
        "admissionDate": "2024-01-10T00:00:00.000Z",
        "user": {
          "email": "john@example.com",
          "status": "ACTIVE"
        }
      }
    }
  ]
}
```

**Test Cases**:
- ✅ **T4.11**: Get class with valid ID → Returns class with active enrollments
- ❌ **T4.12**: Get class with non-existent ID → Returns 404 Not Found
- ✅ **T4.13**: Only ACTIVE enrollments are returned
- ✅ **T4.14**: INACTIVE enrollments are excluded from response

**Validates**:
- R4.7: Return only ACTIVE enrollments

---

### 4. Update Class

**Endpoint**: `PATCH /classes/:id`

**Access**: ADMINISTRATOR or SUPER_ADMIN only

**Request Body** (all fields optional):
```json
{
  "name": "Batch 2024 Morning - Updated",
  "description": "Updated description",
  "status": "ARCHIVED"
}
```

**Expected Response** (200 OK):
```json
{
  "id": "uuid-here",
  "name": "Batch 2024 Morning - Updated",
  "description": "Updated description",
  "status": "ARCHIVED",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T15:30:00.000Z"
}
```

**Test Cases**:
- ✅ **T4.15**: Update class name → Returns updated class
- ✅ **T4.16**: Update class description → Returns updated class
- ✅ **T4.17**: Archive class (status=ARCHIVED) → Returns class with ARCHIVED status
- ❌ **T4.18**: Update with duplicate name → Returns 409 Conflict
- ❌ **T4.19**: Update non-existent class → Returns 404 Not Found
- ❌ **T4.20**: Update as STAFF user → Returns 403 Forbidden

**Validates**:
- R4: Support updating name, description, and status
- R4.8: Support archiving classes

---

### 5. Enroll Student in Class

**Endpoint**: `POST /classes/:id/students`

**Access**: ADMINISTRATOR or SUPER_ADMIN only

**Request Body**:
```json
{
  "studentId": "student-uuid-here"
}
```

**Expected Response** (201 Created):
```json
{
  "id": "enrollment-uuid",
  "studentId": "student-uuid",
  "classId": "class-uuid",
  "status": "ACTIVE",
  "enrolledAt": "2024-01-15T10:00:00.000Z",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z",
  "student": {
    "id": "student-uuid",
    "userId": "user-uuid",
    "admissionId": "STU001",
    "firstName": "John",
    "lastName": "Doe",
    "user": {
      "email": "john@example.com",
      "status": "ACTIVE"
    }
  },
  "class": {
    "id": "class-uuid",
    "name": "Batch 2024 Morning",
    "description": "Morning batch",
    "status": "ACTIVE",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Test Cases**:
- ✅ **T4.21**: Enroll student in class → Returns 201 with ACTIVE enrollment
- ❌ **T4.22**: Enroll student already enrolled → Returns 409 Conflict
- ❌ **T4.23**: Enroll non-existent student → Returns 404 Not Found
- ❌ **T4.24**: Enroll in non-existent class → Returns 404 Not Found
- ✅ **T4.25**: Re-enroll previously INACTIVE student → Returns 201, reactivates enrollment
- ✅ **T4.26**: Student can be enrolled in multiple classes simultaneously
- ❌ **T4.27**: Enroll as STAFF user → Returns 403 Forbidden

**Validates**:
- R4.3: Create enrollment with ACTIVE status
- R4.4: Prevent duplicate enrollments (unique constraint on studentId, classId)
- R4.9: Allow multiple class enrollments per student

---

### 6. Unenroll Student from Class

**Endpoint**: `DELETE /classes/:id/students/:studentId`

**Access**: ADMINISTRATOR or SUPER_ADMIN only

**Expected Response** (200 OK):
```json
{
  "id": "enrollment-uuid",
  "studentId": "student-uuid",
  "classId": "class-uuid",
  "status": "INACTIVE",
  "enrolledAt": "2024-01-15T10:00:00.000Z",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T15:45:00.000Z",
  "student": {
    "id": "student-uuid",
    "admissionId": "STU001",
    "firstName": "John",
    "lastName": "Doe",
    "user": {
      "email": "john@example.com",
      "status": "ACTIVE"
    }
  },
  "class": {
    "id": "class-uuid",
    "name": "Batch 2024 Morning",
    "status": "ACTIVE"
  }
}
```

**Test Cases**:
- ✅ **T4.28**: Unenroll active student → Returns 200 with INACTIVE status
- ❌ **T4.29**: Unenroll already inactive student → Returns 400 Bad Request
- ❌ **T4.30**: Unenroll non-existent enrollment → Returns 404 Not Found
- ✅ **T4.31**: Enrollment record is retained (soft delete)
- ✅ **T4.32**: Inactive enrollment no longer appears in GET /classes/:id
- ✅ **T4.33**: Inactive enrollment retained for historical reporting
- ❌ **T4.34**: Unenroll as STAFF user → Returns 403 Forbidden

**Validates**:
- R4.5: Set enrollment status to INACTIVE (don't delete)
- R4.6: Retain inactive enrollments for historical reporting

---

## Integration Test Scenarios

### Scenario 1: Complete Class Lifecycle

1. **Create Class**
   - POST /classes with name "Integration Test Batch"
   - Verify status is ACTIVE
   - Save class ID

2. **List Classes**
   - GET /classes?status=ACTIVE
   - Verify new class appears in list
   - Verify enrollment count is 0

3. **Enroll Students**
   - POST /classes/{id}/students with student 1
   - POST /classes/{id}/students with student 2
   - Verify both enrollments return status ACTIVE

4. **Get Class Details**
   - GET /classes/{id}
   - Verify 2 active enrollments returned
   - Verify student details included

5. **Unenroll Student**
   - DELETE /classes/{id}/students/{student1Id}
   - Verify enrollment status becomes INACTIVE

6. **Verify Soft Delete**
   - GET /classes/{id}
   - Verify only 1 active enrollment (student 2)
   - Verify student 1 does not appear

7. **Archive Class**
   - PATCH /classes/{id} with status ARCHIVED
   - Verify status updated

8. **Verify Archive Filter**
   - GET /classes?status=ARCHIVED
   - Verify class appears in archived list

**Validates**: R4.1, R4.2, R4.3, R4.5, R4.6, R4.7, R4.8

---

### Scenario 2: Duplicate Prevention

1. **Create First Class**
   - POST /classes with name "Duplicate Test"
   - Verify 201 Created

2. **Attempt Duplicate**
   - POST /classes with same name "Duplicate Test"
   - Verify 409 Conflict error

3. **Create Second Class**
   - POST /classes with different name "Unique Test"
   - Verify 201 Created

4. **Enroll Student in First Class**
   - POST /classes/{class1Id}/students
   - Verify 201 Created

5. **Attempt Duplicate Enrollment**
   - POST /classes/{class1Id}/students with same student
   - Verify 409 Conflict error

6. **Enroll in Different Class**
   - POST /classes/{class2Id}/students with same student
   - Verify 201 Created (multiple enrollments allowed)

**Validates**: R4.1, R4.4, R4.9

---

### Scenario 3: Re-enrollment After Unenrollment

1. **Create Class and Enroll Student**
   - POST /classes, save ID
   - POST /classes/{id}/students with student ID

2. **Unenroll Student**
   - DELETE /classes/{id}/students/{studentId}
   - Verify status becomes INACTIVE

3. **Verify Not in Active List**
   - GET /classes/{id}
   - Verify student not in enrollments array

4. **Re-enroll Same Student**
   - POST /classes/{id}/students with same student ID
   - Verify 201 Created
   - Verify status is ACTIVE
   - Verify new enrolledAt timestamp

5. **Verify in Active List**
   - GET /classes/{id}
   - Verify student appears in enrollments

**Validates**: R4.5, R4.6, R4.7

---

## Database Verification Queries

After running tests, verify data integrity:

```sql
-- Check class uniqueness
SELECT name, COUNT(*) 
FROM classes 
GROUP BY name 
HAVING COUNT(*) > 1;
-- Should return 0 rows

-- Check enrollment uniqueness
SELECT student_id, class_id, COUNT(*) 
FROM class_enrollments 
GROUP BY student_id, class_id 
HAVING COUNT(*) > 1;
-- Should return 0 rows

-- Check soft delete (INACTIVE enrollments retained)
SELECT * FROM class_enrollments WHERE status = 'INACTIVE';
-- Should show historical enrollments

-- Verify GET /classes/:id only returns ACTIVE enrollments
SELECT ce.* 
FROM class_enrollments ce
WHERE ce.class_id = 'your-class-uuid' AND ce.status = 'ACTIVE';
-- Should match API response
```

---

## Error Handling Tests

### Authentication Errors

**T4.35**: Request without JWT token → Returns 401 Unauthorized

```bash
curl -X POST http://localhost:3000/classes \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Class"}'
```

**T4.36**: Request with expired token → Returns 401 Unauthorized

**T4.37**: Request with invalid token → Returns 401 Unauthorized

---

### Authorization Errors

**T4.38**: STUDENT attempts POST /classes → Returns 403 Forbidden

**T4.39**: STAFF attempts POST /classes/:id/students → Returns 403 Forbidden

---

### Validation Errors

**T4.40**: POST /classes with empty name → Returns 400 Bad Request

```json
{
  "name": ""
}
```

**T4.41**: POST /classes/:id/students with invalid UUID → Returns 400 Bad Request

```json
{
  "studentId": "not-a-uuid"
}
```

**T4.42**: GET /classes with invalid status value → Returns 400 Bad Request

```
GET /classes?status=INVALID_STATUS
```

---

## Performance Tests

**T4.43**: List 1000+ classes with pagination → Response time < 500ms

**T4.44**: Get class with 100+ enrollments → Response time < 1s

**T4.45**: Concurrent enrollment requests → No duplicate enrollments created

---

## Manual Testing Checklist

Use this checklist to verify all functionality:

- [ ] Can create class with unique name
- [ ] Cannot create class with duplicate name
- [ ] Class defaults to ACTIVE status
- [ ] Can list all classes
- [ ] Can filter classes by ACTIVE status
- [ ] Can filter classes by ARCHIVED status
- [ ] Can get single class with enrollments
- [ ] Only ACTIVE enrollments appear in class details
- [ ] Can update class name
- [ ] Can update class description
- [ ] Can archive class
- [ ] Can enroll student in class
- [ ] Cannot enroll same student twice in same class
- [ ] Can enroll student in multiple classes
- [ ] Can unenroll student (soft delete)
- [ ] Unenrolled student not in active enrollments
- [ ] Can re-enroll previously unenrolled student
- [ ] ADMINISTRATOR can perform all operations
- [ ] STAFF cannot create/update/enroll/unenroll
- [ ] STAFF can view classes
- [ ] STUDENT cannot access any class endpoints
- [ ] Pagination works correctly
- [ ] Enrollment count reflects only ACTIVE enrollments

---

## Test Data Setup Script

Use this script to create test data:

```sql
-- Create test admin user
INSERT INTO users (id, email, password_hash, role, status, must_change_password)
VALUES (
  gen_random_uuid(),
  'admin@test.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWEgKK3m', -- "password123"
  'ADMINISTRATOR',
  'ACTIVE',
  false
);

-- Create test students
INSERT INTO users (id, email, password_hash, role, status, must_change_password)
VALUES 
  (gen_random_uuid(), 'student1@test.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWEgKK3m', 'STUDENT', 'ACTIVE', false),
  (gen_random_uuid(), 'student2@test.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWEgKK3m', 'STUDENT', 'ACTIVE', false);

-- Get user IDs and create student profiles
WITH user_ids AS (
  SELECT id, email FROM users WHERE role = 'STUDENT'
)
INSERT INTO students (id, user_id, admission_id, first_name, last_name, admission_date)
SELECT 
  gen_random_uuid(),
  id,
  'STU' || LPAD(ROW_NUMBER() OVER (ORDER BY email)::text, 3, '0'),
  'Student',
  ROW_NUMBER() OVER (ORDER BY email)::text,
  CURRENT_DATE
FROM user_ids;
```

---

## Automated Test Execution

Run all unit tests:
```bash
npm test -- classes
```

Run integration tests:
```bash
npm run test:e2e
```

Run with coverage:
```bash
npm run test:cov -- classes
```

---

## Success Criteria

All tests pass when:

✅ All 45 test cases pass
✅ No duplicate class names in database
✅ No duplicate enrollments in database
✅ INACTIVE enrollments retained in database
✅ Only ACTIVE enrollments appear in GET /classes/:id
✅ Correct HTTP status codes returned
✅ Proper authorization enforced
✅ Validation errors handled gracefully
✅ Re-enrollment works correctly

---

## Requirements Validation Summary

This module validates **Requirement R4: Class Management** with the following acceptance criteria:

- ✅ **R4.1**: Classes require unique names
- ✅ **R4.2**: New class status defaults to ACTIVE
- ✅ **R4.3**: Enrollments created with ACTIVE status
- ✅ **R4.4**: Unique constraint prevents duplicate enrollments
- ✅ **R4.5**: Unenrollment sets status to INACTIVE
- ✅ **R4.6**: Inactive enrollments retained for historical reporting
- ✅ **R4.7**: GET /classes/:id returns only ACTIVE enrollments
- ✅ **R4.8**: Classes can be archived
- ✅ **R4.9**: Students can be enrolled in multiple classes simultaneously
- ✅ **R4.10**: Independent attendance tracking per class (validated in Attendance module)

**Test Coverage**: T2 (Class setup) from the implementation plan
