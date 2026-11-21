# Task 40: Quiz Attempt History Endpoints - Testing Guide

## Implementation Summary

Task 40 implements two endpoints for viewing quiz attempt history:

1. **GET /quizzes/:id/attempts** - List all attempts for a quiz
   - Students see only their own attempts
   - Admins/staff can see all attempts or filter by studentId
   - Returns: attemptId, studentName, admissionId, score, passed, timestamps

2. **GET /quizzes/attempts/:id** - Detailed view of a single attempt
   - Shows questions with student answers and correct answers
   - Displays marks awarded per question
   - Shows overall score, passed status, timestamps
   - Students can only view their own attempts
   - Admins/staff can view any attempt

## Requirements Validated

- **R26**: Quiz attempt history and review
- **Task 40 Details**: All specifications implemented

## Files Modified

1. `apps/api/src/quizzes/quizzes.service.ts`
   - Added `getQuizAttempts()` method
   - Added `getAttemptDetail()` method

2. `apps/api/src/quizzes/quizzes.controller.ts`
   - Added `GET /quizzes/:id/attempts` endpoint
   - Added `GET /quizzes/attempts/:id` endpoint

3. `apps/api/src/quizzes/quizzes.service.spec.ts`
   - Added unit tests for `getQuizAttempts()`
   - Added unit tests for `getAttemptDetail()`

4. `apps/api/src/quizzes/attempt-history.integration.spec.ts`
   - Created integration tests for both endpoints

## Manual Testing Steps

### Prerequisites
Ensure you have:
- A quiz created and published (from Task 37-38)
- A student enrolled in the course
- At least one quiz attempt submitted (from Task 39)
- Valid JWT tokens for both student and admin users

### Test 1: List Quiz Attempts (Student View)

```bash
# Login as student
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "student@example.com",
  "password": "password123"
}

# Copy the access_token from response

# Get attempts for a quiz (student sees only their own)
GET http://localhost:3000/quizzes/{quiz-id}/attempts
Authorization: Bearer {access_token}

# Expected Response:
[
  {
    "id": "attempt-uuid",
    "quizId": "quiz-uuid",
    "studentId": "student-uuid",
    "studentName": "John Doe",
    "admissionId": "ADM001",
    "score": 85,
    "passed": true,
    "startedAt": "2024-01-15T10:00:00Z",
    "submittedAt": "2024-01-15T10:30:00Z"
  }
]
```

### Test 2: List Quiz Attempts (Admin View with Filter)

```bash
# Login as admin
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password123"
}

# Copy the access_token from response

# Get all attempts for a quiz
GET http://localhost:3000/quizzes/{quiz-id}/attempts
Authorization: Bearer {access_token}

# Get attempts filtered by studentId
GET http://localhost:3000/quizzes/{quiz-id}/attempts?studentId={student-id}
Authorization: Bearer {access_token}

# Expected: Returns attempts for specified student only
```

### Test 3: Get Attempt Detail (Student View)

```bash
# Use student token from Test 1

# Get detailed view of student's own attempt
GET http://localhost:3000/quizzes/attempts/{attempt-id}
Authorization: Bearer {student_access_token}

# Expected Response:
{
  "id": "attempt-uuid",
  "quizId": "quiz-uuid",
  "quizTitle": "Math Quiz",
  "studentId": "student-uuid",
  "studentName": "John Doe",
  "admissionId": "ADM001",
  "score": 85,
  "totalMarks": 100,
  "passMark": 70,
  "passed": true,
  "startedAt": "2024-01-15T10:00:00Z",
  "submittedAt": "2024-01-15T10:30:00Z",
  "questions": [
    {
      "id": "q1",
      "questionText": "What is 2+2?",
      "options": [
        { "id": "a", "text": "4" },
        { "id": "b", "text": "5" }
      ],
      "correctAnswer": "a",
      "marks": 50,
      "displayOrder": 0,
      "selectedAnswer": "a",
      "isCorrect": true,
      "marksAwarded": 50
    },
    {
      "id": "q2",
      "questionText": "What is 3+3?",
      "options": [
        { "id": "a", "text": "5" },
        { "id": "b", "text": "6" }
      ],
      "correctAnswer": "b",
      "marks": 50,
      "displayOrder": 1,
      "selectedAnswer": "b",
      "isCorrect": true,
      "marksAwarded": 50
    }
  ]
}
```

### Test 4: Get Attempt Detail (Admin View)

```bash
# Use admin token from Test 2

# Admin can view any student's attempt
GET http://localhost:3000/quizzes/attempts/{attempt-id}
Authorization: Bearer {admin_access_token}

# Expected: Same detailed response as Test 3
```

### Test 5: Authorization Tests

```bash
# Student trying to view another student's attempt
GET http://localhost:3000/quizzes/attempts/{other-student-attempt-id}
Authorization: Bearer {student_access_token}

# Expected: 403 Forbidden
# Response: { "message": "You can only view your own quiz attempts" }

# Quiz not found
GET http://localhost:3000/quizzes/invalid-quiz-id/attempts
Authorization: Bearer {any_access_token}

# Expected: 404 Not Found
# Response: { "message": "Quiz with ID invalid-quiz-id not found" }

# Attempt not found
GET http://localhost:3000/quizzes/attempts/invalid-attempt-id
Authorization: Bearer {any_access_token}

# Expected: 404 Not Found
# Response: { "message": "Attempt with ID invalid-attempt-id not found" }
```

## Expected Behavior

### List Attempts Endpoint
- **Students**: See only their own attempts for the quiz, ordered by submission time (newest first)
- **Admins/Staff**: 
  - Without filter: See all attempts for the quiz
  - With studentId filter: See attempts for specified student only
- Returns basic attempt information: score, passed status, timestamps, student details

### Attempt Detail Endpoint
- **Students**: Can view detailed results for their own attempts only
- **Admins/Staff**: Can view detailed results for any attempt
- Shows all questions with:
  - Question text and options
  - Correct answer
  - Student's selected answer
  - Whether answer was correct
  - Marks awarded for the question
- Shows overall quiz information: score, total marks, pass mark, passed status

### Data Isolation
- Students cannot access other students' attempts (403 Forbidden)
- Enrollment validation is NOT required for viewing attempts (students can review attempts even after course ends)
- All timestamps are in UTC

## Automated Test Coverage

### Unit Tests (quizzes.service.spec.ts)
- ✅ Student can view own attempts only
- ✅ Admin can view all attempts
- ✅ Admin can filter by studentId
- ✅ Throws NotFoundException for invalid quiz
- ✅ Throws NotFoundException for invalid attempt
- ✅ Throws ForbiddenException when student tries to view other's attempt
- ✅ Correctly identifies correct/incorrect answers
- ✅ Calculates marks awarded per question

### Integration Tests (attempt-history.integration.spec.ts)
- ✅ Returns attempts for a quiz
- ✅ Filters by studentId when provided
- ✅ Returns 404 for non-existent quiz
- ✅ Returns detailed attempt information
- ✅ Returns 404 for non-existent attempt
- ✅ Shows correct and incorrect answers with marks

## Build Verification

```bash
cd apps/api
npm run build
```

✅ Build completed successfully with no errors

## Notes

- The endpoints are part of the QuizzesController and use the existing authentication/authorization guards
- Role-based access control is enforced at the service layer
- All quiz attempt data comes from the QuizAttempt table which is populated by Task 39 (quiz submission endpoint)
- The implementation follows the existing patterns in the codebase for consistency
