# Course Management Schema Documentation

## Overview

This document describes the database schema design for the course management system in TAXBROS LMS. The schema supports video-based learning with structured courses, modules, and lessons, along with progress tracking for student enrollments.

## Schema Design

### Entity Relationship Overview

```
Course (1) ──< (N) CourseModule (1) ──< (N) Lesson
   │                                           │
   │                                           │
   │ (N)                                    (N)│
   │                                           │
   └──< CourseEnrollment >──(1) Student (1) >─┴─ LessonProgress
```

## Core Models

### 1. Course

The top-level container for learning content.

**Schema:**
```prisma
model Course {
  id           String       @id @default(uuid())
  title        String
  description  String?
  coverImage   String?      // File path to course cover image
  status       CourseStatus @default(DRAFT)
  displayOrder Int          @default(0)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  createdBy    String?

  // Relations
  modules     CourseModule[]
  enrollments CourseEnrollment[]
}

enum CourseStatus {
  DRAFT      // Not visible to students
  PUBLISHED  // Visible to enrolled students
  ARCHIVED   // Hidden from all operations
}
```

**Key Features:**
- **Status-based visibility**: Only PUBLISHED courses are visible to students
- **Display ordering**: Courses can be sorted using displayOrder field
- **Cover images**: Supports local file storage with path reference (max 2MB, resized to 1200px)
- **Soft archival**: ARCHIVED status preserves data while hiding the course

**Indexes:**
- `status` - For filtering published courses
- `displayOrder` - For sorting course lists

**Validates Requirements:** R15, R16

---

### 2. CourseModule

Organizes lessons into logical sections within a course.

**Schema:**
```prisma
model CourseModule {
  id           String   @id @default(uuid())
  courseId     String
  title        String
  description  String?
  displayOrder Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  course  Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  lessons Lesson[]
}
```

**Key Features:**
- **Hierarchical structure**: Modules belong to courses and contain lessons
- **Cascade deletion**: Deleting a course removes all its modules
- **Ordered display**: Modules are sorted by displayOrder within each course

**Indexes:**
- `courseId` - For retrieving all modules in a course
- `(courseId, displayOrder)` - Composite index for sorted module retrieval

**Validates Requirements:** R17

---

### 3. Lesson

Individual learning units containing YouTube videos.

**Schema:**
```prisma
model Lesson {
  id           String       @id @default(uuid())
  moduleId     String
  title        String
  description  String?
  videoUrl     String       // YouTube URL (youtube.com/watch or youtu.be)
  duration     Int?         // Duration in seconds
  status       LessonStatus @default(DRAFT)
  displayOrder Int          @default(0)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  // Relations
  module         CourseModule     @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  lessonProgress LessonProgress[]
}

enum LessonStatus {
  DRAFT      // Not visible to students
  PUBLISHED  // Visible to enrolled students
}
```

**Key Features:**
- **Independent publishing**: Lessons can be published independently of course status
- **YouTube integration**: Stores YouTube URLs for video embedding
- **Optional duration**: Duration in seconds for progress calculation
- **Cascade deletion**: Deleting a module removes all its lessons

**Business Rules:**
- A lesson is visible only if both the lesson AND its parent course are PUBLISHED
- Only PUBLISHED lessons count toward course completion percentage

**Indexes:**
- `moduleId` - For retrieving all lessons in a module
- `(moduleId, displayOrder)` - Composite index for sorted lesson retrieval
- `status` - For filtering published lessons

**Validates Requirements:** R18, R19

---

### 4. CourseEnrollment

Tracks student enrollment in courses with progress metrics.

**Schema:**
```prisma
model CourseEnrollment {
  id                 String                 @id @default(uuid())
  studentId          String
  courseId           String
  status             CourseEnrollmentStatus @default(ACTIVE)
  progressPercentage Int                    @default(0)
  lastAccessedAt     DateTime?
  enrolledAt         DateTime               @default(now())
  createdAt          DateTime               @default(now())
  updatedAt          DateTime               @updatedAt

  // Relations
  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  course  Course  @relation(fields: [courseId], references: [id], onDelete: Cascade)

  // Constraints
  @@unique([studentId, courseId])
}

enum CourseEnrollmentStatus {
  ACTIVE     // Currently enrolled and can access content
  DROPPED    // Withdrawn from course
  COMPLETED  // Finished the course
}
```

