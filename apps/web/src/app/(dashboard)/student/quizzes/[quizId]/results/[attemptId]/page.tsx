'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, ChevronLeft, Eye, EyeOff, Loader2, PlayCircle, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { EmptyState, ProgressRing } from '@/components/features/student/student-ui';
import { PageContainer } from '@/components/layout/page-header';
import { nextStep, type CourseLesson, type CourseQuiz } from '@/hooks/use-student-overview';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

interface QuestionResult {
  id: string;
  questionText: string;
  options: Array<{ id: string; text: string }>;
  /** null until the student has passed a quiz that comes after a video */
  correctAnswer: string | null;
  marks: number;
  displayOrder: number;
  selectedAnswer: string | null;
  isCorrect: boolean | null;
  marksAwarded: number | null;
}

interface AttemptDetail {
  id: string;
  quizId: string;
  quizTitle: string;
  score: number;
  totalMarks: number;
  passMark: number;
  passed: boolean;
  submittedAt: string;
  attachmentType?: 'COURSE' | 'MODULE' | 'LESSON';
  /** Lesson and module quizzes: unlimited attempts, answers only after passing, gate the next step */
  afterVideo?: boolean;
  answersVisible?: boolean;
  correctCount?: number;
  courseId?: string | null;
  studyLessonId?: string | null;
  questions: QuestionResult[];
}

/**
 * Quiz result. Quizzes after videos: a pass unlocks the next lesson or module and offers "See answers";
 * a fail offers "Try again" and "Rewatch" without revealing the answers. Course quizzes show the review as before.
 */
