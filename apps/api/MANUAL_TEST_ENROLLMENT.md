# Manual Testing Guide: Course Enrollment Endpoints (Task 30)

This guide provides step-by-step instructions to manually test all course enrollment endpoints.

## Prerequisites

1. **Start the API server:**
   ```bash
   cd apps/api
   npm run dev
   ```

2. **Ensure database is running** with test data (users, students, courses)

3. **Use a REST client** (Postman, Insomnia, curl, or VSCode REST Client)

## Setup: Get Authentication Tokens

### 1. Login as Admin
```http
POST http://localhost:3001/auth/login
Content-Type: application/json

{
  "email": "admin@taxbros.com",
  "password": "your-admin-password"
}
```

**Save the `accessToken` from the response as `ADMIN_TOKEN`**

### 2. Login as Student
```http
POST http://localhost:3001/auth/login
Content-Type: application/json

{
  "email": "student@taxbros.com",
  "password": "your-student-password"
}
```

**Save the `accessToken` from the response as `STUDENT_TOKEN`**

### 3. Get Student ID
```http
GET http://localhost:3001/students
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Save a student `id` from the response as `STUDENT_ID`**

### 4. Get or Create a Published Course
```http
GET http://localhost:3001/courses?status=PUBLISHED
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Save a course `id` from the response as `COURSE_ID`**

If no published course exists, create one:
```http
POST http://localhost:3001/courses
Authorization: Bearer {{ADMIN_TOKEN}}
Content-Type: application/json

{
  "title": "Test Enrollment Course",
  "description": "Course for testing enrollment",
  "displayOrder": 1
}
```

Then publish it:
```http
PATCH http://localhost:3001/courses/{{NEW_COURSE_ID}}
Authorization: Bearer {{ADMIN_TOKEN}}
Content-Type: application/json

{
  "status": "PUBLISHED"
}
```

## Test 1: Enroll Student (Admin)

**Test:** Admin enrolls a student in a published course

```http
POST http://localhost:3001/courses/{{COURSE_ID}}/enroll
Authorization: Bearer {{ADMIN_TOKEN}}
Content-Type: application/json

{
  "studentId": "{{STUDENT_ID}}"
}
```

**Expected Response (201 Created):**
```json
{
  "id": "enrollment-uuid",
  "studentId": "student-uuid",
  "courseId": "course-uuid",
  "status": "ACTIVE",
  "progressPercentage": 0,
  "enrolledAt": "2024-01-01T00:00:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "student": {
    "id": "student-uuid",
    "admissionId": "STU-001",
    "firstName": "John",
    "lastName": "Doe",
    "user": {
      "email": "student@taxbros.com",
      "status": "ACTIVE"
    }
  },
  "course": {
    "id": "course-uuid",
    "title": "Test Enrollment Course",
    "description": "Course for testing enrollment",
    "coverImage": null,
    "status": "PUBLISHED"
  }
}
```

**Save the enrollment `id` as `ENROLLMENT_ID`**

✅ **Validates:** R5.1, R5.2, R5.3, R5.8

## Test 2: Prevent Duplicate Enrollment

**Test:** Try to enroll the same student again

```http
POST http://localhost:3001/courses/{{COURSE_ID}}/enroll
Authorization: Bearer {{ADMIN_TOKEN}}
Content-Type: application/json

{
  "studentId": "{{STUDENT_ID}}"
}
```

**Expected Response (409 Conflict):**
```json
{
  "statusCode": 409,
  "message": "Student is already enrolled in this course",
  "error": "Conflict"
}
```

✅ **Validates:** R5.2

## Test 3: Get Student's Enrollments

**Test:** Retrieve all enrollments for a student

