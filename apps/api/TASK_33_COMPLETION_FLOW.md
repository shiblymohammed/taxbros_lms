# Task 33: Lesson Completion Flow Diagram

## Complete Workflow

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                     LESSON COMPLETION WORKFLOW                   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

                    ┌──────────────────────┐
                    │   Student Action     │
                    └──────────┬───────────┘
                               │
                    ┌──────────┴───────────┐
                    │                      │
         ┌──────────▼──────────┐  ┌───────▼────────────┐
         │  Watch Video to     │  │ Click "Mark as     │
         │  90% Completion     │  │  Complete" Button  │
         └──────────┬──────────┘  └───────┬────────────┘
                    │                     │
         ┌──────────▼──────────┐          │
         │  updatePosition()   │          │
         │  - position >= 90%? │          │
         │  - duration × 0.9   │          │
         └──────────┬──────────┘          │
                    │                     │
                    │ YES (Auto)          │ (Manual)
                    │                     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────────────────┐
                    │   completeLesson(studentId,     │
                    │          lessonId)               │
                    └──────────┬──────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
     ┌──────────▼────────┐     │    ┌────────▼────────┐
     │ Verify Lesson     │     │    │ Verify Student  │
     │ Exists            │     │    │ Enrollment      │
     └──────────┬────────┘     │    └────────┬────────┘
                │              │             │
                │    ✓ Valid   │   ✓ Valid  │
                └──────────────┴─────────────┘
                               │
                    ┌──────────▼──────────────────────┐
                    │   UPDATE LessonProgress          │
                    │   - status = COMPLETED           │
                    │   - completedAt = now()          │
                    └──────────┬──────────────────────┘
                               │
                    ┌──────────▼──────────────────────┐
                    │   calculateCourseProgress()      │
                    └──────────┬──────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
  ┌────────▼────────┐  ┌───────▼──────┐  ┌───────▼────────┐
  │ Query Published │  │ Count Student│  │ Calculate %    │
  │ Lessons in      │  │ Completed    │  │ Round to int   │
  │ Course          │  │ Lessons      │  │                │
  └────────┬────────┘  └───────┬──────┘  └───────┬────────┘
           │                   │                  │
           │    Total = N      │  Completed = M   │
           └───────────────────┴──────────────────┘
                               │
                    ┌──────────▼──────────────────────┐
                    │   Progress % = (M / N) × 100    │
                    │   Example: (2 / 3) × 100 = 67%  │
                    └──────────┬──────────────────────┘
                               │
                    ┌──────────▼──────────────────────┐
                    │   UPDATE CourseEnrollment        │
                    │   - progressPercentage = %       │
                    │   - lastAccessedAt = now()       │
                    └──────────┬──────────────────────┘
                               │
                    ┌──────────▼──────────────────────┐
                    │   Return Result                  │
                    │   - lessonProgress               │
                    │   - courseProgress               │
                    │   - autoCompleted flag           │
                    └──────────────────────────────────┘
```

## Auto-Completion Decision Tree

```
                        Video Position Update
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │ Is lesson already      │
                    │ COMPLETED?             │
                    └────┬──────────────┬────┘
                         │ YES          │ NO
                         ▼              ▼
              ┌─────────────────┐  ┌──────────────┐
              │ Return current  │  │ Continue     │
              │ status, don't   │  │ processing   │
              │ update          │  │              │
              └─────────────────┘  └──────┬───────┘
                                          │
                              ┌───────────▼────────────┐
                              │ Does lesson have       │
                              │ duration set?          │
                              └───┬──────────────┬─────┘
                                  │ NO           │ YES
                                  ▼              ▼
                         ┌────────────────┐  ┌──────────────────┐
                         │ Don't auto-    │  │ Calculate watch  │
                         │ complete       │  │ percentage:      │
                         │                │  │ (pos/dur) × 100  │
                         └────────────────┘  └──────┬───────────┘
                                                    │
                                        ┌───────────▼───────────┐
                                        │ Is percentage >= 90?  │
                                        └───┬──────────────┬────┘
                                            │ NO           │ YES
                                            ▼              ▼
                                   ┌────────────────┐  ┌──────────────┐
                                   │ Update position│  │ TRIGGER      │
                                   │ and duration   │  │ completeLesson│
                                   │ only           │  │              │
                                   │ status =       │  │ status =     │
                                   │ IN_PROGRESS    │  │ COMPLETED    │
                                   └────────────────┘  └──────────────┘
```

## Course Progress Calculation

```
┌─────────────────────────────────────────────────────────────────┐
│              CALCULATE COURSE PROGRESS PERCENTAGE                │
└─────────────────────────────────────────────────────────────────┘

Step 1: Query Published Lessons
┌──────────────────────────────────────┐
│ SELECT * FROM Lesson                 │
│ WHERE module.courseId = :courseId    │
│   AND status = 'PUBLISHED'           │
└──────────────┬───────────────────────┘
               │
               ▼
        Total = N lessons

Step 2: Count Completed Lessons
┌──────────────────────────────────────┐
│ SELECT COUNT(*) FROM LessonProgress  │
│ WHERE studentId = :studentId         │
│   AND lessonId IN (...)              │
│   AND status = 'COMPLETED'           │
└──────────────┬───────────────────────┘
               │
               ▼
        Completed = M lessons

