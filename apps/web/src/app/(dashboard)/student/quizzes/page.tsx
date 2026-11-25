'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChartColumn, ClipboardCheck, Clock, FlaskConical, ListChecks, Loader2, Lock, RotateCcw, Trophy } from 'lucide-react';
import { EmptyState } from '@/components/features/student/student-ui';
import { PageContainer } from '@/components/layout/page-header';
import { blockerText, useStudentOverview, type StudentQuiz } from '@/hooks/use-student-overview';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'pending' | 'passed';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All Tests' },
  { key: 'pending', label: 'Pending' },
  { key: 'passed', label: 'Passed' },
];

/** Tests & Exams tab: every published test in the student's courses, with best score and status. */
export default function StudentTestsPage() {
  const { progress, quizzes, loading, error } = useStudentOverview();
  const [filter, setFilter] = useState<Filter>('all');

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <span className="sr-only">Loading your tests…</span>
      </div>
    );
  }

  const enrolled = (progress?.courses ?? []).some((c) => c.enrollmentStatus !== 'DROPPED');
  const pending = quizzes.filter((q) => !q.passed);
  const shown = filter === 'all' ? quizzes : filter === 'pending' ? pending : quizzes.filter((q) => q.passed);

  return (
    <PageContainer className="max-w-4xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900 sm:text-[1.75rem]">Tests &amp; Exams</h1>
          <p className="mt-1 text-sm text-slate-500">
            {quizzes.length > 0 ? `${pending.length} pending · ${quizzes.length - pending.length} passed` : 'Tests from your courses'}
          </p>
        </div>
        {quizzes.some((q) => q.attemptCount > 0) && (
          <Link href="/student/performance" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-brand-strong ring-1 ring-border hover:bg-brand-soft">
            <ChartColumn className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">My performance</span>
            <span className="sm:hidden">Scores</span>
          </Link>
        )}
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : quizzes.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No tests yet"
          actions={
            <Link href="/student/labs" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-strong px-5 text-sm font-semibold text-white hover:bg-brand">
              <FlaskConical className="h-4 w-4" aria-hidden="true" /> Practise in a lab
            </Link>
          }
        >
          {enrolled
            ? 'Your instructors have not published any tests in your courses yet. They will be listed here as soon as they are.'
            : 'Tests come with your courses. Once the institute enrols you, they will be listed here.'}
        </EmptyState>
      ) : (
        <>
          <div role="tablist" aria-label="Filter tests" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  filter === f.key ? 'bg-brand text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-border hover:bg-slate-50',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <EmptyState icon={filter === 'passed' ? Trophy : ListChecks} title={filter === 'passed' ? 'No tests passed yet' : 'Nothing pending'}>
              {filter === 'passed' ? 'Pass a test and it will show here with your best score.' : 'You have passed every test so far. Well done!'}
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {shown.map((quiz) => (
                <li key={quiz.id}>
                  <TestCard quiz={quiz} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PageContainer>
  );
}

function TestCard({ quiz }: { quiz: StudentQuiz }) {
  // Quizzes after videos have no attempt limit; course quizzes keep theirs
  const outOfAttempts = !quiz.afterVideo && !!quiz.maxAttempts && quiz.attemptCount >= quiz.maxAttempts && !quiz.passed;
  const action = quiz.locked ? 'Locked' : quiz.passed ? 'Review' : outOfAttempts ? 'View' : quiz.attemptCount > 0 ? 'Try again' : 'Start';
  const cardClass = 'flex items-center gap-3.5 rounded-[1.25rem] border bg-white p-4 shadow-sm';

  if (quiz.locked) {
    return (
      <div className={cn(cardClass, 'opacity-80')} aria-disabled="true">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Lock className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-slate-600">{quiz.title}</span>
          <span className="block truncate text-xs text-slate-500">{quiz.courseTitle}</span>
          <span className="mt-1.5 block text-xs text-slate-500">Opens after its video · {blockerText(quiz.blockedBy)}</span>
        </span>
        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">{action}</span>
      </div>
    );
  }

  return (
    <Link
      href={`/student/quizzes/${quiz.id}`}
      className={cn(cardClass, 'transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand')}
    >
      <span
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
          quiz.passed ? 'bg-emerald-50 text-emerald-600' : quiz.attemptCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-500',
        )}
      >
        {quiz.passed ? <Trophy className="h-5 w-5" /> : quiz.attemptCount > 0 ? <RotateCcw className="h-5 w-5" /> : <ClipboardCheck className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-slate-900">{quiz.title}</span>
        <span className="block truncate text-xs text-slate-500">{quiz.courseTitle}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>{quiz.totalMarks} marks</span>
          {quiz.timeLimit ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" /> {quiz.timeLimit} min
            </span>
          ) : null}
          {quiz.attemptCount > 0 && (
            <span className="font-medium text-slate-700">
              Best {quiz.bestScore}/{quiz.totalMarks} ({quiz.bestPercent}%)
            </span>
          )}
          {quiz.afterVideo ? (
            <span>Unlimited attempts</span>
          ) : quiz.maxAttempts ? (
            <span>
              {quiz.attemptCount}/{quiz.maxAttempts} attempts
            </span>
          ) : null}
        </span>
      </span>
      <span
        className={cn(
          'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold',
          quiz.passed ? 'bg-emerald-50 text-emerald-700' : outOfAttempts ? 'bg-slate-100 text-slate-600' : quiz.attemptCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-brand-soft text-brand-strong',
        )}
      >
        {action}
      </span>
    </Link>
  );
}
