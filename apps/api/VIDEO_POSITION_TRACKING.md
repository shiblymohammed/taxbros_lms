# Video Position Tracking API Documentation

## Overview
This document describes the video position tracking endpoint implementation for Task 32 of the TAXBROS LMS project.

## Endpoint

### Update Video Playback Position
**PATCH** `/lessons/:lessonId/progress`

Updates the student's current playback position for a video lesson and tracks watched duration.

#### Requirements Implemented
- **R20.3**: Update lastPosition field for that Student and Lesson
- **R20.7**: Update last_position at intervals of at least 10 seconds during playback
- **R20.8**: Track total watched_duration in seconds for each Student and Lesson
- **R21.2**: Update progress status to IN_PROGRESS when playback starts
- **R21.3**: Automatically update progress status to COMPLETED when student watches at least 90% of video duration
- **R2.11**: Validate student enrollment before granting content access

#### Authorization
- **Role**: STUDENT only
- **Access**: Students can only update their own progress
- **Validation**: System verifies student is enrolled in the parent course

#### Request

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Path Parameters:**
- `lessonId` (string, required): UUID of the lesson being watched

**Request Body:**
```json
{
  "position": 120,
  "watchedDuration": 10
}
```

**Body Parameters:**
- `position` (number, required): Current playback position in seconds (must be >= 0)
- `watchedDuration` (number, optional): Incremental watched duration in seconds since last update (must be >= 0)
  - If provided, this value is added to the existing `watchedDuration`
  - If not provided, the system calculates it automatically based on position difference (capped at 10 seconds)

#### Response

**Success (200 OK):**
```json
{
  "lessonProgress": {
    "id": "uuid",
    "studentId": "uuid",
    "lessonId": "uuid",
    "status": "IN_PROGRESS",
    "lastPosition": 120,
    "watchedDuration": 110,
    "completedAt": null,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:32:00Z"
  },
  "autoCompleted": false
}
```

**Auto-Completion Response (200 OK):**
When position reaches 90% of video duration:
```json
{
  "lessonProgress": {
    "id": "uuid",
    "studentId": "uuid",
    "lessonId": "uuid",
    "status": "COMPLETED",
    "lastPosition": 900,
    "watchedDuration": 900,
    "completedAt": "2024-01-15T10:35:00Z",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:35:00Z"
  },
  "courseProgress": {
    "courseId": "uuid",
    "progressPercentage": 25
  },
  "autoCompleted": true
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "statusCode": 400,
  "message": ["position must be a positive number"],
  "error": "Bad Request"
}
```

**401 Unauthorized:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**403 Forbidden:**
```json
{
  "statusCode": 403,
  "message": "You must be enrolled in this course to track progress",
  "error": "Forbidden"
}
```

**404 Not Found:**
```json
{
  "statusCode": 404,
  "message": "Lesson with ID {lessonId} not found",
  "error": "Not Found"
}
```

## Usage Examples

### Example 1: First Position Update
When a student starts watching a video:

**Request:**
```bash
curl -X PATCH https://api.example.com/lessons/lesson-uuid/progress \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "position": 30
  }'
```

**Response:**
- Creates new progress record with status `IN_PROGRESS`
- Sets `lastPosition` to 30
- Sets `watchedDuration` to 30 (assumes watched from 0 to 30)

### Example 2: Regular Position Update (every 10 seconds)
**Request:**
```bash
curl -X PATCH https://api.example.com/lessons/lesson-uuid/progress \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "position": 140,
    "watchedDuration": 10
  }'
```

**Behavior:**
- Updates `lastPosition` from 130 to 140
- Increments `watchedDuration` by 10 seconds
- Maintains status as `IN_PROGRESS`

### Example 3: Auto-Completion at 90% Threshold
For a 1000-second video:

**Request:**
```bash
curl -X PATCH https://api.example.com/lessons/lesson-uuid/progress \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "position": 900
  }'
```

**Behavior:**
- Detects position >= 90% of duration (900 >= 900)
- Automatically completes the lesson
- Sets status to `COMPLETED`
- Sets `completedAt` timestamp
- Recalculates course progress percentage
- Returns `autoCompleted: true`

### Example 4: Position Update After Completion
**Request:**
```bash
curl -X PATCH https://api.example.com/lessons/lesson-uuid/progress \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "position": 500
  }'
```

**Behavior:**
- Detects lesson is already completed
- Does NOT update position or duration
- Returns existing progress record
- Returns `autoCompleted: false`

## Implementation Details

### WatchedDuration Calculation Logic

The system uses intelligent logic to track `watchedDuration`:

