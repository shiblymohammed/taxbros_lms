# Lesson Progress Tracking Schema Documentation

## Overview

This document describes the `lesson_progress` table schema that tracks student video playback and lesson completion progress for the TAXBROS LMS.

**Task**: Task 31 - Design lesson progress tracking schema  
**Status**: ✅ Complete  
**Migration**: `20261118210612_add_course_management`  
**Requirements**: R20 (Video Playback and Position Tracking), R21 (Lesson Progress Tracking), R22 (Course Progress Dashboard)

---

## Database Schema

### Table: `lesson_progress`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID (text) | NO | uuid() | Primary key |
| `studentId` | UUID (text) | NO | - | Foreign key to students table |
| `lessonId` | UUID (text) | NO | - | Foreign key to lessons table |
| `status` | LessonProgressStatus | NO | 'NOT_STARTED' | Current progress status |
| `lastPosition` | integer | NO | 0 | Last video position in seconds |
| `watchedDuration` | integer | NO | 0 | Total watched time in seconds |
| `completedAt` | timestamp | YES | null | When lesson was completed |
| `createdAt` | timestamp | NO | CURRENT_TIMESTAMP | First view timestamp |
| `updatedAt` | timestamp | NO | - | Last update timestamp |

### Enum: `LessonProgressStatus`

```sql
CREATE TYPE "LessonProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
```

**States:**
- `NOT_STARTED`: Initial state when progress record is created
- `IN_PROGRESS`: Set when student starts video playback
- `COMPLETED`: Set when student watches 90% or manually completes

---

## Indexes

1. **Primary Key**: `lesson_progress_pkey` on `id`
2. **Student Index**: `lesson_progress_studentId_idx` on `studentId`
   - Optimizes queries for all progress of a student
3. **Lesson Index**: `lesson_progress_lessonId_idx` on `lessonId`
   - Optimizes queries for progress across students
4. **Status Index**: `lesson_progress_status_idx` on `status`
   - Optimizes filtering by completion status
5. **Unique Constraint**: `lesson_progress_studentId_lessonId_key` on `(studentId, lessonId)`
   - Ensures one progress record per student per lesson

---

## Foreign Keys

1. **Student Reference**: `lesson_progress_studentId_fkey`
   - References: `students(id)`
   - On Delete: CASCADE
   - On Update: CASCADE

2. **Lesson Reference**: `lesson_progress_lessonId_fkey`
   - References: `lessons(id)`
   - On Delete: CASCADE
   - On Update: CASCADE

---

## Requirements Mapping

### R20: Video Playback and Position Tracking

| Requirement | Implementation | Field |
|-------------|----------------|-------|
| R20.3: Update last_position field | ✅ Supported | `lastPosition` |
| R20.4: Retrieve last_position on reopen | ✅ Supported | `lastPosition` |
| R20.5: Resume playback at saved position | ✅ Supported | `lastPosition` |
| R20.7: Update at 10-second intervals | ✅ Supported | `lastPosition`, `updatedAt` |
| R20.8: Track total watched_duration | ✅ Supported | `watchedDuration` |

### R21: Lesson Progress Tracking

| Requirement | Implementation | Field |
|-------------|----------------|-------|
| R21.1: Create record with NOT_STARTED | ✅ Supported | `status` (default) |
| R21.2: Update to IN_PROGRESS on playback | ✅ Supported | `status` |
| R21.3: Auto-complete at 90% watched | ✅ Supported | `lastPosition` check |
| R21.4: Manual completion support | ✅ Supported | `status` update |
| R21.5: Set completed_at timestamp | ✅ Supported | `completedAt` |
| R21.6: Update course progress % | ✅ Supported | Trigger recalculation |
| R21.9: Display progress status | ✅ Supported | `status` |

### R22: Course Progress Dashboard

| Requirement | Implementation | Query Pattern |
|-------------|----------------|---------------|
| R22.1: Display active enrollments | ✅ Supported | JOIN with course_enrollments |
| R22.4: Display lesson progress status | ✅ Supported | Query by studentId + courseId |
| R22.5: Display next unwatched lesson | ✅ Supported | WHERE status = 'NOT_STARTED' |
| R22.6: Update progress immediately | ✅ Supported | Real-time updates |
| R22.8: Display completion timestamps | ✅ Supported | `completedAt` |

---

## Timestamp Tracking

The schema provides three levels of timestamp tracking:

1. **First View**: `createdAt`
   - Automatically set when progress record is created
   - Represents when student first opened the lesson
   - Immutable after creation

2. **Last Activity**: `updatedAt`
   - Automatically updated by Prisma on every modification
   - Tracks most recent interaction with the lesson
   - Updated every 10 seconds during video playback

3. **Completion**: `completedAt`
   - Explicitly set when status changes to COMPLETED
   - Nullable (NULL for NOT_STARTED and IN_PROGRESS)
   - Used for completion reports and certificates

---

## Business Logic Support

### Auto-Completion at 90%

The schema supports automatic lesson completion:

```typescript
// Check if student has watched 90% of video
if (lastPosition >= lesson.duration * 0.9) {
  await prisma.lessonProgress.update({
    where: { studentId_lessonId: { studentId, lessonId } },
    data: {
      status: 'COMPLETED',
      completedAt: new Date()
    }
  });
  
  // Trigger course progress recalculation
  await updateCourseProgress(studentId, courseId);
}
```

