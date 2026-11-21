# Task 34: Manual Lesson Completion Endpoint

## Overview

This document describes the implementation of the manual lesson completion endpoint for the TAXBROS LMS. This endpoint allows students to manually mark a lesson as complete, regardless of their watch percentage.

## Requirements

**Primary Requirements:**
- **R21.4**: Manual completion button functionality
- **R21.5**: Set completedAt timestamp when marked complete
- **R21.6**: Update parent course progress percentage after completion

**Authorization Requirements:**
- **R2.5**: Students can only complete their own lessons
- **R2.11**: Validate course enrollment before allowing completion

## API Endpoint

### POST /lessons/:lessonId/complete

Manually marks a lesson as COMPLETED for the authenticated student.

**Authentication**: Required (JWT Bearer token)

**Authorization**: STUDENT role only

**URL Parameters:**
- `lessonId` (string, required) - UUID of the lesson to complete

**Request Body**: None (empty object `{}`)

**Success Response (200 OK):**
```json
{
  "lessonProgress": {
    "id": "uuid",
    "studentId": "uuid",
    "lessonId": "uuid",
    "status": "COMPLETED",
    "lastPosition": 150,
    "watchedDuration": 200,
    "completedAt": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-15T09:00:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "courseProgress": {
    "courseId": "uuid",
    "progressPercentage": 33
  }
}
```

**Error Responses:**

- **401 Unauthorized**: No valid JWT token provided
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

- **403 Forbidden**: Student is not enrolled in the course
```json
{
  "statusCode": 403,
  "message": "You must be enrolled in this course to complete lessons"
}
```

- **404 Not Found**: Lesson does not exist
```json
{
  "statusCode": 404,
  "message": "Lesson with ID {lessonId} not found"
}
```

## Implementation Details

### Controller Layer

**File**: `src/progress/progress.controller.ts`

```typescript
@Post('lessons/:lessonId/complete')
@Roles(UserRole.STUDENT)
@HttpCode(HttpStatus.OK)
async completeLesson(
  @Param('lessonId') lessonId: string,
  @CurrentUser('studentId') studentId: string | undefined,
) {
  if (!studentId) {
    throw new BadRequestException('Student ID not found in user context');
  }
  return this.progressService.completeLesson(studentId, lessonId);
}
```

**Key Features:**
- Restricted to STUDENT role via `@Roles` decorator
- Extracts studentId from JWT token using `@CurrentUser` decorator
- Delegates business logic to service layer
- Returns 200 OK on success (via `@HttpCode` decorator)

### Service Layer

**File**: `src/progress/progress.service.ts`

**Method**: `completeLesson(studentId: string, lessonId: string)`

**Logic Flow:**

1. **Verify Lesson Exists**
   - Query database for lesson with nested course and enrollment data
   - Throw `NotFoundException` if lesson not found

2. **Validate Enrollment**
   - Check if student has ACTIVE enrollment in the parent course
   - Throw `ForbiddenException` if not enrolled or enrollment is DROPPED

3. **Update Lesson Progress**
   - Upsert LessonProgress record with:
     - `status`: Set to `COMPLETED`
     - `completedAt`: Set to current timestamp
     - Preserve existing `lastPosition` and `watchedDuration`

4. **Recalculate Course Progress**
   - Query all PUBLISHED lessons in the course
   - Count how many are COMPLETED by this student
   - Calculate: `progressPercentage = (completed / total) × 100`
   - Round to nearest integer

5. **Update Course Enrollment**
   - Update `CourseEnrollment.progressPercentage` with new value
   - Update `lastAccessedAt` timestamp

6. **Return Result**
   - Return updated lesson progress and course progress

