'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Calculator,
  ChartColumn,
  Check,
  ClipboardCheck,
  Clock,
  FlaskConical,
  Hourglass,
  Loader2,
  Play,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { CourseProgressCard, ProgressBar } from '@/components/features/courses/course-progress-card';
import {
  ComingSoonPill,
  InitialsAvatar,
  LabShortcuts,
  QuietNote,
  SectionHeading,
} from '@/components/features/student/student-ui';
import { PageContainer } from '@/components/layout/page-header';
import { continueCourse, greeting, type StudentCourse } from '@/hooks/use-student-progress';
import { groupByModule, hasNoLessons, nextStep, testAverage, useStudentOverview, type NextStep } from '@/hooks/use-student-overview';
import { cn } from '@/lib/utils';

const heroClass =
  'relative overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-brand-strong via-[#135d6e] to-brand p-5 text-white shadow-lg sm:p-7';

function HeroDecor() {
  return (
    <>
      <span className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/10" aria-hidden="true" />
      <span className="pointer-events-none absolute -bottom-24 right-20 h-44 w-44 rounded-full bg-white/5" aria-hidden="true" />
      <Calculator className="pointer-events-none absolute -right-3 bottom-3 h-28 w-28 rotate-[-12deg] text-white/[0.07] sm:h-36 sm:w-36" aria-hidden="true" />
    </>
  );
}

