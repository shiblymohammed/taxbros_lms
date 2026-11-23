'use client';

import { useState } from 'react';
import { BookOpen, Loader2, Search } from 'lucide-react';
import { CourseProgressCard } from '@/components/features/courses/course-progress-card';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { filterCourses, useStudentProgress, type CourseFilter } from '@/hooks/use-student-progress';
import { cn } from '@/lib/utils';

const FILTERS: Array<{ key: CourseFilter; label: string }> = [
  { key: 'all', label: 'All Courses' },
  { key: 'progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

/** My Courses: every enrolment with progress, filterable like the mobile design's tabs. */
export default function MyCoursesPage() {
  const { progress, loading, error } = useStudentProgress();
  const [filter, setFilter] = useState<CourseFilter>('all');
  const [query, setQuery] = useState('');

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <span className="sr-only">Loading your courses…</span>
      </div>
    );
  }

  const courses = progress?.courses ?? [];
  const shown = filterCourses(courses, filter, query);

  return (
    <PageContainer>
      <PageHeader title="My Courses" description="Pick up where you left off, or review a finished course." />

      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Filter courses" className="flex gap-2 overflow-x-auto">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                    filter === f.key ? 'bg-brand text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-border hover:bg-slate-50',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <label className="relative block sm:w-72">
              <span className="sr-only">Search your courses</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search courses"
                className="h-10 w-full rounded-full border bg-white pl-9 pr-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
          </div>

          {shown.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-white px-6 py-14 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
              <p className="mt-3 font-semibold text-slate-800">
                {courses.length === 0 ? 'You are not enrolled in any course yet' : 'No courses match'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {courses.length === 0 ? 'Ask your administrator to enrol you.' : 'Try another filter or search.'}
              </p>
            </div>
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