**Code Reference:**
```typescript
async completeLesson(studentId: string, lessonId: string) {
  // 1. Verify lesson exists and get course details
  const lesson = await this.prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        include: {
          course: {
            include: {
              enrollments: {
                where: { studentId, status: 'ACTIVE' },
              },
            },
          },
        },
      },
    },
  });

  if (!lesson) {
    throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
  }

  // 2. Validate enrollment
  const course = lesson.module.course;
  if (!course.enrollments || course.enrollments.length === 0) {
    throw new ForbiddenException(
      'You must be enrolled in this course to complete lessons',
    );
  }

  // 3. Update lesson progress
  const lessonProgress = await this.prisma.lessonProgress.upsert({
    where: { studentId_lessonId: { studentId, lessonId } },
    update: {
      status: LessonProgressStatus.COMPLETED,
      completedAt: new Date(),
    },
    create: {
      studentId,
      lessonId,
      status: LessonProgressStatus.COMPLETED,
      completedAt: new Date(),
      lastPosition: 0,
      watchedDuration: 0,
    },
  });

  // 4. Recalculate course progress
  const progressPercentage = await this.calculateCourseProgress(
    studentId,
    course.id,
  );

  // 5. Update course enrollment
  await this.prisma.courseEnrollment.update({
    where: { id: enrollment.id },
    data: {
      progressPercentage,
      lastAccessedAt: new Date(),
    },
  });

  // 6. Return result
  return {
    lessonProgress,
    courseProgress: {
      courseId: course.id,
      progressPercentage,
    },
  };
}
```

## Database Schema

### LessonProgress Table

```prisma
model LessonProgress {
  id              String               @id @default(uuid())
  studentId       String
  lessonId        String
  status          LessonProgressStatus @default(NOT_STARTED)
  lastPosition    Int                  @default(0) // Position in seconds
  watchedDuration Int                  @default(0) // Total watched time in seconds
  completedAt     DateTime?            // Set when status becomes COMPLETED
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  lesson  Lesson  @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([studentId, lessonId])
  @@index([studentId])
  @@index([lessonId])
  @@index([status])
  @@map("lesson_progress")
}

enum LessonProgressStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
}
```

**Key Constraints:**
- Unique constraint on `(studentId, lessonId)` - One progress record per student per lesson
- Cascade delete - Progress records deleted when student or lesson is deleted
- Indexes on studentId, lessonId, and status for efficient queries

## Usage Examples

### Example 1: Complete a Lesson

