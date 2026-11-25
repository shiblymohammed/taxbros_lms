import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, CheckCircle2, Clock, Hourglass, Play } from 'lucide-react';
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

/**
 * Enrolled course (TAXBROS mobile design, My Courses): cover with a status chip, title,
 * "12 Lessons • 68%", progress and a play button. Courses with no published lessons show "Coming soon".
 */
export function CourseProgressCard({ course, href }: { course: StudentCourse; href: string }) {
  const done = course.enrollmentStatus === 'COMPLETED' || course.progressPercentage >= 100;
  const soon = course.totalLessons === 0;
  const chip = soon ? 'Coming soon' : done ? 'Completed' : course.progressPercentage > 0 ? 'In progress' : 'Not started';

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-[1.25rem] border bg-white shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div
        className={cn(
          'relative h-28 sm:h-32',
          soon
            ? 'bg-[repeating-linear-gradient(135deg,#e8eef1_0_12px,#f1f5f7_12px_24px)]'
            : 'bg-gradient-to-br from-brand-strong via-[#135d6e] to-brand',
        )}
      >
        {course.courseCoverImage ? (
          <Image src={course.courseCoverImage} alt="" fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
        ) : (
          !soon && (
            <>
              <span className="absolute -right-6 -top-10 h-32 w-32 rounded-full bg-white/10" aria-hidden="true" />
              <BookOpen className="absolute right-5 top-5 h-11 w-11 text-white/25" aria-hidden="true" />
            </>
          )
        )}
        <span
          className={cn(
            'absolute bottom-0 left-4 inline-flex translate-y-1/2 items-center gap-1 rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold shadow-sm',
            soon ? 'text-amber-700' : done ? 'text-emerald-700' : 'text-slate-600',
          )}
        >
          {soon && <Clock className="h-3 w-3" aria-hidden="true" />}
          {chip}
        </span>
      </div>
      <div className="flex items-center gap-3 px-4 pb-4 pt-6">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-display text-lg font-bold leading-snug text-slate-900">{course.courseTitle}</h3>
          {soon ? (
            <p className="mt-1 text-sm text-slate-500">No lessons published yet</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-500">
                {course.totalLessons} {course.totalLessons === 1 ? 'Lesson' : 'Lessons'} <span aria-hidden="true">•</span>{' '}
                <span className="font-semibold text-slate-700">{course.progressPercentage}%</span>
              </p>
              <ProgressBar value={course.progressPercentage} className="mt-2.5 h-2" />
            </>
          )}
        </div>
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors',
            soon
              ? 'bg-slate-100 text-slate-400'
              : done
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-brand-soft text-brand-strong group-hover:bg-brand group-hover:text-white',
          )}
          aria-hidden="true"
        >
          {soon ? <Hourglass className="h-5 w-5" /> : done ? <CheckCircle2 className="h-5 w-5" /> : <Play className="h-4 w-4 fill-current" />}
        </span>
      </div>
    </Link>
  );
}
