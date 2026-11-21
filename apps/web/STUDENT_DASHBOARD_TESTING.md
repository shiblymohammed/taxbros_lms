# Student Dashboard Testing Guide

## Overview
This document provides manual testing instructions for Task 41: Student Dashboard with Course Progress.

## Features Implemented

### 1. Course Display with Progress
- **Location**: `/student/dashboard`
- **Features**:
  - Displays all enrolled courses with cover images
  - Shows progress percentage per course
  - Visual progress bar
  - Completion status (X of Y lessons completed)

### 2. Continue Learning Button
- **Feature**: Navigate to next unwatched lesson
- **Logic**: 
  - Finds the first lesson with status NOT_STARTED or IN_PROGRESS
  - If no next lesson exists, navigates to course page
  - Button text changes based on progress:
    - "Start Course" (0% progress)
    - "Continue Learning" (>0% progress)

### 3. Next Lesson Preview
- **Feature**: Shows preview of next lesson in course card
- **Display**:
  - Icon indicator (PlayCircle)
  - "Up Next:" label
  - Lesson title
  - Styled in blue highlight box

### 4. Available Quizzes Section
- **Location**: Below courses, before completed courses
- **Features**:
  - Lists all published quizzes in enrolled courses
  - Quiz cards show:
    - Quiz title and course name
    - Total marks and pass mark
    - Time limit (if set)
    - Status badge (New / In Progress / Passed)
    - Trophy icon for passed quizzes

### 5. Quiz Attempt Summary
- **Features**:
  - Best score display
  - Attempt count
  - Passed attempts count
  - Button text changes based on status:
    - "Take Quiz" (no attempts)
    - "Retake Quiz" (attempted but not passed)
    - "Review Quiz" (passed)

### 6. Completed Courses Section
- **Location**: At bottom of dashboard
- **Features**:
  - Shows courses with COMPLETED status
  - Marked with checkmark
  - "Review Course" button

## Testing Checklist

### Prerequisites
1. Ensure API server is running (`npm run dev` in `apps/api`)
2. Ensure web server is running (`npm run dev` in `apps/web`)
3. Have a test student account created
4. Have at least one course with lessons enrolled
5. Have at least one published quiz attached to an enrolled course

### Test Cases

#### TC1: Dashboard Load
- [ ] Navigate to `/student/dashboard`
- [ ] Verify loading spinner appears initially
- [ ] Verify student name appears in welcome message
- [ ] Verify "My Courses" section appears

#### TC2: Course Card Display
- [ ] Verify course cover image displays (or gradient fallback)
- [ ] Verify course title is visible
- [ ] Verify "X of Y lessons completed" text
- [ ] Verify progress percentage displays
- [ ] Verify progress bar visual matches percentage

#### TC3: Next Lesson Preview
- [ ] Start a course but don't complete all lessons
- [ ] Verify "Up Next:" preview box appears
- [ ] Verify next lesson title is shown
- [ ] Verify clicking preview navigates to that lesson

#### TC4: Continue Learning Button
- [ ] For 0% progress course: Verify button says "Start Course"
- [ ] For partial progress: Verify button says "Continue Learning"
- [ ] Click button and verify navigation to next lesson
- [ ] If all lessons complete: Verify navigation to course page

#### TC5: Available Quizzes Display
- [ ] Create a published quiz attached to enrolled course
- [ ] Verify "Available Quizzes" section appears
- [ ] Verify quiz card shows correct title
- [ ] Verify course name appears below title
- [ ] Verify total marks and pass mark display
- [ ] Verify "New" badge for unattempted quiz

#### TC6: Quiz Attempt Summary
- [ ] Take a quiz and score below pass mark
- [ ] Return to dashboard
- [ ] Verify "In Progress" badge appears
- [ ] Verify best score shows (X/Y format)
- [ ] Verify attempt count shows
- [ ] Verify "Retake Quiz" button appears

