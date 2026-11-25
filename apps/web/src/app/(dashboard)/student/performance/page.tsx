'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChartColumn, CheckCircle2, ClipboardCheck, Clock, Loader2, TrendingDown, TrendingUp, Trophy, XCircle } from 'lucide-react';
import { EmptyState, ProgressRing, QuietNote } from '@/components/features/student/student-ui';
import { PageContainer } from '@/components/layout/page-header';
import {
  learningHours,
  monthOnMonthChange,
  subjectScores,
  testAverage,
  useStudentOverview,
} from '@/hooks/use-student-overview';
import { cn } from '@/lib/utils';

type Tab = 'overview' | 'tests';

/** My Performance (TAXBROS mobile design): test average ring, key numbers, subject-wise scores, trend. */
export default function StudentPerformancePage() {
  const { progress, lessonsByCourse, quizzes, loading, error } = useStudentOverview();
  const [tab, setTab] = useState<Tab>('overview');

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <span className="sr-only">Loading your performance…</span>
      </div>
    );
  }

  const courses = (progress?.courses ?? []).filter((c) => c.enrollmentStatus !== 'DROPPED');
  const average = testAverage(quizzes);
  const subjects = subjectScores(quizzes);
  const change = monthOnMonthChange(quizzes);
  const hours = learningHours(lessonsByCourse);
  const passed = quizzes.filter((q) => q.passed).length;
  const attempts = quizzes
    .flatMap((q) => q.attempts.map((a) => ({ ...a, courseTitle: q.courseTitle })))
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));

  const stats = [
    { icon: Trophy, value: `${passed}`, label: passed === 1 ? 'Test passed' : 'Tests passed' },
    { icon: Clock, value: `${hours} h`, label: 'Learning time' },
    { icon: BookOpen, value: `${courses.length}`, label: courses.length === 1 ? 'Course enrolled' : 'Courses enrolled' },
  ];

  return (
    <PageContainer className="max-w-3xl space-y-5">
      {/* Phones get the title in the top bar, with a back arrow (as in the design) */}
      <h1 className="hidden font-display text-2xl font-extrabold text-slate-900 sm:text-[1.75rem] md:block">My Performance</h1>

      {error ? (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : (
        <>
          <div role="tablist" aria-label="Performance views" className="grid grid-cols-2 gap-1 rounded-full bg-white p-1 ring-1 ring-border sm:max-w-xs">
            {(
              [
                ['overview', 'Overview'],
                ['tests', 'Tests'],
              ] as Array<[Tab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  'h-9 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  tab === key ? 'bg-brand text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'overview' ? (
            <>
              <section className="flex items-center gap-5 rounded-[1.25rem] border bg-white p-4 shadow-sm sm:gap-8 sm:p-6">
                <span className="sm:hidden">
                  <ProgressRing value={average} label="Test Average" size={124} />
                </span>
                <span className="hidden sm:block">
                  <ProgressRing value={average} label="Test Average" />
                </span>
                <ul className="min-w-0 flex-1 space-y-3.5">
                  {stats.map(({ icon: Icon, value, label }) => (
                    <li key={label} className="flex items-center gap-3.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-brand-strong sm:h-10 sm:w-10">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block font-display text-lg font-extrabold leading-tight text-slate-900">{value}</span>
                        <span className="block text-xs text-slate-500">{label}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-[1.25rem] border bg-white p-5 shadow-sm sm:p-6">
                <h2 className="mb-4 text-base font-bold text-slate-900 sm:text-lg">Subject-wise Performance</h2>
                {subjects.length === 0 ? (
                  <QuietNote icon={ChartColumn} title="No scores yet">
                    Take a test in any course and your score per subject appears here.{' '}
                    <Link href="/student/quizzes" className="font-semibold text-brand hover:underline">
                      Go to tests
                    </Link>
                  </QuietNote>
                ) : (
                  <ul className="space-y-4">
                    {subjects.map((s) => (
                      <li key={s.courseTitle} className="grid grid-cols-[minmax(0,7rem)_1fr_2.75rem] items-center gap-3 sm:grid-cols-[minmax(0,11rem)_1fr_3rem]">
                        <span className="truncate text-sm text-slate-700">{s.courseTitle}</span>
                        <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <span className="block h-full rounded-full bg-brand" style={{ width: `${s.percent}%` }} />
                        </span>
                        <span className="text-right text-sm font-semibold tabular-nums text-slate-900">{s.percent}%</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {change !== undefined && (
                <section
                  className={cn(
                    'flex items-center gap-4 rounded-[1.25rem] p-5',
                    change >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900',
                  )}
                >
                  {change >= 0 ? <TrendingUp className="h-8 w-8 shrink-0 text-emerald-600" aria-hidden="true" /> : <TrendingDown className="h-8 w-8 shrink-0 text-amber-600" aria-hidden="true" />}
                  <span>
                    <span className="block font-display text-2xl font-extrabold">
                      {change >= 0 ? '+' : ''}
                      {change}%
                    </span>
                    <span className="block text-sm">{change >= 0 ? 'Improvement from last month' : 'Lower than last month: keep practising'}</span>
                  </span>
                </section>
              )}
            </>
          ) : attempts.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No attempts yet"
              actions={
                <Link href="/student/quizzes" className="inline-flex h-11 items-center rounded-xl bg-brand-strong px-5 text-sm font-semibold text-white hover:bg-brand">
                  See available tests
                </Link>
              }
            >
              Every test you submit is listed here with its score.
            </EmptyState>
          ) : (
            <ul className="overflow-hidden rounded-[1.25rem] border bg-white shadow-sm">
              {attempts.map((a, i) => (
                <li key={a.id} className={cn(i > 0 && 'border-t')}>
                  <Link href={`/student/quizzes/${a.quizId}/results/${a.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50">
                    {a.passed ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="Passed" />
                    ) : (
                      <XCircle className="h-5 w-5 shrink-0 text-rose-500" aria-label="Not passed" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">{a.quizTitle}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {a.courseTitle} · {new Date(a.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                      {a.score}/{a.totalMarks}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PageContainer>
  );
}