### Course Progress Calculation

Calculate overall course completion percentage:

```typescript
// Count completed lessons
const completedCount = await prisma.lessonProgress.count({
  where: {
    studentId,
    lesson: {
      module: { courseId },
      status: 'PUBLISHED'
    },
    status: 'COMPLETED'
  }
});

// Count total published lessons in course
const totalCount = await prisma.lesson.count({
  where: {
    module: { courseId },
    status: 'PUBLISHED'
  }
});

// Update denormalized progress percentage
const percentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

await prisma.courseEnrollment.update({
  where: { studentId_courseId: { studentId, courseId } },
  data: { progressPercentage: Math.round(percentage) }
});
```

### Position Update (Every 10 seconds)

```typescript
// Frontend calls this endpoint every 10 seconds during playback
await prisma.lessonProgress.upsert({
  where: { studentId_lessonId: { studentId, lessonId } },
  update: {
    lastPosition: position,
    watchedDuration: { increment: 10 }, // Approximate watched time
    status: currentStatus === 'NOT_STARTED' ? 'IN_PROGRESS' : currentStatus
  },
  create: {
    studentId,
    lessonId,
    lastPosition: position,
    watchedDuration: 10,
    status: 'IN_PROGRESS'
  }
});
```

---

## Query Patterns

### Get Student's Progress for a Course

```typescript
const progress = await prisma.lessonProgress.findMany({
  where: {
    studentId,
    lesson: {
      module: {
        courseId
      }
    }
  },
  include: {
    lesson: {
      include: {
        module: true
      }
    }
  },
  orderBy: [
    { lesson: { module: { displayOrder: 'asc' } } },
    { lesson: { displayOrder: 'asc' } }
  ]
});
```

### Get Next Unwatched Lesson

```typescript
const nextLesson = await prisma.lesson.findFirst({
  where: {
    module: { courseId },
    status: 'PUBLISHED',
    lessonProgress: {
      none: {
        studentId,
        status: { in: ['IN_PROGRESS', 'COMPLETED'] }
      }
    }
  },
  include: { module: true },
  orderBy: [
    { module: { displayOrder: 'asc' } },
    { displayOrder: 'asc' }
  ]
});
```

### Get Completion Statistics

```typescript
const stats = await prisma.lessonProgress.groupBy({
  by: ['status'],
  where: {
    studentId,
    lesson: {
      module: { courseId }
    }
  },
  _count: true
});
```

---

## Performance Considerations

1. **Frequent Updates**: Position updates happen every 10 seconds
   - Use database connection pooling
   - Consider batch updates if performance issues arise

2. **Index Usage**: Queries are optimized with indexes
   - Student dashboard: Uses `studentId` index
   - Admin reports: Uses `lessonId` index
   - Filtering: Uses `status` index

3. **Denormalization**: Course progress % is stored in `course_enrollments`
   - Reduces JOIN operations for dashboard
   - Updated only on lesson completion
   - Trade-off: Consistency vs. Performance

4. **Cascade Deletes**: Foreign keys with CASCADE
   - Deleting a student removes all progress records
   - Deleting a lesson removes all progress records
   - Maintains referential integrity automatically

---

## Migration History

**Migration**: `20261118210612_add_course_management`  
**Applied**: ✅ Successfully applied  
**Location**: `apps/api/prisma/migrations/20261118210612_add_course_management/migration.sql`

**Created Tables:**
- ✅ courses
- ✅ course_modules
- ✅ lessons
- ✅ course_enrollments
- ✅ lesson_progress

**Created Enums:**
- ✅ CourseStatus
- ✅ LessonStatus
- ✅ CourseEnrollmentStatus
- ✅ LessonProgressStatus

---

## Testing Notes

### Unit Test Scenarios

1. **Progress Creation**
   - Create progress with NOT_STARTED status
   - Verify createdAt is set
   - Verify unique constraint (studentId, lessonId)

2. **Position Tracking**
   - Update position multiple times
   - Verify lastPosition updates
   - Verify updatedAt changes
   - Verify watchedDuration increments

3. **Status Transitions**
   - NOT_STARTED → IN_PROGRESS on first play
   - IN_PROGRESS → COMPLETED at 90%
   - Verify completedAt is set on completion

4. **Course Progress Calculation**
   - Complete 0/10 lessons → 0%
   - Complete 5/10 lessons → 50%
   - Complete 10/10 lessons → 100%

5. **Edge Cases**
   - Resume at saved position
   - Multiple students, same lesson
   - Unpublished lessons excluded from %
   - Cascade delete on student/lesson removal

### Integration Test Scenarios

1. Watch video to 50% → Check IN_PROGRESS
2. Close and reopen → Verify resume at 50%
3. Watch to 91% → Check auto-completion
4. Verify course progress updated
5. Test concurrent position updates

---

## Conclusion

The `lesson_progress` schema is **production-ready** and fully implements:

✅ Video playback position tracking (R20)  
✅ Lesson progress status tracking (R21)  
✅ Course progress dashboard support (R22)  
✅ Optimized database indexes  
✅ Comprehensive timestamp tracking  
✅ Proper foreign key relationships  
✅ Support for 90% auto-completion logic  
✅ Denormalized course progress percentage  

**Next Task**: Task 32 - Implement video position tracking endpoint

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Author**: TAXBROS LMS Development Team