```http
GET http://localhost:3001/courses/students/{{STUDENT_ID}}/enrollments
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Expected Response (200 OK):**
```json
[
  {
    "id": "enrollment-uuid",
    "studentId": "student-uuid",
    "courseId": "course-uuid",
    "status": "ACTIVE",
    "progressPercentage": 0,
    "lastAccessedAt": null,
    "enrolledAt": "2024-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "course": {
      "id": "course-uuid",
      "title": "Test Enrollment Course",
      "description": "Course for testing enrollment",
      "coverImage": null,
      "status": "PUBLISHED",
      "displayOrder": 1
    }
  }
]
```

✅ **Validates:** R5.4, R22

## Test 4: Get Course Enrollments (Admin)

**Test:** Retrieve all enrollments for a course

```http
GET http://localhost:3001/courses/{{COURSE_ID}}/enrollments
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Expected Response (200 OK):**
```json
{
  "data": [
    {
      "id": "enrollment-uuid",
      "studentId": "student-uuid",
      "courseId": "course-uuid",
      "status": "ACTIVE",
      "progressPercentage": 0,
      "lastAccessedAt": null,
      "enrolledAt": "2024-01-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "student": {
        "id": "student-uuid",
        "userId": "user-uuid",
        "admissionId": "STU-001",
        "firstName": "John",
        "lastName": "Doe",
        "user": {
          "email": "student@taxbros.com",
          "status": "ACTIVE"
        }
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

✅ **Validates:** R5

## Test 5: Get Course Enrollments with Filters

**Test:** Filter enrollments by status

```http
GET http://localhost:3001/courses/{{COURSE_ID}}/enrollments?status=ACTIVE&page=1&limit=5
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Expected Response (200 OK):**
- Same structure as Test 4
- Only ACTIVE enrollments
- Maximum 5 items per page

✅ **Validates:** Pagination and filtering

## Test 6: Student Cannot View Other Course Enrollments

**Test:** Student tries to view course enrollments

```http
GET http://localhost:3001/courses/{{COURSE_ID}}/enrollments
Authorization: Bearer {{STUDENT_TOKEN}}
```

**Expected Response (403 Forbidden):**
```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

✅ **Validates:** Authorization rules

## Test 7: Unenroll Student (Admin)

**Test:** Admin drops a student from a course

```http
DELETE http://localhost:3001/courses/enrollments/{{ENROLLMENT_ID}}
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Expected Response (200 OK):**
```json
{
  "id": "enrollment-uuid",
  "studentId": "student-uuid",
  "courseId": "course-uuid",
  "status": "DROPPED",
  "progressPercentage": 0,
  "lastAccessedAt": null,
  "enrolledAt": "2024-01-01T00:00:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "student": { ... },
  "course": { ... }
}
```

✅ **Validates:** R5.5, R5.6

## Test 8: Verify Enrollment Record Retained

**Test:** Check that dropped enrollment is still in database

```http
GET http://localhost:3001/courses/{{COURSE_ID}}/enrollments?status=DROPPED
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Expected Response (200 OK):**
- Should include the dropped enrollment
- Status should be "DROPPED"
- progressPercentage should be preserved

✅ **Validates:** R5.6 (Soft delete)

## Test 9: Re-enrollment After Dropping

**Test:** Re-enroll the same student after dropping

```http
POST http://localhost:3001/courses/{{COURSE_ID}}/enroll
Authorization: Bearer {{ADMIN_TOKEN}}
Content-Type: application/json

{
  "studentId": "{{STUDENT_ID}}"
}
```

**Expected Response (201 Created):**
- Same enrollment ID as before
- Status should be "ACTIVE"
- enrolledAt should be updated to current time

✅ **Validates:** Re-enrollment logic

## Test 10: Student Self-Enrollment

**Test:** Student enrolls themselves in a course

First, get the student ID from their own profile:
```http
GET http://localhost:3001/students
Authorization: Bearer {{STUDENT_TOKEN}}
```

Then enroll:
```http
POST http://localhost:3001/courses/{{COURSE_ID}}/enroll
Authorization: Bearer {{STUDENT_TOKEN}}
Content-Type: application/json

{
  "studentId": "{{THEIR_OWN_STUDENT_ID}}"
}
```

**Expected Response (201 Created):**
- Successful enrollment

✅ **Validates:** Student self-enrollment authorization

## Test 11: Student Cannot Enroll Others

**Test:** Student tries to enroll another student

```http
POST http://localhost:3001/courses/{{COURSE_ID}}/enroll
Authorization: Bearer {{STUDENT_TOKEN}}
Content-Type: application/json

