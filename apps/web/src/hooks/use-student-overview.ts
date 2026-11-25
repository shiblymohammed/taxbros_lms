'use client';

import { useEffect, useState } from 'react';
import { apiClient, quizzesApi, type Quiz, type QuizAttemptSummary } from '@/lib/api';
import type { StudentCourse, StudentProgress } from './use-student-progress';

/** What a student must finish before a locked lesson or quiz opens (learning order / quiz gate). */
export interface Blocker {
  kind: 'LESSON' | 'QUIZ';
  id: string;
  title: string;
}

/** One lesson as GET /courses/:id/progress returns it (modules in order, lessons in order). */
export interface CourseLesson {
  lessonId: string;
  lessonTitle: string;
  moduleId?: string;
  moduleTitle: string;
  /** Locked until the previous lesson (and its quiz) is done */
  locked?: boolean;
  blockedBy?: Blocker | null;
  displayOrder: number;
  duration: number | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  lastPosition: number;
  watchedDuration: number;
  completedAt: string | null;
}

/** A published quiz in a course with this student's state (GET /courses/:id/progress → quizzes). */
export interface CourseQuiz {
  quizId: string;
  title: string;
  attachmentType: 'COURSE' | 'MODULE' | 'LESSON';
  lessonId: string | null;
  moduleId: string | null;
  passMark: number;
  totalMarks: number;
  attemptCount: number;
  bestScore: number | null;
  passed: boolean;
  /** Lesson and module quizzes: they open after the video(s) and must be passed to continue */
  afterVideo: boolean;
  locked: boolean;
  blockedBy: Blocker | null;
}

export interface StudentQuiz extends Quiz {
  afterVideo?: boolean;
  locked?: boolean;
  blockedBy?: Blocker | null;
  courseTitle: string;
  attempts: QuizAttemptSummary[];
  attemptCount: number;
  bestScore?: number;
  /** Best score as a percentage of total marks */
  bestPercent?: number;
  passed: boolean;
}

export interface StudentOverview {
  progress: StudentProgress | null;
  /** Published lessons per enrolled course (active and completed) */
  lessonsByCourse: Map<string, CourseLesson[]>;
  /** Published quizzes per enrolled course, with lock state */
  quizzesByCourse: Map<string, CourseQuiz[]>;
  quizzes: StudentQuiz[];
  loading: boolean;
  error: string | null;
}

const courseOf = (quiz: Quiz) => quiz.owningCourseId ?? quiz.courseId;

/**
 * Everything the student Home, Tests and Performance screens show, in one load:
 * enrolments, lessons of each course, published quizzes in those courses and the student's attempts.
 */