#### TC7: Quiz Passed Status
- [ ] Take a quiz and score above pass mark
- [ ] Return to dashboard
- [ ] Verify "Passed" badge appears in green
- [ ] Verify trophy icon appears
- [ ] Verify passed count shows
- [ ] Verify "Review Quiz" button appears

#### TC8: Completed Courses
- [ ] Complete all lessons in a course (mark enrollment COMPLETED)
- [ ] Refresh dashboard
- [ ] Verify course appears in "Completed Courses" section
- [ ] Verify checkmark appears in description
- [ ] Verify "Review Course" button appears

#### TC9: No Courses State
- [ ] Create student with no course enrollments
- [ ] Navigate to dashboard
- [ ] Verify empty state message displays
- [ ] Verify message says "Contact your administrator to enroll"

#### TC10: Error Handling
- [ ] Stop API server
- [ ] Refresh dashboard
- [ ] Verify error message appears
- [ ] Verify error is user-friendly

#### TC11: Responsive Design
- [ ] Test on desktop (1920x1080)
  - [ ] Verify 3-column grid for courses
  - [ ] Verify 3-column grid for quizzes
- [ ] Test on tablet (768px)
  - [ ] Verify 2-column grid
- [ ] Test on mobile (375px)
  - [ ] Verify single column layout
  - [ ] Verify cards stack vertically
  - [ ] Verify touch targets are adequate

## API Endpoints Used

### Student Progress
- `GET /auth/me` - Get current user
- `GET /students?userId={userId}` - Get student profile
- `GET /students/{studentId}/progress` - Get course enrollments with progress

### Course Progress
- `GET /courses/{courseId}/progress` - Get lessons with completion status

### Quizzes
- `GET /quizzes?status=PUBLISHED` - Get available quizzes
- `GET /quizzes/{quizId}/attempts` - Get quiz attempt history

## Expected Results

### Performance
- Dashboard should load within 2 seconds on good connection
- All course cards should render simultaneously
- Quiz section should load after courses (progressive enhancement)

### Data Accuracy
- Progress percentages should match backend calculation
- Next lesson should be first non-completed lesson
- Quiz best scores should show highest attempt score
- Attempt counts should be accurate

### UX
- Clickable areas should be obvious (hover effects)
- Loading states should be visible during data fetch
- Empty states should be informative
- Navigation should be intuitive

## Known Limitations

1. **Quiz Filtering**: Currently only shows quizzes with direct course attachment. Module and lesson quizzes need additional logic to trace back to enrolled courses.

2. **Performance**: Multiple API calls for course progress. Could be optimized with a single endpoint that returns all dashboard data.

3. **Caching**: No caching implemented. Each dashboard visit makes fresh API calls.

## Troubleshooting

### Issue: Quizzes not showing
- **Check**: Is quiz status PUBLISHED?
- **Check**: Is quiz attached to an enrolled course?
- **Check**: Does student have ACTIVE enrollment?

### Issue: Next lesson not showing
- **Check**: Are all lessons completed?
- **Check**: Is there at least one published lesson?
- **Check**: Is course progress API returning lesson data?

### Issue: Progress not updating
- **Check**: Is progress API being called after lesson completion?
- **Check**: Is course enrollment progressPercentage being updated?
- **Check**: Are you looking at cached data? (Hard refresh: Ctrl+Shift+R)

## Requirements Validation

### R22: Course Progress Dashboard
- ✅ Student views dashboard with course enrollments
- ✅ Display course title, cover image, progress percentage
- ✅ Display published modules and lessons
- ✅ Display lesson progress status
- ✅ Display next unwatched lesson

### R26: Quiz attempt history
- ✅ Display available quizzes
- ✅ Show quiz attempt summary
- ✅ Display best score
- ✅ Display passed count
- ✅ Show attempt count

## Test Coverage

### T4: Student view tests
- Course enrollment display
- Progress tracking
- Next lesson navigation
- Course completion status

### T5: Student quiz tests  
- Available quizzes list
- Quiz attempt summary
- Best score display
- Passed/failed indicators
