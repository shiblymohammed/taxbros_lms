# Task 40: Quiz Attempt History Endpoints - Implementation Summary

## Task Description
Build quiz attempt history endpoints that allow students to view their quiz attempt history and detailed results, while admins can review all student attempts for a quiz.

## Requirements Implemented
- **R26**: Quiz attempt history and review
- **Test Coverage**: T5 (Attempt history)

## Endpoints Implemented

### 1. GET /quizzes/:id/attempts
**Purpose**: List all attempts for a specific quiz

**Access Control**:
- Students: See only their own attempts
- Admins/Staff: See all attempts, with optional filtering by studentId

**Query Parameters**:
- `studentId` (optional): Filter attempts by specific student (admin/staff only)

**Response Format**:
```typescript
[
  {
    id: string;              // Attempt UUID
    quizId: string;          // Quiz UUID
    studentId: string;       // Student UUID
    studentName: string;     // Full name (firstName + lastName)
    admissionId: string;     // Student admission ID
    score: number;           // Total marks earned
    passed: boolean;         // Whether student passed
    startedAt: Date;         // When attempt started
    submittedAt: Date;       // When attempt was submitted
  }
]
```

**Features**:
- Results ordered by submission time (newest first)
- Automatically filters by current user for students
- Validates quiz existence (404 if not found)

### 2. GET /quizzes/attempts/:id
**Purpose**: Get detailed view of a single quiz attempt

**Access Control**:
- Students: Can only view their own attempts (403 if accessing other's)
- Admins/Staff: Can view any attempt

**Response Format**:
```typescript
{
  id: string;              // Attempt UUID
  quizId: string;          // Quiz UUID
  quizTitle: string;       // Quiz title
  studentId: string;       // Student UUID
  studentName: string;     // Full name
  admissionId: string;     // Student admission ID
  score: number;           // Total marks earned
  totalMarks: number;      // Total marks available
  passMark: number;        // Minimum marks to pass
  passed: boolean;         // Whether student passed
  startedAt: Date;         // When attempt started
  submittedAt: Date;       // When attempt was submitted
  questions: [             // Array of questions with answers
    {
      id: string;
      questionText: string;
      options: Array<{ id: string; text: string }>;
      correctAnswer: string;    // Correct option ID
      marks: number;            // Marks for this question
      displayOrder: number;
      selectedAnswer: string;   // Student's selected option ID
      isCorrect: boolean;       // Whether answer was correct
      marksAwarded: number;     // Marks awarded (marks if correct, 0 if wrong)
    }
  ]
}
```

**Features**:
- Shows all questions with correct answers
- Indicates which answers were correct/incorrect
- Shows marks awarded per question
- Validates attempt existence (404 if not found)
- Enforces ownership for students (403 if not their attempt)

## Implementation Details

### Files Modified

1. **apps/api/src/quizzes/quizzes.service.ts**
   - Added `getQuizAttempts()` method
   - Added `getAttemptDetail()` method
   - Implements role-based filtering and access control

2. **apps/api/src/quizzes/quizzes.controller.ts**
   - Added `GET /quizzes/:id/attempts` endpoint
   - Added `GET /quizzes/attempts/:id` endpoint
   - Applied proper guards and decorators

3. **apps/api/src/quizzes/quizzes.service.spec.ts**
   - Added comprehensive unit tests for both new methods
   - Tests cover all scenarios: student access, admin access, filtering, errors

4. **apps/api/src/quizzes/attempt-history.integration.spec.ts**
   - Created integration tests for API endpoints
   - Tests HTTP responses and status codes

### Key Implementation Decisions

1. **Route Ordering**: Placed `GET /quizzes/attempts/:id` before `GET /quizzes/:id` to prevent routing conflicts

2. **Data Isolation**: Students can only access their own attempts through service-layer checks, not just URL restrictions

3. **Response Formatting**: Denormalized student information (name, admissionId) in responses for better API usability

4. **Marks Calculation**: Each question shows `marksAwarded` calculated as `marks` if correct, `0` if incorrect

5. **No Enrollment Check**: Users can view attempt history even after course enrollment ends (historical records remain accessible)

## Testing

### Unit Tests
✅ All unit tests pass
- Student can view own attempts only
- Admin can view all attempts
- Admin can filter by studentId
- NotFoundException for invalid quiz/attempt
- ForbiddenException for unauthorized access
- Correct/incorrect answer identification
- Marks calculation per question

### Build Verification
✅ Build completed successfully
```bash
npm run build
# Exit Code: 0
```

### Integration Tests
✅ Integration tests created
- HTTP endpoint testing
- Request/response validation
- Authorization testing

## API Examples

### Example 1: Student views their attempts
```http
GET /quizzes/abc123/attempts
Authorization: Bearer <student_token>

Response: 200 OK
[
  {
    "id": "attempt-1",
    "quizId": "abc123",
    "studentId": "student-1",
    "studentName": "John Doe",
    "admissionId": "ADM001",
    "score": 85,
    "passed": true,
    "startedAt": "2024-01-15T10:00:00Z",
    "submittedAt": "2024-01-15T10:30:00Z"
  }
]
```

### Example 2: Admin views specific student attempts
```http
GET /quizzes/abc123/attempts?studentId=student-2
Authorization: Bearer <admin_token>

Response: 200 OK
[/* filtered attempts for student-2 */]
```

### Example 3: View attempt details
```http
GET /quizzes/attempts/attempt-1
Authorization: Bearer <student_token>

Response: 200 OK
{
  "id": "attempt-1",
  "quizId": "abc123",
  "quizTitle": "Math Quiz",
  "studentName": "John Doe",
  "score": 85,
  "totalMarks": 100,
  "passMark": 70,
  "passed": true,
  "questions": [
    {
      "questionText": "What is 2+2?",
      "correctAnswer": "a",
      "selectedAnswer": "a",
      "isCorrect": true,
      "marksAwarded": 50
    }
  ]
}
```

### Example 4: Error cases
```http
# Student trying to view another's attempt
GET /quizzes/attempts/other-attempt
Authorization: Bearer <student_token>

Response: 403 Forbidden
{ "message": "You can only view your own quiz attempts" }

# Quiz not found
GET /quizzes/invalid-id/attempts
Authorization: Bearer <any_token>

Response: 404 Not Found
{ "message": "Quiz with ID invalid-id not found" }
```

## Dependencies
- No new dependencies added
- Uses existing Prisma models: Quiz, QuizAttempt, QuizQuestion, Student
- Uses existing authentication/authorization guards

## Next Steps
This task completes the quiz attempt history functionality. The implementation is ready for:
1. Manual testing with real database data
2. Integration into the frontend UI (Task 41-45)
3. Production deployment

## Documentation
- API documentation: See TASK_40_TESTING.md for manual testing guide
- Code documentation: Inline JSDoc comments in service and controller
- Test documentation: Test descriptions in spec files