Step 3: Calculate Percentage
┌──────────────────────────────────────┐
│ IF Total == 0                        │
│   RETURN 0                           │
│ ELSE                                 │
│   RETURN ROUND((M / N) × 100)        │
└──────────────────────────────────────┘

Examples:
  0/3 completed = ROUND(0/3 × 100) = 0%
  1/3 completed = ROUND(1/3 × 100) = 33%
  2/3 completed = ROUND(2/3 × 100) = 67%
  3/3 completed = ROUND(3/3 × 100) = 100%
  
  1/4 completed = ROUND(1/4 × 100) = 25%
  2/5 completed = ROUND(2/5 × 100) = 40%
  7/10 completed = ROUND(7/10 × 100) = 70%
```

## State Transitions

```
Lesson Progress Status Flow:
┌─────────────┐    First Video    ┌─────────────┐    90% Reached    ┌──────────────┐
│ NOT_STARTED ├───── Play ──────► │ IN_PROGRESS ├──── OR Manual ───►│  COMPLETED   │
└─────────────┘                   └─────────────┘      Complete     └──────────────┘
                                         │                                   │
                                         └───────── Resume ──────────────────┘
                                                    (No change)

Course Enrollment Progress Percentage:
┌──────────────────────────────────────────────────────────────────┐
│  0% ────► 33% ────► 67% ────► 100%                              │
│   │         │         │          │                                │
│  No       1 of 3    2 of 3    All lessons                        │
│ lessons   complete  complete  complete                           │
└──────────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
                    completeLesson()
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │ Lesson     │  │ Student    │  │ Enrollment │
    │ Exists?    │  │ Exists?    │  │ Valid?     │
    └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
          │ NO            │ NO            │ NO
          ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Throw        │ │ Throw        │ │ Throw        │
    │ NotFound     │ │ NotFound     │ │ Forbidden    │
    │ Exception    │ │ Exception    │ │ Exception    │
    │ 404          │ │ 404          │ │ 403          │
    └──────────────┘ └──────────────┘ └──────────────┘
```

## Key Methods Relationship

```
┌───────────────────────────────────────────────────────────────┐
│                     ProgressService                            │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌────────────────────────────────────────────────────┐      │
│  │  updatePosition(lessonId, studentId, dto)          │      │
│  │  ┌──────────────────────────────────────────────┐ │      │
│  │  │ 1. Check if already completed                │ │      │
│  │  │ 2. Update position and watchedDuration       │ │      │
│  │  │ 3. IF shouldAutoComplete(pos, duration)      │ │      │
│  │  │    THEN call completeLesson() ────────────┐  │ │      │
│  │  └──────────────────────────────────────────┘ │  │ │      │
│  └────────────────────────────────────────────────┼──┘ │      │
│                                                    │    │      │
│  ┌────────────────────────────────────────────────▼──┐ │      │
│  │  completeLesson(studentId, lessonId)            │ │      │
│  │  ┌──────────────────────────────────────────┐   │ │      │
│  │  │ 1. Verify lesson and enrollment          │   │ │      │
│  │  │ 2. Set status = COMPLETED                │   │ │      │
│  │  │ 3. Set completedAt = now()               │   │ │      │
│  │  │ 4. Call calculateCourseProgress() ───────┼─┐ │ │      │
│  │  │ 5. Update CourseEnrollment               │ │ │ │      │
│  │  └──────────────────────────────────────────┘ │ │ │      │
│  └────────────────────────────────────────────────┼─┘ │      │
│                                                    │   │      │
│  ┌────────────────────────────────────────────────▼─┐ │      │
│  │  calculateCourseProgress(studentId, courseId)  │ │      │
│  │  ┌──────────────────────────────────────────┐  │ │      │
│  │  │ 1. Query published lessons               │  │ │      │
│  │  │ 2. Count completed lessons               │  │ │      │
│  │  │ 3. Calculate: (completed / total) × 100  │  │ │      │
│  │  │ 4. Round to integer                      │  │ │      │
│  │  │ 5. Return percentage                     │  │ │      │
│  │  └──────────────────────────────────────────┘  │ │      │
│  └─────────────────────────────────────────────────┘ │      │
│                                                       │      │
│  ┌─────────────────────────────────────────────────┐ │      │
│  │  shouldAutoComplete(position, duration)         │ │      │
│  │  Helper method for 90% threshold check          │ │      │
│  └─────────────────────────────────────────────────┘ │      │
│                                                        │      │
└────────────────────────────────────────────────────────┘      
```

## Database Updates During Completion

```
When lesson is completed, TWO tables are updated:

┌─────────────────────────────────────────────────────────┐
│ 1. LessonProgress Table                                 │
├─────────────────────────────────────────────────────────┤
│ UPDATE LessonProgress                                   │
│ SET status = 'COMPLETED',                               │
│     completedAt = CURRENT_TIMESTAMP                     │
│ WHERE studentId = ? AND lessonId = ?                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 2. CourseEnrollment Table                               │
├─────────────────────────────────────────────────────────┤
│ UPDATE CourseEnrollment                                 │
│ SET progressPercentage = ?,  -- Calculated value        │
│     lastAccessedAt = CURRENT_TIMESTAMP                  │
│ WHERE id = ?                                            │
└─────────────────────────────────────────────────────────┘

Why denormalize progressPercentage?
✓ Performance: Dashboard loads are fast (no recalculation)
✓ Simplicity: Single query to get all enrollments with progress
✓ Consistency: Always in sync when completion happens
```