**Key Features:**
- **Unique enrollments**: One enrollment record per student-course pair
- **Progress tracking**: Denormalized progressPercentage for quick access
- **Status management**: ACTIVE enrollments grant content access
- **Historical records**: DROPPED enrollments retain progress data

**Progress Calculation Formula:**
```
progressPercentage = 100 × (completed lessons) / (total published lessons)
```

**Access Rules:**
- Students can only access content if enrollment status is ACTIVE
- Students can only access lessons from PUBLISHED courses
- Students can only access PUBLISHED lessons

**Indexes:**
- `studentId` - For retrieving all courses a student is enrolled in
- `courseId` - For retrieving all students enrolled in a course
- `status` - For filtering active enrollments
- `(studentId, courseId)` - Unique constraint to prevent duplicates

**Validates Requirements:** R5, R22

---

### 5. LessonProgress

Tracks individual student progress through lessons.

**Schema:**
```prisma
model LessonProgress {
  id              String               @id @default(uuid())
  studentId       String
  lessonId        String
  status          LessonProgressStatus @default(NOT_STARTED)
  lastPosition    Int                  @default(0) // Position in seconds
  watchedDuration Int                  @default(0) // Total watched time in seconds
  completedAt     DateTime?
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt

  // Relations
  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  lesson  Lesson  @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  // Constraints
  @@unique([studentId, lessonId])
}

enum LessonProgressStatus {
  NOT_STARTED  // Lesson not yet opened
  IN_PROGRESS  // Video playback started
  COMPLETED    // Lesson marked complete
}
```

**Key Features:**
- **Video position tracking**: Saves playback position for resume functionality
- **Watch duration**: Tracks cumulative watched time
- **Completion tracking**: Records when lesson was completed
- **Auto-completion**: System marks COMPLETED when 90% watched

**Progress State Transitions:**
1. `NOT_STARTED` → `IN_PROGRESS`: When playback starts
2. `IN_PROGRESS` → `COMPLETED`: When 90% watched or manually completed
3. `COMPLETED` is a final state (no transitions out)

**Update Frequency:**
- Position updates: Every 10 seconds during playback
- Completion check: On each position update

**Indexes:**
- `studentId` - For retrieving all progress for a student
- `lessonId` - For retrieving all student progress for a lesson
- `status` - For filtering completed lessons
- `(studentId, lessonId)` - Unique constraint to prevent duplicates

**Validates Requirements:** R20, R21, R22

---

## Data Integrity Rules

### Cascade Deletion Behavior

1. **Course → CourseModule → Lesson**: Deleting a course cascades to all modules and lessons
2. **Course → CourseEnrollment**: Deleting a course removes all enrollments
3. **Student → CourseEnrollment**: Deleting a student removes all enrollments
4. **Student → LessonProgress**: Deleting a student removes all progress records
5. **Lesson → LessonProgress**: Deleting a lesson removes all progress records

### Uniqueness Constraints

1. **CourseEnrollment**: `(studentId, courseId)` must be unique
2. **LessonProgress**: `(studentId, lessonId)` must be unique

### Default Values

- New courses: `status = DRAFT`, `displayOrder = 0`
- New lessons: `status = DRAFT`, `displayOrder = 0`
- New enrollments: `status = ACTIVE`, `progressPercentage = 0`
- New progress: `status = NOT_STARTED`, `lastPosition = 0`, `watchedDuration = 0`

---

## Access Control Considerations

### Student Access Rules

Students can only access content when ALL conditions are met:
1. Student has an ACTIVE enrollment in the course
2. The course status is PUBLISHED
3. The lesson status is PUBLISHED

### Progress Calculation Rules

1. Only PUBLISHED lessons are counted in the denominator
2. Progress updates when a lesson status changes to COMPLETED
3. Unpublishing a lesson excludes it from calculation but preserves completion status
4. Course progress = 100 × (completed published lessons) / (total published lessons)

### Permission Requirements

- **MANAGE_COURSES** permission required for:
  - Creating/updating courses
  - Publishing/unpublishing courses
  - Creating/updating modules and lessons
  - Managing enrollments

