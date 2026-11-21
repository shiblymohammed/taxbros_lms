# Quiz Schema Entity Relationship Diagram

## Overview
This document provides a visual representation of the quiz/assessment schema and its relationships with other entities in the TAXBROS LMS.

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         COURSE HIERARCHY                                 │
└─────────────────────────────────────────────────────────────────────────┘

     ┌──────────────┐
     │   Course     │
     │──────────────│
     │ id (PK)      │
     │ title        │
     │ status       │
     └──────┬───────┘
            │
            │ 1:N
            ▼
     ┌──────────────┐
     │CourseModule  │
     │──────────────│
     │ id (PK)      │
     │ courseId(FK) │
     │ title        │
     └──────┬───────┘
            │
            │ 1:N
            ▼
     ┌──────────────┐
     │   Lesson     │
     │──────────────│
     │ id (PK)      │
     │ moduleId(FK) │
     │ title        │
     │ videoUrl     │
     └──────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    QUIZ/ASSESSMENT STRUCTURE                             │
└─────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────┐
                    │          Quiz               │
                    │─────────────────────────────│
                    │ id (PK)                     │
                    │ title                       │
                    │ description                 │
                    │ attachmentType (ENUM)       │◄──┐
                    │   - COURSE                  │   │
                    │   - MODULE                  │   │ One of these
                    │   - LESSON                  │   │ based on type
                    │ courseId (FK, nullable)     │───┤
                    │ moduleId (FK, nullable)     │───┤
                    │ lessonId (FK, nullable)     │───┘
                    │ passMark                    │
                    │ totalMarks                  │
                    │ timeLimit (nullable)        │
                    │ maxAttempts (nullable)      │
                    │ status (ENUM)               │
                    │   - DRAFT                   │
                    │   - PUBLISHED               │
                    │   - ARCHIVED                │
                    │ displayOrder                │
                    │ createdBy                   │
                    └──────────┬──────────────────┘
                               │
                               │ 1:N
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
    ┌───────────────────────┐     ┌───────────────────────┐
    │   QuizQuestion        │     │    QuizAttempt        │
    │───────────────────────│     │───────────────────────│
    │ id (PK)               │     │ id (PK)               │
    │ quizId (FK)           │     │ quizId (FK)           │
    │ questionText          │     │ studentId (FK)        │
    │ options (JSON)        │     │ answers (JSON)        │
    │   [                   │     │   [                   │
    │     {                 │     │     {                 │
    │       id: string,     │     │       questionId,     │
    │       text: string    │     │       selectedAnswer  │
    │     }                 │     │     }                 │
    │   ]                   │     │   ]                   │
    │ correctAnswer         │     │ score                 │
    │ marks                 │     │ passed (boolean)      │
    │ displayOrder          │     │ startedAt             │
    └───────────────────────┘     │ submittedAt           │
                                  └───────┬───────────────┘
                                          │
                                          │ N:1
                                          ▼
                                  ┌───────────────┐
                                  │   Student     │
                                  │───────────────│
                                  │ id (PK)       │
                                  │ userId (FK)   │
                                  │ admissionId   │
                                  │ firstName     │
                                  │ lastName      │
                                  └───────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      ATTACHMENT SCENARIOS                                │
└─────────────────────────────────────────────────────────────────────────┘

Scenario 1: COURSE-Level Quiz
─────────────────────────────
Course ──► Quiz (attachmentType: COURSE, courseId: set)
         └─► QuizQuestion (1..N)
         └─► QuizAttempt (N per student)

Example: "Final Exam for Introduction to Taxation"


Scenario 2: MODULE-Level Quiz
─────────────────────────────
Course ──► CourseModule ──► Quiz (attachmentType: MODULE, moduleId: set)
                           └─► QuizQuestion (1..N)
                           └─► QuizAttempt (N per student)

Example: "GST Basics Module Quiz"


Scenario 3: LESSON-Level Quiz
─────────────────────────────
Course ──► CourseModule ──► Lesson ──► Quiz (attachmentType: LESSON, lessonId: set)
                                      └─► QuizQuestion (1..N)
                                      └─► QuizAttempt (N per student)

Example: "Quick Check: Understanding Tax Rates"

┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                        │
└─────────────────────────────────────────────────────────────────────────┘