1. **Explicit Duration Provided:**
   - If `watchedDuration` is included in request body, use that value
   - Example: Client sends `watchedDuration: 10` every 10 seconds

2. **Automatic Calculation (First Update):**
   - If no existing progress record exists
   - Assumes watched from beginning to current position
   - `watchedIncrement = position`

3. **Automatic Calculation (Subsequent Updates):**
   - If no `watchedDuration` provided but progress exists
   - Calculate difference: `positionDiff = currentPosition - lastPosition`
   - Cap at 10 seconds to handle seeks: `watchedIncrement = min(positionDiff, 10)`
   - This prevents inflated durations from seeking forward

4. **Total Duration Update:**
   - `newWatchedDuration = existingWatchedDuration + watchedIncrement`
   - Stored in database for historical tracking

### Auto-Completion Logic

The system automatically completes a lesson when:
- Current position >= 90% of video duration
- Formula: `(position / duration) * 100 >= 90`
- Example: For 1000-second video, position >= 900 triggers completion

When auto-completion occurs:
1. Lesson status changes to `COMPLETED`
2. `completedAt` timestamp is set
3. Course progress percentage is recalculated
4. Course enrollment's `progressPercentage` is updated
5. Response includes `autoCompleted: true` flag

### Enrollment Verification

Before any position update:
1. System verifies lesson exists
2. Retrieves parent course through module relationship
3. Checks for active enrollment: `courseEnrollment.status = 'ACTIVE'`
4. Returns 403 Forbidden if no active enrollment found

### Completed Lesson Protection

Once a lesson is marked `COMPLETED`:
- Position updates are ignored
- Current progress is returned unchanged
- `autoCompleted` flag is set to false
- This prevents accidental status changes

## Frontend Integration Guide

### Recommended Update Interval
- Send position updates every 10 seconds during playback
- Use debouncing to avoid excessive API calls
- Handle network errors gracefully with retry logic

### Sample React Hook
```typescript
import { useEffect, useRef } from 'react';
import axios from 'axios';

export function useVideoProgress(lessonId: string, playerRef: any) {
  const lastUpdateTime = useRef<number>(0);
  const lastPosition = useRef<number>(0);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!playerRef.current) return;

      const currentPosition = Math.floor(playerRef.current.getCurrentTime());
      const currentTime = Date.now();
      const timeDiff = (currentTime - lastUpdateTime.current) / 1000;

      // Only update if at least 10 seconds have passed
      if (timeDiff >= 10) {
        try {
          await axios.patch(`/lessons/${lessonId}/progress`, {
            position: currentPosition,
            watchedDuration: Math.min(timeDiff, 10),
          });

          lastUpdateTime.current = currentTime;
          lastPosition.current = currentPosition;
        } catch (error) {
          console.error('Failed to update progress:', error);
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [lessonId]);
}
```

## Testing

Unit tests are provided in `progress.service.spec.ts` covering:
- ✅ First position update creates progress with correct watchedDuration
- ✅ Subsequent updates increment watchedDuration correctly
- ✅ Explicit watchedDuration parameter is respected
- ✅ Auto-completion at 90% threshold
- ✅ Completed lessons don't update position
- ✅ Enrollment verification
- ✅ Error handling for missing lessons

## Related Endpoints

- **GET** `/lessons/:lessonId/progress` - Retrieve current progress (Task 35)
- **POST** `/lessons/:lessonId/complete` - Manual completion (Task 34)
- **GET** `/courses/:courseId/progress` - Get all lesson progress in course
- **GET** `/students/:studentId/progress` - Get all progress for student

## Database Schema

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

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  lesson  Lesson  @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([studentId, lessonId])
  @@index([studentId])
  @@index([lessonId])
  @@index([status])
}
```

## Completion Checklist

✅ **Task 32 Requirements:**
- [x] PATCH /lessons/:lessonId/progress endpoint implemented
- [x] Accept { position: number, watchedDuration?: number } in request body
- [x] Validate student is enrolled in parent course
- [x] Upsert LessonProgress with new lastPosition
- [x] Set status to IN_PROGRESS if NOT_STARTED
- [x] Increment watchedDuration (R20.8)
- [x] Check if position >= (duration × 0.9) for auto-completion
- [x] Proper authorization (students can only update their own progress)
- [x] Error handling and validation

✅ **Additional Features:**
- [x] Intelligent watchedDuration calculation
- [x] Protection against position updates for completed lessons
- [x] Course progress percentage recalculation on completion
- [x] Comprehensive unit tests
- [x] Clear API documentation