**Request:**
```bash
curl -X POST http://localhost:3000/lessons/abc-123-def/complete \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response:**
```json
{
  "lessonProgress": {
    "id": "progress-789",
    "studentId": "student-456",
    "lessonId": "abc-123-def",
    "status": "COMPLETED",
    "lastPosition": 0,
    "watchedDuration": 0,
    "completedAt": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "courseProgress": {
    "courseId": "course-xyz",
    "progressPercentage": 25
  }
}
```

### Example 2: Complete Already In-Progress Lesson

If a student has already watched 50% of a video and then clicks "Mark as Complete":

**Request:**
```bash
curl -X POST http://localhost:3000/lessons/lesson-456/complete \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -d '{}'
```

**Response:**
```json
{
  "lessonProgress": {
    "id": "progress-999",
    "studentId": "student-123",
    "lessonId": "lesson-456",
    "status": "COMPLETED",
    "lastPosition": 300,
    "watchedDuration": 300,
    "completedAt": "2024-01-15T11:00:00.000Z",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  },
  "courseProgress": {
    "courseId": "course-abc",
    "progressPercentage": 50
  }
}
```

**Note**: The `lastPosition` and `watchedDuration` are preserved from the IN_PROGRESS state.

### Example 3: Error - Not Enrolled

**Request:**
```bash
curl -X POST http://localhost:3000/lessons/lesson-789/complete \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -d '{}'
```

**Response (403 Forbidden):**
```json
{
  "statusCode": 403,
  "message": "You must be enrolled in this course to complete lessons"
}
```

## Testing

### Unit Tests

**File**: `src/progress/complete-lesson.spec.ts`

**Test Coverage:**

1. **Successful Completion Scenarios**
   - ✓ Complete NOT_STARTED lesson
   - ✓ Complete IN_PROGRESS lesson
   - ✓ Complete already COMPLETED lesson (idempotency)

2. **Error Handling**
   - ✓ Throw NotFoundException for non-existent lesson
   - ✓ Throw ForbiddenException when not enrolled
   - ✓ Throw ForbiddenException when enrollment is DROPPED

3. **Progress Calculation**
   - ✓ Calculate correct percentage (1/3 = 33%)
   - ✓ Reach 100% when all lessons complete
   - ✓ Only count PUBLISHED lessons

4. **Authorization**
   - ✓ Verify student can only complete own lessons
   - ✓ Verify enrollment is validated

### Integration Tests

**File**: `src/progress/progress.integration.spec.ts`

Tests the complete workflow including database interactions.

### Manual Testing

**File**: `test-complete-lesson.js`

A Node.js script to manually test the endpoint with real API calls.

**Run with:**
```bash
node test-complete-lesson.js
```

## Related Tasks

- **Task 31**: Lesson progress schema (defines LessonProgress model)
- **Task 32**: Video position tracking (updates lastPosition field)
- **Task 33**: Completion logic (calculateCourseProgress helper)
- **Task 35**: Progress retrieval endpoint (GET /lessons/:lessonId/progress)

## Relationship to Auto-Completion

The `completeLesson` method is shared between:

1. **Manual Completion** (Task 34): User clicks "Mark as Complete" button
   - Endpoint: POST /lessons/:lessonId/complete
   - Trigger: User action

2. **Auto-Completion** (Task 32): Video reaches 90% watched
   - Endpoint: PATCH /lessons/:lessonId/progress
   - Trigger: `shouldAutoComplete(position, duration)` returns true
   - Calls: `completeLesson(studentId, lessonId)` internally

This code reuse ensures consistency in how lessons are marked complete.

## Security Considerations

1. **Authentication**: JWT token required for all requests
2. **Authorization**: Only STUDENT role can access endpoint
3. **Data Isolation**: Students can only complete their own lessons (studentId from token)
4. **Enrollment Validation**: Must be actively enrolled in course
5. **Idempotency**: Safe to call multiple times without side effects

## Performance Considerations

1. **Single Database Transaction**: All updates happen in one flow
2. **Optimized Query**: Includes nested relations to minimize round trips
3. **Indexed Fields**: studentId, lessonId, and status are indexed
4. **Denormalized Progress**: progressPercentage stored in enrollment for fast retrieval

## Frontend Integration

### React/Next.js Component Example

```typescript
const CompleteButton = ({ lessonId }) => {
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `/lessons/${lessonId}/complete`,
        {},
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );

      // Update UI with new progress
      const { lessonProgress, courseProgress } = response.data;
      
      // Show success message
      toast.success('Lesson marked as complete!');
      
      // Refresh progress display
      updateProgress(courseProgress.progressPercentage);
      
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('You are not enrolled in this course');
      } else {
        toast.error('Failed to complete lesson');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleComplete}
      disabled={loading}
      className="btn btn-primary"
    >
      {loading ? 'Completing...' : 'Mark as Complete'}
    </button>
  );
};
```

## Troubleshooting

### Issue: "Student ID not found in user context"

**Cause**: JWT token does not contain studentId

**Solution**: Ensure user has a student profile and token includes studentId claim

### Issue: 403 Forbidden

**Cause**: Student not enrolled in course or enrollment is DROPPED

**Solution**: 
1. Check enrollment status: `GET /students/:studentId/courses`
2. Enroll student if needed: `POST /courses/:courseId/enroll/:studentId`

### Issue: Progress percentage not updating

**Cause**: Lesson is not PUBLISHED

**Solution**: Only PUBLISHED lessons count toward progress. Verify lesson status.

## Compliance Matrix

| Requirement | Implementation | Verified |
|-------------|---------------|----------|
| R21.4: Manual completion button | POST /lessons/:lessonId/complete endpoint | ✓ |
| R21.5: Set completedAt timestamp | completedAt = new Date() in upsert | ✓ |
| R21.6: Update course progress | calculateCourseProgress() called | ✓ |
| R2.5: Student data isolation | studentId from JWT token | ✓ |
| R2.11: Validate enrollment | Check ACTIVE enrollment before completion | ✓ |

## Conclusion

Task 34 has been successfully implemented. The manual lesson completion endpoint allows students to mark lessons as complete, properly updates timestamps, recalculates course progress, and enforces all authorization requirements. The implementation follows NestJS best practices and integrates seamlessly with existing progress tracking functionality (Tasks 32 and 33).
