'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Bell, BookOpen, CheckCircle2, ClipboardCheck, Layers, Loader2, Play, Trophy } from 'lucide-react';
import { ProgressBar } from '@/components/features/courses/course-progress-card';
import { ModuleContent, OutlinePlaceholder } from '@/components/features/student/module-content';
import { ComingSoonPill, EmptyState, LabShortcuts, SectionHeading } from '@/components/features/student/student-ui';
import { PageContainer } from '@/components/layout/page-header';
import { groupByModule, nextStep, type CourseLesson, type CourseQuiz } from '@/hooks/use-student-overview';
import { apiClient } from '@/lib/api';

interface Course {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
}

interface CourseProgress {
  courseId: string;
  courseTitle: string;
  enrollmentStatus: 'ACTIVE' | 'COMPLETED' | 'DROPPED';
  progressPercentage: number;
  lessons: CourseLesson[];
  quizzes?: CourseQuiz[];
}

/** One enrolled course: header with progress, then the module outline (or "lessons coming soon"). */
export default function StudentCoursePage() {
  const params = useParams();
  const courseId = params?.courseId as string;
  const [course, setCourse] = useState<Course | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    (async () => {
      try {
        const [c, p] = await Promise.all([
          apiClient.get<Course>(`/courses/${courseId}`),
          apiClient.get<CourseProgress>(`/courses/${courseId}/progress`),
        ]);
        if (!cancelled) {
          setCourse(c.data);
          setProgress(p.data);
        }
      } catch (err) {
        const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
        if (!cancelled) setError(message || 'We could not load this course.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <span className="sr-only">Loading course…</span>
      </div>
    );
  }

  if (error || !course || !progress) {
    return (
      <PageContainer className="max-w-3xl">
        <EmptyState
          icon={BookOpen}
          title="Course not available"
          actions={
            <Link href="/student/courses" className="inline-flex h-11 items-center rounded-xl bg-brand-strong px-5 text-sm font-semibold text-white hover:bg-brand">
              Back to My Courses
            </Link>
          }
        >
          {error || 'This course could not be found.'} If you think you should have access, ask the institute office.
        </EmptyState>
      </PageContainer>
    );
  }

  const lessons = progress.lessons ?? [];
  const empty = lessons.length === 0;
  const modules = groupByModule(lessons);
  const doneCount = lessons.filter((l) => l.status === 'COMPLETED').length;
  const quizzes = progress.quizzes ?? [];
  const next = nextStep(courseId, lessons, quizzes);
  const finished = !empty && !next;

  return (
    <PageContainer className="max-w-5xl space-y-5">
      <Link href="/student/courses" className="hidden items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 md:inline-flex">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> My Courses
      </Link>

      <section className="overflow-hidden rounded-[1.6rem] border bg-white shadow-sm">
        <div className="relative h-28 bg-gradient-to-br from-brand-strong via-[#135d6e] to-brand sm:h-36">
          {course.coverImage ? (
            <Image src={course.coverImage} alt="" fill sizes="(min-width: 1024px) 64rem, 100vw" className="object-cover" priority />
          ) : (
            <>
              <span className="absolute -right-8 -top-12 h-40 w-40 rounded-full bg-white/10" aria-hidden="true" />
              <BookOpen className="absolute right-6 top-6 h-12 w-12 text-white/20" aria-hidden="true" />
            </>
          )}
        </div>
        <div className="p-5 sm:p-7">
          {empty ? (
            <ComingSoonPill />
          ) : finished ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" /> Course completed
            </span>
          ) : null}
          <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight text-slate-900 sm:text-3xl">{course.title}</h1>
          {course.description && <p className="mt-1.5 text-sm text-slate-500 sm:text-base">{course.description}</p>}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              {empty ? 'No lessons published yet' : `${lessons.length} ${lessons.length === 1 ? 'lesson' : 'lessons'}`}
            </span>
            {!empty && (
              <span className="inline-flex items-center gap-1.5">
                <Layers className="h-4 w-4" aria-hidden="true" /> {modules.length} {modules.length === 1 ? 'module' : 'modules'}
              </span>
            )}
            {!empty && (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {doneCount} done
              </span>
            )}
          </div>
          {!empty && next && (
            <div className="mt-5">
              <Link
                href={next.href}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-strong px-5 text-sm font-semibold text-white hover:bg-brand sm:w-auto"
              >
                {next.kind === 'quiz' ? (
                  <>
                    <ClipboardCheck className="h-4 w-4" aria-hidden="true" /> Take quiz: {next.title}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                    {doneCount === 0 && next.lesson.status === 'NOT_STARTED' ? 'Start course' : 'Continue learning'}
                  </>
                )}
              </Link>
              {next.kind === 'quiz' && <p className="mt-2 text-xs text-slate-500">Pass this quiz to unlock the next lesson.</p>}
            </div>
          )}
        </div>
      </section>

      {empty ? (
        <>
          <div className="flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3.5 text-sm text-amber-900">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            <p>Lessons are being prepared. They will show here, in order, as soon as your instructor publishes them.</p>
          </div>
          <section className="rounded-[1.25rem] border bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-400">Course outline</h2>
            <OutlinePlaceholder />
          </section>
          <section>
            <SectionHeading title="Practise meanwhile" href="/student/labs" linkLabel="All labs" />
            <LabShortcuts />
          </section>
        </>
      ) : (
        <section className="rounded-[1.25rem] border bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-1 flex items-center justify-between gap-3 px-1">
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">Module Content</h2>
            <span className="text-sm font-semibold text-slate-700">{progress.progressPercentage}%</span>
          </div>
          <ProgressBar value={progress.progressPercentage} className="mb-4 h-2" />
          <ModuleContent courseId={courseId} lessons={lessons} quizzes={quizzes} />
        </section>
      )}
    </PageContainer>
  );
}
