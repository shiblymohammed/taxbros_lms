# Quiz/Assessment Schema Design

## Overview

This document describes the database schema design for the quiz and assessment system in the TAXBROS LMS. The schema supports multiple-choice quizzes that can be attached to courses, modules, or lessons, with full tracking of student attempts and scoring.

## Schema Components

### 1. Quiz Model

The `Quiz` model represents an assessment that can be attached at different levels of the course hierarchy.

**Fields:**

- `id` (UUID): Primary key
- `title` (String): Quiz title (required)
- `description` (String?): Optional detailed description
- `attachmentType` (Enum): Where the quiz is attached - COURSE, MODULE, or LESSON
- `courseId` (String?): Set when attachmentType is COURSE
- `moduleId` (String?): Set when attachmentType is MODULE  
- `lessonId` (String?): Set when attachmentType is LESSON
- `passMark` (Int): Minimum score required to pass (required)
- `totalMarks` (Int): Total marks available (required)
- `timeLimit` (Int?): Time limit in minutes (nullable - no limit if null)
- `maxAttempts` (Int?): Maximum attempts allowed (nullable - unlimited if null)
- `status` (Enum): DRAFT, PUBLISHED, or ARCHIVED (default: DRAFT)
- `displayOrder` (Int): Ordering within the parent context (default: 0)
- `createdAt` (DateTime): Timestamp of creation
- `updatedAt` (DateTime): Timestamp of last update
- `createdBy` (String?): User ID of creator

**Relations:**
- One-to-many with `QuizQuestion` (cascade delete)
- One-to-many with `QuizAttempt` (cascade delete)

**Indexes:**
- `courseId` - Fast lookup of course quizzes
- `moduleId` - Fast lookup of module quizzes
- `lessonId` - Fast lookup of lesson quizzes
- `status` - Filter by published/draft status
- `attachmentType` - Filter by attachment level

**Business Rules:**
- Only one of courseId, moduleId, or lessonId should be set based on attachmentType
- Quiz must be PUBLISHED to be visible to students
- Students can only access quizzes in courses they're enrolled in
- passMark should be <= totalMarks

### 2. QuizQuestion Model

The `QuizQuestion` model represents individual multiple-choice questions within a quiz.

**Fields:**

- `id` (UUID): Primary key
- `quizId` (String): Foreign key to Quiz (required)
- `questionText` (String): The question text (required)
- `options` (JSON): Array of option objects with format: `[{ id: string, text: string }]`
- `correctAnswer` (String): ID of the correct option from the options array (required)
- `marks` (Int): Points awarded for correct answer (default: 1)
- `displayOrder` (Int): Order of question in quiz (default: 0)
- `createdAt` (DateTime): Timestamp of creation
- `updatedAt` (DateTime): Timestamp of last update

**Relations:**
- Many-to-one with `Quiz` (parent quiz)

**Indexes:**
- `quizId` - Fast lookup of all questions in a quiz
- `(quizId, displayOrder)` - Efficient ordering of questions within a quiz

**Options JSON Structure:**
```json
[
  { "id": "option_1", "text": "Answer choice A" },
  { "id": "option_2", "text": "Answer choice B" },
  { "id": "option_3", "text": "Answer choice C" },
  { "id": "option_4", "text": "Answer choice D" }
]
```

**Business Rules:**
- options must contain at least 2 options
- correctAnswer must match one of the option IDs in the options array
- correctAnswer field should be removed from API responses for students before submission
- marks should be positive integers

### 3. QuizAttempt Model

The `QuizAttempt` model tracks student submissions and scores.

**Fields:**

- `id` (UUID): Primary key
- `quizId` (String): Foreign key to Quiz (required)
- `studentId` (String): Foreign key to Student (required)
- `answers` (JSON): Array of answer objects with format: `[{ questionId: string, selectedAnswer: string }]`
- `score` (Int): Total marks earned (required)
- `passed` (Boolean): True if score >= passMark (required)
- `startedAt` (DateTime): When the attempt began (default: now)
- `submittedAt` (DateTime): When the attempt was submitted (default: now)
- `createdAt` (DateTime): Record creation timestamp
- `updatedAt` (DateTime): Record update timestamp

**Relations:**
- Many-to-one with `Quiz` (parent quiz)
- Many-to-one with `Student` (student who took the quiz)

**Indexes:**
- `quizId` - Fast lookup of all attempts for a quiz
- `studentId` - Fast lookup of all attempts by a student
- `(quizId, studentId)` - Efficient lookup of student's attempts for a specific quiz

**Answers JSON Structure:**
```json
[
  { "questionId": "uuid-1", "selectedAnswer": "option_2" },
  { "questionId": "uuid-2", "selectedAnswer": "option_1" },
  { "questionId": "uuid-3", "selectedAnswer": "option_4" }
]
```

**Business Rules:**
- All questions must have answers before submission
- Score is calculated by comparing selectedAnswer to correctAnswer for each question
- passed is determined by: score >= quiz.passMark
- If maxAttempts is set, validate student hasn't exceeded limit before allowing submission
- Attempts are immutable after submission (no updates allowed)

## Attachment Model

The quiz system uses a flexible attachment model that allows quizzes to be associated with different levels of the course hierarchy:

