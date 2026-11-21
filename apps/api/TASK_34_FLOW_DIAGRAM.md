# Task 34: Manual Lesson Completion Flow Diagram

## Request Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Student)                             │
│                                                                       │
│  [Mark as Complete Button]                                          │
│           │                                                          │
│           ▼                                                          │
│  POST /lessons/:lessonId/complete                                   │
│  Authorization: Bearer <jwt-token>                                  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            │ HTTPS Request
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NestJS API Gateway                              │
│                                                                       │
│  1. JwtAuthGuard - Validates JWT token                              │
│     ├─ Invalid token? → 401 Unauthorized                            │
│     └─ Valid? → Extract userId from token                           │
│                                                                       │
│  2. RolesGuard - Check user role                                    │
│     ├─ Not STUDENT role? → 403 Forbidden                            │
│     └─ STUDENT role? → Continue                                     │
│                                                                       │
│  3. Extract Parameters                                              │
│     ├─ lessonId from URL params                                     │
│     └─ studentId from JWT token (via CurrentUser decorator)         │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            │ Authorized Request
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ProgressController                                │
│                                                                       │
│  @Post('lessons/:lessonId/complete')                                │
│  @Roles(UserRole.STUDENT)                                           │
│  async completeLesson(                                              │
│    @Param('lessonId') lessonId,                                     │
│    @CurrentUser('studentId') studentId                              │
│  )                                                                   │
│                                                                       │
│  Validate studentId exists ────────────────────┐                    │
│     │                                           │                    │
│     │ Missing? → 400 BadRequest                │                    │
│     │                                           │                    │
│     └─ Call: progressService.completeLesson() │                    │
└───────────────────────────┬───────────────────┼─────────────────────┘
                            │                   │
                            │ Service Call      │
                            ▼                   │
