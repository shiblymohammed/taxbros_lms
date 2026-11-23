import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, CheckCircle2, Play } from 'lucide-react';
import type { StudentCourse } from '@/hooks/use-student-progress';
import { cn } from '@/lib/utils';

/** Progress bar in the design-system style (teal on light track). */
export function ProgressBar({ value, className, tone = 'brand' }: { value: number; className?: string; tone?: 'brand' | 'light' }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1.5 w-full overflow-hidden rounded-full', tone === 'light' ? 'bg-white/25' : 'bg-slate-100', className)}
    >
      <div className={cn('h-full rounded-full transition-all duration-500', tone === 'light' ? 'bg-white' : 'bg-brand')} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Enrolled course: cover, title, lessons and progress, with a play button (My Courses design). */
export function CourseProgressCard({ course, href }: { course: StudentCourse; href: string }) {
  const done = course.enrollmentStatus === 'COMPLETED' || course.progressPercentage >= 100;
  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className="relative h-28 bg-gradient-to-br from-brand-strong to-brand sm:h-32">
        {course.courseCoverImage ? (
          <Image src={course.courseCoverImage} alt="" fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
        ) : (
          <BookOpen className="absolute right-5 top-5 h-12 w-12 text-white/25" aria-hidden="true" />
        )}
        <span className="absolute bottom-0 left-4 translate-y-1/2 rounded-md bg-white px-2 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
          {done ? 'Completed' : course.progressPercentage > 0 ? 'In progress' : 'Not started'}
        </span>
      </div>
      <div className="flex items-end gap-3 px-4 pb-4 pt-6">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-bold text-slate-900">{course.courseTitle}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {course.totalLessons} lessons <span aria-hidden="true">•</span>{' '}
            <span className="font-semibold text-slate-700">{course.progressPercentage}%</span>
          </p>
          <ProgressBar value={course.progressPercentage} className="mt-2.5" />
        </div>
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors',
            done ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-soft text-brand-strong group-hover:bg-brand group-hover:text-white',
          )}
          aria-hidden="true"
        >
          {done ? <CheckCircle2 className="h-5 w-5" /> : <Play className="h-4 w-4 fill-current" />}
        </span>
      </div>
    </Link>
  );
}