- **No special permission** required for:
  - Students viewing their enrolled courses
  - Students tracking their own progress
  - Students watching lesson videos

---

## Migration Information

**Migration Name:** `20261118210612_add_course_management`

**Tables Created:**
- `courses`
- `course_modules`
- `lessons`
- `course_enrollments`
- `lesson_progress`

**Enums Created:**
- `CourseStatus` (DRAFT, PUBLISHED, ARCHIVED)
- `LessonStatus` (DRAFT, PUBLISHED)
- `CourseEnrollmentStatus` (ACTIVE, DROPPED, COMPLETED)
- `LessonProgressStatus` (NOT_STARTED, IN_PROGRESS, COMPLETED)

**Foreign Keys:**
- `course_modules.courseId` → `courses.id` (CASCADE)
- `lessons.moduleId` → `course_modules.id` (CASCADE)
- `course_enrollments.studentId` → `students.id` (CASCADE)
- `course_enrollments.courseId` → `courses.id` (CASCADE)
- `lesson_progress.studentId` → `students.id` (CASCADE)
- `lesson_progress.lessonId` → `lessons.id` (CASCADE)

---

## Related Requirements

- **R15**: Course Creation and Management
- **R16**: Course Publishing
- **R17**: Module Management
- **R18**: Lesson Creation and Management
- **R19**: Lesson Publishing
- **R20**: Video Playback and Position Tracking
- **R21**: Lesson Progress Tracking
- **R22**: Course Progress Dashboard
- **R5**: Course Enrollment Management

---

## Next Implementation Steps

With the schema in place, the following implementation tasks can proceed:

1. **Task 26**: Implement course CRUD endpoints
2. **Task 27**: Implement course cover image upload
3. **Task 28**: Build module management endpoints
4. **Task 29**: Build lesson management endpoints
5. **Task 30**: Implement course enrollment endpoints
6. **Task 31**: Already complete (schema designed in this task)
7. **Task 32**: Implement video position tracking endpoint
8. **Task 33**: Implement lesson completion logic
9. **Task 34**: Build manual lesson completion endpoint
10. **Task 35**: Create lesson progress retrieval endpoint

---

## Database Performance Considerations

### Index Strategy

All performance-critical queries are covered by indexes:
- Course listing: `courses.status`, `courses.displayOrder`
- Module retrieval: `course_modules.(courseId, displayOrder)`
- Lesson retrieval: `lessons.(moduleId, displayOrder)`, `lessons.status`
- Enrollment queries: `course_enrollments.studentId`, `course_enrollments.courseId`
- Progress tracking: `lesson_progress.studentId`, `lesson_progress.lessonId`

### Query Optimization Tips

1. **Course listing**: Use `status` index to filter PUBLISHED courses
2. **Nested course data**: Use Prisma's `include` to fetch modules and lessons in one query
3. **Progress calculation**: Query only PUBLISHED lessons with completed progress records
4. **Student dashboard**: Use `courseId` index with student filter for efficient retrieval

### Connection Pooling

The schema is designed for efficient connection usage:
- Read operations can be distributed across read replicas
- Write operations are focused on progress updates (high frequency)
- Cascade deletes minimize orphaned records

---

## Testing Recommendations

### Schema Validation Tests
- [x] Verify all tables created successfully
- [x] Verify all indexes created
- [x] Verify foreign key constraints
- [x] Verify unique constraints

### Business Logic Tests (To be implemented in subsequent tasks)
- [ ] Course publishing workflow
- [ ] Lesson completion triggers
- [ ] Progress percentage calculation
- [ ] Access control enforcement
- [ ] Cascade deletion behavior

---

## Conclusion

The course management schema provides a solid foundation for video-based learning in TAXBROS LMS. The design follows these principles:

1. **Hierarchical organization**: Course → Module → Lesson structure
2. **Status-based visibility**: Independent publishing controls
3. **Progress tracking**: Granular lesson-level progress with course-level aggregation
4. **Data integrity**: Proper foreign keys and cascade behavior
5. **Performance**: Strategic indexes for common query patterns
6. **Scalability**: Normalized design with denormalized progress for performance

The schema is now ready for API endpoint implementation in subsequent tasks.