{
  "studentId": "{{DIFFERENT_STUDENT_ID}}"
}
```

**Expected Response (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Students can only enroll themselves in courses",
  "error": "Bad Request"
}
```

✅ **Validates:** Authorization rules

## Test 12: Cannot Enroll in Draft Course

**Test:** Try to enroll in a non-published course

First, create a draft course:
```http
POST http://localhost:3001/courses
Authorization: Bearer {{ADMIN_TOKEN}}
Content-Type: application/json

{
  "title": "Draft Course Test",
  "description": "This course is in draft status"
}
```

Save the course ID, then try to enroll:
```http
POST http://localhost:3001/courses/{{DRAFT_COURSE_ID}}/enroll
Authorization: Bearer {{ADMIN_TOKEN}}
Content-Type: application/json

{
  "studentId": "{{STUDENT_ID}}"
}
```

**Expected Response (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Cannot enroll in a course that is not published",
  "error": "Bad Request"
}
```

✅ **Validates:** R5.8

## Test 13: Invalid Student ID

**Test:** Try to enroll with non-existent student

```http
POST http://localhost:3001/courses/{{COURSE_ID}}/enroll
Authorization: Bearer {{ADMIN_TOKEN}}
Content-Type: application/json

{
  "studentId": "00000000-0000-0000-0000-000000000000"
}
```

**Expected Response (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Student with ID \"00000000-0000-0000-0000-000000000000\" not found",
  "error": "Not Found"
}
```

✅ **Validates:** Validation

## Test 14: Invalid Course ID

**Test:** Try to enroll in non-existent course

```http
POST http://localhost:3001/courses/00000000-0000-0000-0000-000000000000/enroll
Authorization: Bearer {{ADMIN_TOKEN}}
Content-Type: application/json

{
  "studentId": "{{STUDENT_ID}}"
}
```

**Expected Response (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Course with ID \"00000000-0000-0000-0000-000000000000\" not found",
  "error": "Not Found"
}
```

✅ **Validates:** Validation

## Summary Checklist

- [ ] Test 1: Admin enrollment ✅
- [ ] Test 2: Duplicate prevention ✅
- [ ] Test 3: Get student enrollments ✅
- [ ] Test 4: Get course enrollments (admin) ✅
- [ ] Test 5: Enrollment filtering ✅
- [ ] Test 6: Student authorization check ✅
- [ ] Test 7: Unenroll student ✅
- [ ] Test 8: Soft delete verification ✅
- [ ] Test 9: Re-enrollment ✅
- [ ] Test 10: Student self-enrollment ✅
- [ ] Test 11: Cross-student prevention ✅
- [ ] Test 12: Draft course prevention ✅
- [ ] Test 13: Invalid student validation ✅
- [ ] Test 14: Invalid course validation ✅

## Automated Testing

To run the automated E2E test suite:

```bash
cd apps/api
npm run test:e2e -- course-enrollment.e2e-spec.ts
```

This will run all 14 test scenarios automatically.

## Troubleshooting

### 401 Unauthorized
- Token expired (get a new token)
- Token not included in Authorization header
- Invalid token format

### 403 Forbidden
- User doesn't have permission for the operation
- Student trying to access admin-only endpoint
- Student trying to modify other student's data

### 404 Not Found
- Invalid UUID format
- Resource doesn't exist in database
- Typo in endpoint URL

### 409 Conflict
- Duplicate enrollment (student already enrolled)
- Unique constraint violation

### 400 Bad Request
- Missing required fields
- Invalid data format
- Business rule violation (e.g., enrolling in draft course)

## Next Steps

After verifying all endpoints work correctly:
1. Proceed to Task 31: Lesson progress tracking
2. Integrate enrollment checks in lesson access
3. Implement course completion percentage calculation
4. Build enrollment UI in frontend
