import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  groupByModule,
  learningHours,
  monthOnMonthChange,
  nextLesson,
  nextStep,
  subjectScores,
  testAverage,
  type CourseLesson,
  type CourseQuiz,
  type StudentQuiz,
} from './use-student-overview';

const lesson = (id: string, moduleTitle: string, status: CourseLesson['status'] = 'NOT_STARTED', watched = 0): CourseLesson => ({
  lessonId: id,
  lessonTitle: `Lesson ${id}`,
  moduleTitle,
  displayOrder: 0,
  duration: 600,
  status,
  lastPosition: 0,
  watchedDuration: watched,
  completedAt: null,
});

const quiz = (id: string, courseTitle: string, totalMarks: number, scores: Array<[number, string]>, passMark = 50): StudentQuiz => {
  const attempts = scores.map(([score, submittedAt], i) => ({
    id: `${id}-${i}`,
    quizId: id,
    quizTitle: id,
    score,
    totalMarks,
    passed: score >= passMark,
    submittedAt,
  }));
  const best = Math.max(...scores.map(([s]) => s));
  return {
    id,
    title: id,
    attachmentType: 'COURSE',
    passMark,
    totalMarks,
    status: 'PUBLISHED',
    courseTitle,
    attempts,
    attemptCount: attempts.length,
    bestScore: scores.length ? best : undefined,
    bestPercent: scores.length ? Math.round((best / totalMarks) * 100) : undefined,
    passed: attempts.some((a) => a.passed),
  } as StudentQuiz;
};

describe('student overview helpers', () => {
  it('groups lessons by module in API order and numbers modules from 1', () => {
    const groups = groupByModule([lesson('a', 'Basics'), lesson('b', 'Basics'), lesson('c', 'Returns')]);
    expect(groups.map((g) => [g.number, g.title, g.lessons.length])).toEqual([
      [1, 'Basics', 2],
      [2, 'Returns', 1],
    ]);
  });

  it('picks the first lesson that is not completed', () => {
    expect(nextLesson([lesson('a', 'M', 'COMPLETED'), lesson('b', 'M', 'IN_PROGRESS')])?.lessonId).toBe('b');
    expect(nextLesson([lesson('a', 'M', 'COMPLETED')])).toBeUndefined();
    expect(nextLesson(undefined)).toBeUndefined();
  });

  it('formats durations like the video player', () => {
    expect(formatDuration(745)).toBe('12:25');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(null)).toBe('');
  });

  it('adds up watched time in hours', () => {
    expect(learningHours(new Map([['c1', [lesson('a', 'M', 'COMPLETED', 5400), lesson('b', 'M', 'IN_PROGRESS', 1800)]]]))).toBe(2);
  });

  it('averages best scores overall and per subject, ignoring untried tests', () => {
    const quizzes = [
      quiz('q1', 'GST', 10, [[6, '2026-11-02'], [8, '2026-11-10']]),
      quiz('q2', 'GST', 20, [[10, '2026-11-03']]),
      quiz('q3', 'Direct Tax', 50, [[45, '2026-11-04']]),
      quiz('q4', 'Direct Tax', 50, []),
    ];
    expect(testAverage(quizzes)).toBe(73); // (80 + 50 + 90) / 3
    expect(subjectScores(quizzes)).toEqual([
      { courseTitle: 'GST', percent: 65 },
      { courseTitle: 'Direct Tax', percent: 90 },
    ]);
    expect(testAverage([quiz('q4', 'Direct Tax', 50, [])])).toBeUndefined();
  });

  it('compares this month with last month only when both have attempts', () => {
    const now = new Date(2026, 10, 20);
    const both = [quiz('q1', 'GST', 10, [[6, new Date(2026, 9, 15).toISOString()], [8, new Date(2026, 10, 5).toISOString()]])];
    expect(monthOnMonthChange(both, now)).toBe(20);
    const onlyThisMonth = [quiz('q1', 'GST', 10, [[8, new Date(2026, 10, 5).toISOString()]])];
    expect(monthOnMonthChange(onlyThisMonth, now)).toBeUndefined();
  });
});

describe('nextStep (learning order with quizzes after videos)', () => {
  const l = (id: string, moduleId: string, status: CourseLesson['status']): CourseLesson => ({ ...lesson(id, moduleId, status), moduleId });
  const q = (quizId: string, at: Partial<CourseQuiz>, passed = false): CourseQuiz => ({
    quizId,
    title: `Quiz ${quizId}`,
    attachmentType: 'LESSON',
    lessonId: null,
    moduleId: null,
    passMark: 5,
    totalMarks: 10,
    attemptCount: 0,
    bestScore: null,
    passed,
    afterVideo: true,
    locked: false,
    blockedBy: null,
    ...at,
  });

  it('is the first unwatched lesson when there are no quizzes', () => {
    const step = nextStep('c1', [l('a', 'M1', 'COMPLETED'), l('b', 'M1', 'NOT_STARTED')], []);
    expect(step).toMatchObject({ kind: 'lesson', href: '/student/courses/c1/lessons/b' });
  });

  it('is the lesson quiz once its video is done, before the next lesson', () => {
    const step = nextStep('c1', [l('a', 'M1', 'COMPLETED'), l('b', 'M1', 'NOT_STARTED')], [q('qa', { lessonId: 'a' })]);
    expect(step).toMatchObject({ kind: 'quiz', href: '/student/quizzes/qa' });
  });

  it('is the module test after the last lesson of the module', () => {
    const lessons = [l('a', 'M1', 'COMPLETED'), l('c', 'M2', 'NOT_STARTED')];
    lessons[1].moduleTitle = 'M2';
    const step = nextStep('c1', lessons, [q('qm', { attachmentType: 'MODULE', moduleId: 'M1' })]);
    expect(step).toMatchObject({ kind: 'quiz', title: 'Quiz qm' });
  });

  it('ignores passed quizzes and course quizzes; undefined when everything is done', () => {
    const lessons = [l('a', 'M1', 'COMPLETED')];
    expect(nextStep('c1', lessons, [q('qa', { lessonId: 'a' }, true), q('final', { attachmentType: 'COURSE', afterVideo: false })])).toBeUndefined();
  });
});