/** Student Home (TAXBROS mobile design: greeting, Continue Learning, shortcuts, This Week's Focus). */
export default function StudentDashboardPage() {
  const { progress, lessonsByCourse, quizzesByCourse, quizzes, loading, error } = useStudentOverview();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <span className="sr-only">Loading your dashboard…</span>
      </div>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      </PageContainer>
    );
  }

  const name = progress?.studentName || 'Student';
  const firstName = name.split(' ')[0];
  const courses = (progress?.courses ?? []).filter((c) => c.enrollmentStatus !== 'DROPPED');
  const active = courses.filter((c) => c.enrollmentStatus === 'ACTIVE');
  const withLessons = active.filter((c) => !hasNoLessons(c));
  const waiting = active.filter(hasNoLessons);
  const completedCount = courses.filter((c) => c.enrollmentStatus === 'COMPLETED' || c.progressPercentage >= 100).length;
  const pendingQuizzes = quizzes.filter((q) => !q.passed);
  const average = testAverage(quizzes);
  const nothingPublished = courses.every(hasNoLessons);
  const current = continueCourse(withLessons);
  // Next step in learning order: a lesson to watch, or a quiz to pass before the next lesson opens
  const stepIn = (courseId: string) => nextStep(courseId, lessonsByCourse.get(courseId), quizzesByCourse.get(courseId));
  const currentNext = current ? stepIn(current.courseId) : undefined;
  // "Direct Tax – Module 3" over the module name, as in the mobile design
  const currentModule =
    current && currentNext ? groupByModule(lessonsByCourse.get(current.courseId) ?? []).find((g) => g.title === currentNext.moduleTitle) : undefined;

  // This week's focus: the next lesson in each course, then quizzes (passed ones ticked)
  const steps = withLessons
    .map((c) => ({ course: c, next: stepIn(c.courseId) }))
    .filter((f): f is { course: StudentCourse; next: NextStep } => !!f.next)
    .slice(0, 3);
  const stepQuizIds = new Set(steps.flatMap((f) => (f.next.kind === 'quiz' ? [f.next.quiz.quizId] : [])));
  const focus = [
    ...steps.map(({ course, next }) => ({
      key: `step-${course.courseId}`,
      label: next.kind === 'quiz' ? `Pass “${next.title}” to unlock the next lesson` : `Complete “${next.title}”`,
      hint: course.courseTitle,
      href: next.href,
      done: false,
    })),
    // Other tests: open ones still to pass first, then passed ones ticked (locked ones wait their turn)
    ...[...pendingQuizzes.filter((q) => !q.locked), ...quizzes.filter((q) => q.passed)]
      .filter((q) => !stepQuizIds.has(q.id))
      .slice(0, 3)
      .map((q) => ({
      key: `quiz-${q.id}`,
      label: q.passed ? `Passed “${q.title}”` : `Attempt “${q.title}”`,
      hint: q.courseTitle,
      href: `/student/quizzes/${q.id}`,
      done: q.passed,
    })),
  ];

  const header = (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-slate-500 sm:text-base">{greeting()},</p>
        <h1 className="truncate font-display text-2xl font-extrabold text-slate-900 sm:text-3xl">
          {firstName} <span aria-hidden="true">👋</span>
        </h1>
      </div>
      <Link href="/student/profile" aria-label="Your profile" className="rounded-full md:hidden">
        <InitialsAvatar name={name} />
      </Link>
    </div>
  );

  /* ---------- New student: not enrolled in anything yet ---------- */
  if (courses.length === 0) {
    return (
      <PageContainer className="space-y-6 sm:space-y-8">
        {header}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 space-y-6">
            <section className={heroClass}>
              <HeroDecor />
              <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Welcome to TAXBROS
              </span>
              <h2 className="relative mt-3 font-display text-xl font-extrabold leading-tight sm:text-2xl">Your courses will appear here</h2>
              <p className="relative mt-1.5 max-w-lg text-sm text-white/80 sm:text-base">
                The institute enrols you in courses after admission. Until then, the practice labs are open: try filing a GST
                return with sample data.
              </p>
              <div className="relative mt-5 flex flex-wrap gap-2.5">
                <Link href="/student/labs" className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-brand-strong shadow-sm hover:bg-brand-soft">
                  <FlaskConical className="h-4 w-4" aria-hidden="true" /> Open practice labs
                </Link>
                <Link href="/student/profile" className="inline-flex h-11 items-center rounded-xl bg-white/15 px-4 text-sm font-semibold hover:bg-white/25">
                  View my profile
                </Link>
              </div>
            </section>

            <section className="rounded-[1.25rem] border bg-white p-5 shadow-sm">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-bold text-slate-900 sm:text-lg">Getting started</h2>
                <span className="text-xs text-slate-500">1 of 3 done</span>
              </div>
              <ol className="mt-2 divide-y">
                <li className="flex items-start gap-3.5 py-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">Your account is ready</span>
                    <span className="block text-xs text-slate-500 sm:text-sm">You can sign in on any phone or computer.</span>
                  </span>
                </li>
                <li className="flex items-start gap-3.5 py-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-sm font-bold text-orange-700 ring-2 ring-inset ring-orange-200">
                    2
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">Get enrolled in a course</span>
                    <span className="block text-xs text-slate-500 sm:text-sm">Your institute administrator adds you to your batch&apos;s courses.</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                    <Hourglass className="h-3.5 w-3.5" aria-hidden="true" /> Waiting
                  </span>
                </li>
                <li className="flex items-start gap-3.5 py-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-400">3</span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-500">Watch your first lesson</span>
                    <span className="block text-xs text-slate-500 sm:text-sm">Lessons, tests and your progress show up here.</span>
                  </span>
                </li>
              </ol>
            </section>

            <section>
              <SectionHeading title="Practise while you wait" href="/student/labs" linkLabel="All labs" />
              <LabShortcuts />
            </section>
          </div>

          <aside className="min-w-0 space-y-6">
            <section className="rounded-[1.25rem] border bg-white p-5 shadow-sm">
              <SectionHeading title="This Week's Focus" icon={Target} />
              <QuietNote icon={BookOpen} title="No lessons scheduled">
                Your weekly plan starts once you are enrolled in a course.
              </QuietNote>
            </section>
            <section className="rounded-[1.25rem] border bg-white p-5 shadow-sm">
              <SectionHeading title="Tests & Exams" icon={ClipboardCheck} />
              <QuietNote icon={ClipboardCheck} title="No tests yet">
                Tests from your courses will be listed here.
              </QuietNote>
            </section>
          </aside>
        </div>
      </PageContainer>
    );
  }

  /* ---------- Enrolled ---------- */
  const tiles = [
    { href: '/student/courses', icon: BookOpen, title: 'My Courses', text: `${courses.length} Enrolled`, tone: 'bg-brand-soft text-brand-strong' },
    { href: '/student/labs', icon: FlaskConical, title: 'Practice Labs', text: 'GST · ITR · MCA', tone: 'bg-orange-50 text-flame' },
    {
      href: '/student/quizzes',
      icon: ClipboardCheck,
      title: 'Tests & Exams',
      text: quizzes.length === 0 ? 'None yet' : `${pendingQuizzes.length} Pending`,
      tone: 'bg-rose-50 text-rose-500',
    },
    {
      href: '/student/performance',
      icon: ChartColumn,
      title: 'My Performance',
      text: average === undefined ? `${completedCount} completed` : `${average}% test average`,
      tone: 'bg-indigo-50 text-indigo-600',
    },
  ];

  let hero;
  if (current) {
    hero = (
      <section className={heroClass}>
        <HeroDecor />
        <span className="relative inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-strong">
          <Play className="h-3 w-3 fill-current" aria-hidden="true" /> Continue Learning
        </span>
        <h2 className="relative mt-3 line-clamp-2 font-display text-xl font-extrabold leading-tight sm:text-2xl">
          {current.courseTitle}
          {currentModule && ` – Module ${currentModule.number}`}
        </h2>
        <p className="relative mt-1 line-clamp-1 text-sm text-white/80">
          {currentModule ? currentModule.title : `${current.completedLessons} of ${current.totalLessons} lessons done`}
        </p>
        {currentNext && (
          <p className="relative mt-0.5 line-clamp-1 text-xs text-white/60">
            Next: {currentNext.kind === 'quiz' ? `Quiz – ${currentNext.title}` : currentNext.title}
          </p>
        )}
        <div className="relative mt-5 flex items-end gap-4">
          <div className="min-w-0 flex-1">
            <ProgressBar value={current.progressPercentage} tone="light" className="h-2" />
            <p className="mt-2 text-sm font-semibold text-white/90">{current.progressPercentage}% Completed</p>
          </div>
          <Link
            href={currentNext ? currentNext.href : `/student/courses/${current.courseId}`}
            aria-label={`Continue ${current.courseTitle}`}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-strong shadow-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Play className="h-5 w-5 fill-current" />
          </Link>
        </div>
      </section>
    );
  } else if (waiting.length > 0) {
    const course = waiting[0];
    hero = (
      <section className={heroClass}>
        <HeroDecor />
        <ComingSoonPill className="relative" />
        <h2 className="relative mt-3 line-clamp-2 font-display text-xl font-extrabold leading-tight sm:text-2xl">{course.courseTitle}</h2>
        <p className="relative mt-1.5 max-w-lg text-sm text-white/80 sm:text-base">
          You are enrolled. Your instructor is still preparing the lessons, and they will appear here as soon as they are published.
        </p>
        <div className="relative mt-5 flex flex-wrap gap-2.5">
          <Link href={`/student/courses/${course.courseId}`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-brand-strong shadow-sm hover:bg-brand-soft">
            View course <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/student/labs" className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-semibold hover:bg-white/25">
            <FlaskConical className="h-4 w-4" aria-hidden="true" /> Practise in a lab
          </Link>
        </div>
      </section>
    );
  } else {
    hero = (
      <section className={heroClass}>
        <HeroDecor />
        <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
          <Trophy className="h-3.5 w-3.5" aria-hidden="true" /> All caught up
        </span>
        <h2 className="relative mt-3 font-display text-xl font-extrabold leading-tight sm:text-2xl">You have finished every lesson</h2>
        <p className="relative mt-1.5 max-w-lg text-sm text-white/80 sm:text-base">Review a course, retake a test, or keep your skills sharp in the practice labs.</p>
        <div className="relative mt-5 flex flex-wrap gap-2.5">
          <Link href="/student/courses" className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-brand-strong shadow-sm hover:bg-brand-soft">
            Review courses <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <PageContainer className="space-y-6 sm:space-y-8">
      {header}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          {hero}

          <section aria-label="Shortcuts" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {tiles.map(({ href, icon: Icon, title, text, tone }) => (
              <Link
                key={title}
                href={href}
                className="rounded-[1.25rem] border bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tone)}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-3 text-[15px] font-bold text-slate-900">{title}</p>
                <p className="mt-0.5 text-xs text-slate-500 sm:text-[13px]">{text}</p>
              </Link>
            ))}
          </section>

          {/* Phones follow the mobile design (focus list under the shortcuts); larger screens show it in the side column */}
          <FocusCard focus={focus} nothingPublished={nothingPublished} className="lg:hidden" />

          <section className="hidden sm:block">
            <SectionHeading title="My Courses" href="/student/courses" />
            <div className="grid gap-4 sm:grid-cols-2">
              {courses.slice(0, 4).map((course) => (
                <CourseProgressCard key={course.enrollmentId} course={course} href={`/student/courses/${course.courseId}`} />
              ))}
            </div>
          </section>

          {!current && waiting.length > 0 && (
            <section>
              <SectionHeading title="Practise while you wait" href="/student/labs" linkLabel="All labs" />
              <LabShortcuts />
            </section>
          )}
        </div>

        <aside className="hidden min-w-0 space-y-6 lg:block">
          <FocusCard focus={focus} nothingPublished={nothingPublished} />
          <section className="rounded-[1.25rem] border bg-white p-5 shadow-sm">
            <SectionHeading title="Tests & Exams" href={quizzes.length > 0 ? '/student/quizzes' : undefined} />
            {quizzes.length === 0 ? (
              <QuietNote icon={ClipboardCheck} title="No tests yet">
                Tests appear when your instructor publishes them.
              </QuietNote>
            ) : (
              <ul className="space-y-2.5">
                {quizzes.slice(0, 4).map((quiz) => (
                  <li key={quiz.id}>
                    <Link
                      href={`/student/quizzes/${quiz.id}`}
                      className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-brand/40 hover:bg-brand-soft/30"
                    >
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', quiz.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500')}>
                        {quiz.passed ? <Trophy className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{quiz.title}</span>
                        <span className="block truncate text-xs text-slate-500">{quiz.courseTitle}</span>
                      </span>
                      <span className="text-xs font-semibold text-brand-strong">{quiz.passed ? 'Passed' : quiz.attemptCount > 0 ? 'Retake' : 'Start'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </PageContainer>
  );
}

interface FocusItem {
  key: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

/** "This Week's Focus" checklist; honest wording when there is nothing to do yet. */
function FocusCard({ focus, nothingPublished, className }: { focus: FocusItem[]; nothingPublished: boolean; className?: string }) {
  return (
    <section className={cn('rounded-[1.25rem] border bg-white p-5 shadow-sm', className)}>
      <SectionHeading title="This Week's Focus" icon={Target} href={focus.length > 0 ? '/student/courses' : undefined} />
      {focus.length === 0 ? (
        nothingPublished ? (
          <QuietNote icon={Clock} title="Nothing to watch yet">
            Your next lessons will be listed here once your course has some.
          </QuietNote>
        ) : (
          <QuietNote icon={Trophy} title="All caught up">
            You have no lessons or tests waiting this week.
          </QuietNote>
        )
      ) : (
        <ul className="space-y-0.5">
          {focus.map((f) => (
            <li key={f.key}>
              <Link href={f.href} className="group flex items-start gap-3 rounded-lg py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2',
                    f.done ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white',
                  )}
                  aria-label={f.done ? 'Done' : 'To do'}
                >
                  {f.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm font-medium text-slate-800 group-hover:text-brand-strong', f.done && 'text-slate-400 line-through')}>
                    {f.label}
                  </span>
                  {f.hint && <span className="block truncate text-xs text-slate-500">{f.hint}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