1. QUIZ CREATION (Administrator)
   ┌────────────┐
   │ Admin      │
   └─────┬──────┘
         │ creates
         ▼
   ┌────────────────┐
   │ Quiz (DRAFT)   │
   └────────┬───────┘
            │ adds
            ▼
   ┌────────────────┐
   │ QuizQuestion   │
   │ (with correct  │
   │  answers)      │
   └────────┬───────┘
            │ publishes
            ▼
   ┌────────────────┐
   │Quiz (PUBLISHED)│
   └────────────────┘


2. QUIZ TAKING (Student)
   ┌────────────┐
   │ Student    │
   └─────┬──────┘
         │ requests quiz
         ▼
   ┌────────────────────┐
   │ Quiz + Questions   │
   │ (NO correctAnswer) │◄─── Answer masking
   └─────┬──────────────┘
         │ submits answers
         ▼
   ┌────────────────────┐
   │ Scoring Engine     │
   │ - Compare answers  │
   │ - Calculate score  │
   │ - Determine pass   │
   └─────┬──────────────┘
         │ saves
         ▼
   ┌────────────────────┐
   │ QuizAttempt        │
   │ - answers          │
   │ - score            │
   │ - passed           │
   └────────────────────┘


3. RESULTS VIEWING (Student)
   ┌────────────┐
   │ Student    │
   └─────┬──────┘
         │ requests results
         ▼
   ┌────────────────────┐
   │ QuizAttempt        │
   │ + Questions        │
   │ + Correct Answers  │◄─── Now show correct answers
   └────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         INDEXES                                          │
└─────────────────────────────────────────────────────────────────────────┘

Quiz Table:
  - courseId              (fast lookup of course quizzes)
  - moduleId              (fast lookup of module quizzes)
  - lessonId              (fast lookup of lesson quizzes)
  - status                (filter by published/draft)
  - attachmentType        (filter by attachment level)

QuizQuestion Table:
  - quizId                (fast lookup of questions in a quiz)
  - (quizId, displayOrder)(efficient ordering within quiz)

QuizAttempt Table:
  - quizId                (fast lookup of all attempts for a quiz)
  - studentId             (fast lookup of student's attempts)
  - (quizId, studentId)   (efficient student-quiz attempt lookup)

┌─────────────────────────────────────────────────────────────────────────┐
│                    BUSINESS RULES ENFORCED                               │
└─────────────────────────────────────────────────────────────────────────┘

1. Attachment Validation
   ✓ Only one of courseId/moduleId/lessonId should be set
   ✓ Must match attachmentType value

2. Access Control
   ✓ Only PUBLISHED quizzes visible to students
   ✓ Student must be enrolled in parent course
   ✓ correctAnswer field masked before quiz submission

3. Attempt Limits
   ✓ Track attempts per student per quiz
   ✓ Block if maxAttempts exceeded (when set)
   ✓ Allow unlimited if maxAttempts is null

4. Scoring Rules
   ✓ All questions must be answered
   ✓ Score = sum of marks for correct answers
   ✓ Passed = (score >= passMark)
   ✓ Attempts are immutable after submission

5. Cascade Behavior
   ✓ Deleting Quiz → deletes all Questions and Attempts
   ✓ Deleting Student → deletes all their Attempts
   ✓ Maintains referential integrity

┌─────────────────────────────────────────────────────────────────────────┐
│                    JSON FIELD STRUCTURES                                 │
└─────────────────────────────────────────────────────────────────────────┘

QuizQuestion.options:
{
  "options": [
    { "id": "opt_a", "text": "First option" },
    { "id": "opt_b", "text": "Second option" },
    { "id": "opt_c", "text": "Third option" },
    { "id": "opt_d", "text": "Fourth option" }
  ]
}

QuizAttempt.answers:
{
  "answers": [
    { "questionId": "uuid-1", "selectedAnswer": "opt_a" },
    { "questionId": "uuid-2", "selectedAnswer": "opt_c" },
    { "questionId": "uuid-3", "selectedAnswer": "opt_b" }
  ]
}
```

## Summary

The quiz schema provides a flexible assessment system that:

- **Attaches to any level**: Course, Module, or Lesson
- **Tracks multiple attempts**: Optional limits per student
- **Maintains security**: Answer masking before submission
- **Calculates scores**: Automatic comparison and pass/fail determination
- **Ensures data integrity**: Foreign keys with cascade delete
- **Optimizes queries**: Strategic indexes for common operations

This design validates Requirements R23-R26 from the specifications and provides a solid foundation for the quiz/assessment feature implementation.