### COURSE Level
- Quiz is attached to an entire course
- Visible to all students enrolled in the course
- Typically used for final course assessments
- Example: "Introduction to Taxation - Final Exam"

### MODULE Level
- Quiz is attached to a specific module within a course
- Visible to students enrolled in the parent course
- Typically used for unit/chapter assessments
- Example: "GST Basics - Module Quiz"

### LESSON Level
- Quiz is attached to a specific lesson
- Visible to students enrolled in the parent course
- Typically used for immediate knowledge checks
- Example: "Video Lesson - Quick Check"

## Scoring Logic

### Calculation Flow

1. **Submission Validation:**
   - Verify all questions have answers
   - Check student enrollment in parent course
   - Validate maxAttempts limit (if set)

2. **Score Calculation:**
   ```typescript
   let totalScore = 0;
   for each question in quiz {
     const studentAnswer = attempt.answers.find(a => a.questionId === question.id);
     if (studentAnswer.selectedAnswer === question.correctAnswer) {
       totalScore += question.marks;
     }
   }
   ```

3. **Pass/Fail Determination:**
   ```typescript
   const passed = totalScore >= quiz.passMark;
   ```

4. **Save Attempt:**
   - Store answers, score, and passed status
   - Set submittedAt timestamp
   - Return result with correct answers

## Security Considerations

### Answer Masking
When retrieving quiz questions for students (before submission):
- Remove `correctAnswer` field from all questions
- Only include: questionText, options, marks
- Administrators and staff can see correct answers for review

### Enrollment Validation
Before allowing quiz access or submission:
- Verify student is enrolled in the parent course
- Check enrollment status is ACTIVE
- Validate quiz status is PUBLISHED

### Attempt Limits
- Track attempt count per student per quiz
- Block submissions if maxAttempts exceeded
- Allow unlimited attempts if maxAttempts is null

## Migration Details

**Migration Name:** `20261119104902_add_quiz_schema`

**Changes:**
1. Created QuizAttachmentType enum (COURSE, MODULE, LESSON)
2. Created QuizStatus enum (DRAFT, PUBLISHED, ARCHIVED)
3. Created quizzes table with all fields and indexes
4. Created quiz_questions table with all fields and indexes
5. Created quiz_attempts table with all fields and indexes
6. Added foreign key constraints with CASCADE delete
7. Added relation to students table via quiz_attempts

## Example Usage

### Creating a Quiz

```typescript
// Course-level quiz
const quiz = await prisma.quiz.create({
  data: {
    title: "Introduction to GST - Final Assessment",
    description: "Comprehensive test covering all GST basics",
    attachmentType: "COURSE",
    courseId: "course-uuid",
    passMark: 70,
    totalMarks: 100,
    timeLimit: 60, // 60 minutes
    maxAttempts: 3,
    status: "DRAFT",
  }
});
```

### Adding Questions

```typescript
const question = await prisma.quizQuestion.create({
  data: {
    quizId: quiz.id,
    questionText: "What is the full form of GST?",
    options: [
      { id: "opt_1", text: "Goods and Services Tax" },
      { id: "opt_2", text: "General Sales Tax" },
      { id: "opt_3", text: "Government Service Tax" },
      { id: "opt_4", text: "Goods and Supply Tax" }
    ],
    correctAnswer: "opt_1",
    marks: 5,
    displayOrder: 1,
  }
});
```

### Recording an Attempt

```typescript
const attempt = await prisma.quizAttempt.create({
  data: {
    quizId: quiz.id,
    studentId: student.id,
    answers: [
      { questionId: "question-uuid-1", selectedAnswer: "opt_1" },
      { questionId: "question-uuid-2", selectedAnswer: "opt_3" }
    ],
    score: 85,
    passed: true, // 85 >= 70
    startedAt: new Date("2024-01-10T10:00:00Z"),
    submittedAt: new Date("2024-01-10T10:45:00Z"),
  }
});
```

## Requirements Validation

This schema design validates the following requirements:

- **R23**: Quiz creation with title, description, attachment type, pass mark, time limit, max attempts
- **R24**: Questions with multiple-choice options and correct answer tracking
- **R25**: Student attempt records with answer validation and score calculation
- **R26**: Pass/fail determination based on passing score threshold
- **R23**: Support for multiple attempts with maxAttempts limit
- **R23**: Quiz settings including passing score, time limit, and max attempts

## Next Steps

To complete the quiz/assessment feature:

1. **Task 37**: Implement quiz creation and management API endpoints
2. **Task 38**: Build quiz retrieval endpoint with answer masking for students
3. **Task 39**: Implement quiz submission and scoring endpoint
4. **Task 40**: Build quiz attempt history endpoints
5. **Tasks 44-45**: Create frontend UI for quiz taking and results display

## Database Verification

To verify the migration was applied successfully:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('quizzes', 'quiz_questions', 'quiz_attempts');

-- Check indexes
SELECT indexname, tablename FROM pg_indexes 
WHERE tablename IN ('quizzes', 'quiz_questions', 'quiz_attempts');

-- Verify foreign keys
SELECT conname, conrelid::regclass, confrelid::regclass 
FROM pg_constraint 
WHERE contype = 'f' 
AND conrelid::regclass::text IN ('quiz_questions', 'quiz_attempts');
```