export default function QuizResultsPage() {
  const params = useParams();
  const quizId = params.quizId as string;
  const attemptId = params.attemptId as string;

  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [continueHref, setContinueHref] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get<AttemptDetail>(`/quizzes/attempts/${attemptId}`);
        if (cancelled) return;
        setAttempt(data);
        // After a pass, point "Continue learning" at the student's next step in the course
        if (data.passed && data.courseId) {
          try {
            const { data: course } = await apiClient.get<{ lessons?: CourseLesson[]; quizzes?: CourseQuiz[] }>(`/courses/${data.courseId}/progress`);
            const step = nextStep(data.courseId, course.lessons, course.quizzes);
            if (!cancelled) setContinueHref(step?.href ?? `/student/courses/${data.courseId}`);
          } catch {
            if (!cancelled) setContinueHref(`/student/courses/${data.courseId}`);
          }
        }
      } catch (err) {
        const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
        if (!cancelled) setError(message || 'We could not load this result.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <span className="sr-only">Loading your result…</span>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <PageContainer className="max-w-3xl">
        <EmptyState
          icon={XCircle}
          title="Result not available"
          actions={
            <Link href="/student/quizzes" className="inline-flex h-11 items-center rounded-xl bg-brand-strong px-5 text-sm font-semibold text-white hover:bg-brand">
              Back to tests
            </Link>
          }
        >
          {error || 'This attempt could not be found.'}
        </EmptyState>
      </PageContainer>
    );
  }

  const percent = attempt.totalMarks > 0 ? Math.round((attempt.score / attempt.totalMarks) * 100) : 0;
  const total = attempt.questions.length;
  const correct = attempt.correctCount ?? attempt.questions.filter((q) => q.isCorrect).length;
  const afterVideo = !!attempt.afterVideo;
  const answersVisible = attempt.answersVisible ?? true;
  const unlocks = attempt.attachmentType === 'MODULE' ? 'module' : 'lesson';
  const rewatchHref = attempt.courseId && attempt.studyLessonId ? `/student/courses/${attempt.courseId}/lessons/${attempt.studyLessonId}` : null;
  // Course quizzes keep the old behaviour: the review is shown straight away
  const reviewOpen = answersVisible && (!afterVideo || showAnswers);

  const backHref = attempt.courseId ? `/student/courses/${attempt.courseId}` : '/student/quizzes';

  return (
    <PageContainer className="max-w-3xl space-y-5">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {attempt.courseId ? 'Back to course' : 'Back to tests'}
      </Link>

      <section
        className={cn(
          'overflow-hidden rounded-[1.6rem] border bg-white shadow-sm',
          attempt.passed ? 'border-emerald-200' : 'border-amber-200',
        )}
      >
        <div className={cn('flex items-center gap-2 px-5 py-3 text-sm font-semibold', attempt.passed ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900')}>
          {attempt.passed ? <Trophy className="h-4 w-4" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
          {attempt.passed ? 'Passed!' : 'Not passed yet'}
        </div>
        <div className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:p-7">
          <ProgressRing value={percent} label="Your score" size={124} />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="font-display text-xl font-extrabold text-slate-900 sm:text-2xl">{attempt.quizTitle}</h1>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">
                {attempt.score}/{attempt.totalMarks} marks
              </span>{' '}
              · pass mark {attempt.passMark} · {correct} of {total} correct
            </p>
            <p className="mt-3 text-sm text-slate-600">
              {attempt.passed
                ? afterVideo
                  ? `Well done. The next ${unlocks} is now unlocked.`
                  : 'Well done.'
                : afterVideo
                  ? `You need ${attempt.passMark} marks to pass. Rewatch the ${unlocks === 'module' ? 'module' : 'lesson'} and try again: there is no limit on attempts.`
                  : `You need ${attempt.passMark} marks to pass.`}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 border-t bg-slate-50/60 p-4 sm:flex-row sm:flex-wrap sm:justify-end">
          {attempt.passed ? (
            <>
              {afterVideo && answersVisible && (
                <button
                  type="button"
                  onClick={() => setShowAnswers((v) => !v)}
                  aria-expanded={showAnswers}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border bg-white px-5 text-sm font-semibold text-brand-strong hover:bg-brand-soft"
                >
                  {showAnswers ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  {showAnswers ? 'Hide answers' : 'See answers'}
                </button>
              )}
              <Link
                href={continueHref ?? backHref}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-strong px-5 text-sm font-semibold text-white hover:bg-brand"
              >
                Continue learning <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </>
          ) : (
            <>
              {rewatchHref && (
                <Link
                  href={rewatchHref}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border bg-white px-5 text-sm font-semibold text-brand-strong hover:bg-brand-soft"
                >
                  <PlayCircle className="h-4 w-4" aria-hidden="true" /> {unlocks === 'module' ? 'Restudy the module' : 'Rewatch lesson'}
                </Link>
              )}
              <Link
                href={`/student/quizzes/${quizId}`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-strong px-5 text-sm font-semibold text-white hover:bg-brand"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Try again
              </Link>
            </>
          )}
        </div>
      </section>

      {!attempt.passed && afterVideo && (
        <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 ring-1 ring-border">
          The correct answers are shown once you pass this quiz.
        </p>
      )}

      {reviewOpen && (
        <section aria-label="Answers" className="space-y-3">
          <h2 className="px-1 text-base font-bold text-slate-900">Answers</h2>
          {attempt.questions
            .slice()
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((q, i) => (
              <article key={q.id} className="rounded-[1.25rem] border bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start gap-3">
                  {q.isCorrect ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-label="Correct" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" aria-label="Incorrect" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-400">
                      Question {i + 1} · {q.marksAwarded ?? 0}/{q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                    </p>
                    <p className="mt-0.5 font-medium text-slate-900">{q.questionText}</p>
                    <ul className="mt-3 space-y-2">
                      {q.options.map((o) => {
                        const isAnswer = o.id === q.correctAnswer;
                        const isPicked = o.id === q.selectedAnswer;
                        return (
                          <li
                            key={o.id}
                            className={cn(
                              'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm',
                              isAnswer
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                : isPicked
                                  ? 'border-rose-300 bg-rose-50 text-rose-900'
                                  : 'border-slate-200 text-slate-700',
                            )}
                          >
                            <span className="flex-1">{o.text}</span>
                            {isAnswer && <span className="text-xs font-semibold">Correct answer</span>}
                            {isPicked && !isAnswer && <span className="text-xs font-semibold">Your answer</span>}
                            {isPicked && isAnswer && <span className="text-xs font-semibold">· Your answer</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
        </section>
      )}
    </PageContainer>
  );
}
