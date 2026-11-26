'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, FlaskConical, Hourglass, Loader2, Search, SearchX, X } from 'lucide-react';
import { CourseProgressCard } from '@/components/features/courses/course-progress-card';
import { EmptyState, LabShortcuts, SectionHeading } from '@/components/features/student/student-ui';
import { PageContainer } from '@/components/layout/page-header';
import { filterCourses, useStudentProgress, type CourseFilter } from '@/hooks/use-student-progress';
import { cn } from '@/lib/utils';

const FILTERS: Array<{ key: CourseFilter; label: string }> = [
  { key: 'all', label: 'All Courses' },
  { key: 'progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

/** My Courses (TAXBROS mobile design): title with search, filter pills, course cards. */
export default function MyCoursesPage() {
  const { progress, loading, error } = useStudentProgress();
  const [filter, setFilter] = useState<CourseFilter>('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <span className="sr-only">Loading your courses…</span>
      </div>
    );
  }

  const courses = (progress?.courses ?? []).filter((c) => c.enrollmentStatus !== 'DROPPED');
  const shown = filterCourses(courses, filter, query);

  return (
    <PageContainer>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold text-slate-900 sm:text-[1.75rem]">My Courses</h1>
          <p className="mt-1 hidden text-sm text-slate-500 sm:block">Pick up where you left off, or review a finished course.</p>
        </div>
        {courses.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setSearching((s) => !s);
              setQuery('');
            }}
            aria-label={searching ? 'Close search' : 'Search courses'}
            aria-expanded={searching}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {searching ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>
        )}
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : courses.length === 0 ? (
        <>
          <EmptyState
            icon={BookOpen}
            badge={Hourglass}
            title="No courses yet"
            actions={
              <>
                <Link href="/student/labs" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-strong px-5 text-sm font-semibold text-white hover:bg-brand">
                  <FlaskConical className="h-4 w-4" aria-hidden="true" /> Try a practice lab
                </Link>
                <Link href="/student/dashboard" className="inline-flex h-11 items-center rounded-xl border bg-white px-5 text-sm font-semibold text-brand-strong hover:bg-slate-50">
                  Back to home
                </Link>
              </>
            }
          >
            Courses appear here once the institute enrols you, usually soon after admission. If it has been more than a few days, ask
            the office to check your enrolment.
          </EmptyState>
          <section className="mt-8">
            <SectionHeading title="Open to every student" href="/student/labs" linkLabel="All labs" />
            <LabShortcuts />
          </section>
        </>
      ) : (
        <>
          {searching && (
            <label className="relative mb-4 block">
              <span className="sr-only">Search your courses</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your courses"
                className="h-11 w-full rounded-full border bg-white pl-10 pr-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 sm:max-w-md"
              />
            </label>
          )}

          <div role="tablist" aria-label="Filter courses" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
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
            <EmptyState icon={SearchX} title={query ? 'No courses match your search' : filter === 'completed' ? 'No completed courses yet' : 'Nothing in progress'}>
              {query
                ? 'Check the spelling, or clear the search to see all your courses.'
                : filter === 'completed'
                  ? 'Finish every lesson in a course and it moves here.'
                  : 'Every course you are enrolled in is finished. Great work!'}
            </EmptyState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((course) => (
                <CourseProgressCard key={course.enrollmentId} course={course} href={`/student/courses/${course.courseId}`} />
              ))}
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