┌─────────────────────────────────────────────────────────────────────┐
│                     ProgressService                                  │
│                                                                       │
│  async completeLesson(studentId, lessonId)                          │
│                                                                       │
│  STEP 1: Fetch Lesson with Course and Enrollment                   │
│  ┌───────────────────────────────────────────────────────────┐     │
│  │ const lesson = await prisma.lesson.findUnique({           │     │
│  │   where: { id: lessonId },                                │     │
│  │   include: {                                              │     │
│  │     module: {                                             │     │
│  │       include: {                                          │     │
│  │         course: {                                         │     │
│  │           include: {                                      │     │
│  │             enrollments: {                                │     │
│  │               where: { studentId, status: 'ACTIVE' }      │     │
│  │             }                                              │     │
│  │           }                                                │     │
│  │         }                                                  │     │
│  │       }                                                    │     │
│  │     }                                                      │     │
│  │   }                                                        │     │
│  │ })                                                         │     │
│  └───────────────────────────────────────────────────────────┘     │
│           │                                                         │
│           ├─ Lesson not found? → throw NotFoundException           │
│           │                                                         │
│           └─ Lesson found ─────────────────────────┐              │
│                                                      │              │
│  STEP 2: Validate Enrollment                       │              │
│  ┌─────────────────────────────────────────────────┼──────────┐   │
│  │ if (!course.enrollments || length === 0)        │          │   │
│  │   throw ForbiddenException                      │          │   │
│  └─────────────────────────────────────────────────┼──────────┘   │
│           │                                         │              │
│           └─ Enrolled ─────────────────────────────┘              │
│                                                                     │
│  STEP 3: Upsert Lesson Progress                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ const lessonProgress = await prisma.lessonProgress.upsert │   │
│  │   where: { studentId_lessonId: { studentId, lessonId } }  │   │
│  │   update: {                                               │   │
│  │     status: COMPLETED,                                    │   │
│  │     completedAt: new Date()                               │   │
│  │   }                                                        │   │
│  │   create: {                                               │   │
│  │     studentId, lessonId,                                  │   │
│  │     status: COMPLETED,                                    │   │
│  │     completedAt: new Date(),                              │   │
│  │     lastPosition: 0,                                      │   │
│  │     watchedDuration: 0                                    │   │
│  │   }                                                        │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  STEP 4: Calculate Course Progress                                │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ const progressPercentage =                                │   │
│  │   await calculateCourseProgress(studentId, courseId)      │   │
│  │                                                            │   │
│  │ Helper method:                                            │   │
│  │ 1. Find all PUBLISHED lessons in course                   │   │
│  │ 2. Count COMPLETED lessons for student                    │   │
│  │ 3. Calculate: (completed / total) × 100                   │   │
│  │ 4. Round to nearest integer                               │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  STEP 5: Update Course Enrollment                                 │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ await prisma.courseEnrollment.update({                    │   │
│  │   where: { id: enrollment.id },                           │   │
│  │   data: {                                                  │   │
│  │     progressPercentage,                                    │   │
│  │     lastAccessedAt: new Date()                            │   │
│  │   }                                                        │   │
│  │ })                                                         │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  STEP 6: Return Result                                            │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ return {                                                   │   │
│  │   lessonProgress: { ...lessonProgress },                  │   │
│  │   courseProgress: {                                       │   │
│  │     courseId,                                             │   │
│  │     progressPercentage                                    │   │
│  │   }                                                        │   │
│  │ }                                                          │   │
│  └───────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            │ Success Response
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Response to Client                              │
│                                                                       │
│  HTTP 200 OK                                                        │
│  {                                                                   │
│    "lessonProgress": {                                              │
│      "id": "uuid",                                                  │
│      "studentId": "uuid",                                           │
│      "lessonId": "uuid",                                            │
│      "status": "COMPLETED",                                         │
│      "lastPosition": 150,                                           │
│      "watchedDuration": 200,                                        │
│      "completedAt": "2024-01-15T10:30:00.000Z",                    │
│      "createdAt": "2024-01-15T09:00:00.000Z",                      │
│      "updatedAt": "2024-01-15T10:30:00.000Z"                       │
│    },                                                                │
│    "courseProgress": {                                              │
│      "courseId": "uuid",                                            │
│      "progressPercentage": 33                                       │
│    }                                                                 │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Error Scenarios

### Scenario 1: Lesson Not Found

```
Request: POST /lessons/invalid-id/complete
         ↓
Service: prisma.lesson.findUnique() returns null
         ↓
Response: 404 Not Found
{
  "statusCode": 404,
  "message": "Lesson with ID invalid-id not found"
}
```

### Scenario 2: Student Not Enrolled

```
Request: POST /lessons/lesson-123/complete
         ↓
Service: Check course.enrollments → Empty array
         ↓
Response: 403 Forbidden
{
  "statusCode": 403,
  "message": "You must be enrolled in this course to complete lessons"
}
```

### Scenario 3: Invalid JWT Token

```
Request: POST /lessons/lesson-123/complete
         Authorization: Bearer invalid-token
         ↓
JwtAuthGuard: Token validation fails
              ↓
Response: 401 Unauthorized
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### Scenario 4: Wrong Role (Not Student)

```
Request: POST /lessons/lesson-123/complete
         Authorization: Bearer <staff-token>
         ↓
RolesGuard: User role is STAFF, not STUDENT
            ↓
Response: 403 Forbidden
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

## Database State Changes

### Before Completion

```
┌─────────────────────────────────────────┐
│ LessonProgress Table                    │
├─────────────────────────────────────────┤
│ studentId: student-123                  │
│ lessonId: lesson-456                    │
│ status: IN_PROGRESS                     │
│ lastPosition: 150                       │
│ watchedDuration: 200                    │
│ completedAt: null                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ CourseEnrollment Table                  │
├─────────────────────────────────────────┤
│ studentId: student-123                  │
│ courseId: course-789                    │
│ progressPercentage: 25                  │
│ lastAccessedAt: 2024-01-15T09:00:00Z   │
└─────────────────────────────────────────┘
```

### After Completion

```
┌─────────────────────────────────────────┐
│ LessonProgress Table                    │
├─────────────────────────────────────────┤
│ studentId: student-123                  │
│ lessonId: lesson-456                    │
│ status: COMPLETED ◄─── Changed          │
│ lastPosition: 150                       │
│ watchedDuration: 200                    │
│ completedAt: 2024-01-15T10:30:00Z ◄─── Set │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ CourseEnrollment Table                  │
├─────────────────────────────────────────┤
│ studentId: student-123                  │
│ courseId: course-789                    │
│ progressPercentage: 33 ◄─── Updated    │
│ lastAccessedAt: 2024-01-15T10:30:00Z ◄─ Updated │
└─────────────────────────────────────────┘
```

## Progress Calculation Example

### Course Structure

```
Course: Introduction to Tax Filing
├─ Module 1: Basics
│  ├─ Lesson 1: Overview [PUBLISHED] ✓ COMPLETED
│  └─ Lesson 2: Concepts [PUBLISHED] ✓ COMPLETED
└─ Module 2: Advanced
   ├─ Lesson 3: Forms [PUBLISHED] ← Just Completed
   ├─ Lesson 4: Filing [PUBLISHED] ○ NOT_STARTED
   ├─ Lesson 5: Review [DRAFT] (excluded)
   └─ Lesson 6: Summary [PUBLISHED] ○ NOT_STARTED
```

### Calculation

```
Total PUBLISHED lessons: 5 (excludes Lesson 5 which is DRAFT)
Completed lessons: 3 (Lessons 1, 2, 3)

Progress = (3 / 5) × 100 = 60%
```

## Integration with Auto-Completion

Both manual and auto-completion use the same `completeLesson()` method:

```
┌─────────────────────────────────────┐
│ Manual Completion                   │
│ POST /lessons/:id/complete          │
│                                     │
│ User clicks "Mark as Complete"     │
└────────────┬────────────────────────┘
             │
             ├─────────────────────┐
             ▼                     ▼
    ┌──────────────────────────────────────┐
    │   completeLesson(studentId, lessonId) │
    │                                        │
    │   Shared logic ensures consistency    │
    └──────────────────────────────────────┘
             ▲                     ▲
             │                     │
┌────────────┴────────────────────┴─────┐
│ Auto-Completion                        │
│ PATCH /lessons/:id/progress            │
│                                        │
│ Video reaches 90% watched             │
│ shouldAutoComplete() returns true     │
└────────────────────────────────────────┘
```

## Security Flow

```
┌─────────────────────────────────────────┐
│ Security Checks                          │
├─────────────────────────────────────────┤
│                                          │
│ 1. JWT Authentication                   │
│    ├─ Token present?                    │
│    ├─ Token valid?                      │
│    ├─ Token not expired?                │
│    └─ Extract userId                    │
│                                          │
│ 2. Role Authorization                   │
│    └─ Is role = STUDENT?                │
│                                          │
│ 3. Data Isolation                       │
│    └─ studentId from token (not params) │
│                                          │
│ 4. Enrollment Validation                │
│    ├─ Student enrolled in course?       │
│    └─ Enrollment status = ACTIVE?       │
│                                          │
│ All checks pass → Allow completion      │
│ Any check fails → Reject with 401/403   │
└─────────────────────────────────────────┘
```

## Performance Characteristics

```
Database Operations:
├─ 1 READ: lesson.findUnique() with nested includes
├─ 1 WRITE: lessonProgress.upsert()
├─ 1 READ: lesson.findMany() for progress calc
├─ 1 READ: lessonProgress.count() for progress calc
└─ 1 WRITE: courseEnrollment.update()

Total: 3 reads + 2 writes = 5 operations

Optimization:
- Uses unique index on (studentId, lessonId)
- Uses upsert pattern (single operation)
- Leverages connection pooling
- Denormalizes progress % for fast retrieval
```

---

This flow diagram shows the complete request lifecycle for Task 34's manual lesson completion endpoint, from client request through all processing steps to final database state changes.