export function useStudentOverview(): StudentOverview {
  const [state, setState] = useState<StudentOverview>({
    progress: null,
    lessonsByCourse: new Map(),
    quizzesByCourse: new Map(),
    quizzes: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: me } = await apiClient.get<{ studentId: string | null }>('/auth/me');
        if (!me.studentId) throw new Error('No student profile found for this user');
        const { data: progress } = await apiClient.get<StudentProgress>(`/students/${me.studentId}/progress`);
        const courses = progress.courses.filter((c) => c.enrollmentStatus !== 'DROPPED');

        const courseEntries = await Promise.all(
          courses.map(async (c): Promise<[string, CourseLesson[], CourseQuiz[]]> => {
            try {
              const { data } = await apiClient.get<{ lessons?: CourseLesson[]; quizzes?: CourseQuiz[] }>(`/courses/${c.courseId}/progress`);
              return [c.courseId, data.lessons ?? [], data.quizzes ?? []];
            } catch {
              return [c.courseId, [], []];
            }
          }),
        );

        let quizzes: StudentQuiz[] = [];
        try {
          const all = await quizzesApi.getAvailableQuizzes(me.studentId);
          const titles = new Map(courses.map((c) => [c.courseId, c.courseTitle]));
          const mine = all.filter((q) => {
            const id = courseOf(q);
            return !!id && titles.has(id);
          });
          quizzes = await Promise.all(
            mine.map(async (quiz) => {
              const attempts = await quizzesApi.getQuizAttempts(quiz.id).catch(() => [] as QuizAttemptSummary[]);
              const best = attempts.reduce<QuizAttemptSummary | undefined>((b, a) => (!b || a.score > b.score ? a : b), undefined);
              return {
                ...quiz,
                courseTitle: titles.get(courseOf(quiz)!) ?? '',
                attempts,
                attemptCount: attempts.length,
                bestScore: best?.score,
                bestPercent: best && quiz.totalMarks > 0 ? Math.round((best.score / quiz.totalMarks) * 100) : undefined,
                passed: attempts.some((a) => a.passed),
              };
            }),
          );
        } catch (err) {
          console.error('Failed to load quizzes:', err);
        }

        if (!cancelled) {
          setState({
            progress,
            lessonsByCourse: new Map(courseEntries.map(([id, lessons]) => [id, lessons])),
            quizzesByCourse: new Map(courseEntries.map(([id, , qs]) => [id, qs])),
            quizzes,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        const e = err as { response?: { data?: { message?: string } }; message?: string };
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error: e.response?.data?.message || e.message || 'Failed to load your dashboard' }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** First lesson not yet completed in a course. */
export function nextLesson(lessons: CourseLesson[] | undefined): CourseLesson | undefined {
  return lessons?.find((l) => l.status !== 'COMPLETED');
}

/** The student's next step in a course: a lesson to watch or a quiz to pass (learning order). */
export type NextStep =
  | { kind: 'lesson'; lesson: CourseLesson; href: string; title: string; moduleTitle: string }
  | { kind: 'quiz'; quiz: CourseQuiz; href: string; title: string; moduleTitle: string };

export function nextStep(courseId: string, lessons: CourseLesson[] | undefined, quizzes: CourseQuiz[] | undefined): NextStep | undefined {
  const all = lessons ?? [];
  const gates = (quizzes ?? []).filter((q) => q.afterVideo);
  const quizStep = (q: CourseQuiz, moduleTitle: string): NextStep => ({ kind: 'quiz', quiz: q, href: `/student/quizzes/${q.quizId}`, title: q.title, moduleTitle });
  for (const mod of groupByModule(all)) {
    for (const lesson of mod.lessons) {
      if (lesson.status !== 'COMPLETED') {
        return { kind: 'lesson', lesson, href: `/student/courses/${courseId}/lessons/${lesson.lessonId}`, title: lesson.lessonTitle, moduleTitle: mod.title };
      }
      const pending = gates.find((q) => q.attachmentType === 'LESSON' && q.lessonId === lesson.lessonId && !q.passed);
      if (pending) return quizStep(pending, mod.title);
    }
    const moduleId = mod.lessons[0]?.moduleId;
    const pendingModule = gates.find((q) => q.attachmentType === 'MODULE' && !!moduleId && q.moduleId === moduleId && !q.passed);
    if (pendingModule) return quizStep(pendingModule, mod.title);
  }
  return undefined;
}

/** Lesson and module quizzes of one lesson / module, for listing them in the course outline. */
export function quizzesAfter(quizzes: CourseQuiz[] | undefined, at: { lessonId?: string; moduleId?: string }): CourseQuiz[] {
  return (quizzes ?? []).filter((q) =>
    at.lessonId ? q.attachmentType === 'LESSON' && q.lessonId === at.lessonId : q.attachmentType === 'MODULE' && q.moduleId === at.moduleId,
  );
}

/** Short sentence for a lock: "Watch “X” first" / "Pass “Quiz” first". */
export function blockerText(b: Blocker | null | undefined, fallback = 'Finish the previous step first'): string {
  if (!b) return fallback;
  return b.kind === 'QUIZ' ? `Pass “${b.title}” first` : `Watch “${b.title}” first`;
}

/** Lessons grouped by module, keeping the API's order; numbers are 1-based for "3.2"-style labels. */
export function groupByModule(lessons: CourseLesson[]): Array<{ number: number; title: string; lessons: CourseLesson[] }> {
  const groups: Array<{ number: number; title: string; lessons: CourseLesson[] }> = [];
  for (const lesson of lessons) {
    const last = groups.at(-1);
    if (last && last.title === lesson.moduleTitle) last.lessons.push(lesson);
    else groups.push({ number: groups.length + 1, title: lesson.moduleTitle, lessons: [lesson] });
  }
  return groups;
}

/** "12:40" or "1:02:05" from seconds; empty when unknown. */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Hours of video watched across all courses, rounded to one decimal under 10 h. */
export function learningHours(lessonsByCourse: Map<string, CourseLesson[]>): number {
  let seconds = 0;
  lessonsByCourse.forEach((lessons) => lessons.forEach((l) => (seconds += l.watchedDuration || 0)));
  const hours = seconds / 3600;
  return hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours);
}

/** Average of each quiz's best score, in percent; undefined before any attempt. */
export function testAverage(quizzes: StudentQuiz[]): number | undefined {
  const scored = quizzes.filter((q) => q.bestPercent !== undefined);
  if (scored.length === 0) return undefined;
  return Math.round(scored.reduce((n, q) => n + (q.bestPercent ?? 0), 0) / scored.length);
}

/** Average best score per course (the "subject-wise performance" bars). */
export function subjectScores(quizzes: StudentQuiz[]): Array<{ courseTitle: string; percent: number }> {
  const byCourse = new Map<string, number[]>();
  for (const q of quizzes) {
    if (q.bestPercent === undefined) continue;
    byCourse.set(q.courseTitle, [...(byCourse.get(q.courseTitle) ?? []), q.bestPercent]);
  }
  return [...byCourse].map(([courseTitle, scores]) => ({
    courseTitle,
    percent: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
  }));
}

/**
 * Change in average attempt score between this calendar month and last, in percentage points.
 * Undefined unless the student has attempts in both months.
 */
export function monthOnMonthChange(quizzes: StudentQuiz[], now = new Date()): number | undefined {
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const current: number[] = [];
  const previous: number[] = [];
  for (const q of quizzes) {
    for (const a of q.attempts) {
      const t = Date.parse(a.submittedAt);
      const pct = a.totalMarks > 0 ? (a.score / a.totalMarks) * 100 : 0;
      if (t >= thisMonth) current.push(pct);
      else if (t >= lastMonth) previous.push(pct);
    }
  }
  if (current.length === 0 || previous.length === 0) return undefined;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.round(avg(current) - avg(previous));
}

/** A course with no published lessons yet (the "coming soon" state). */
export const hasNoLessons = (course: StudentCourse) => course.totalLessons === 0;
