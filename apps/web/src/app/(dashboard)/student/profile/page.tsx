'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, ChartColumn, CheckCircle2, ChevronRight, ClipboardCheck, FlaskConical, KeyRound, Loader2, LogOut, Trophy } from 'lucide-react';
import { ProgressBar } from '@/components/features/courses/course-progress-card';
import { PageContainer } from '@/components/layout/page-header';
import { useStudentProgress } from '@/hooks/use-student-progress';
import { getStoredUser, logout } from '@/lib/auth';

const noSubscribe = () => () => {};

/** Student profile: who is signed in, learning summary, account actions (mobile "Profile" tab). */
export default function StudentProfilePage() {
  const router = useRouter();
  const { progress, loading } = useStudentProgress();
  const email = useSyncExternalStore(noSubscribe, () => getStoredUser()?.email ?? '', () => '');
  const [signingOut, setSigningOut] = useState(false);

  const courses = (progress?.courses ?? []).filter((c) => c.enrollmentStatus !== 'DROPPED');
  const lessonsDone = courses.reduce((n, c) => n + c.completedLessons, 0);
  const lessonsTotal = courses.reduce((n, c) => n + c.totalLessons, 0);
  const completed = courses.filter((c) => c.enrollmentStatus === 'COMPLETED' || c.progressPercentage >= 100).length;
  const overall = lessonsTotal > 0 ? Math.round((lessonsDone / lessonsTotal) * 100) : 0;
  const name = progress?.studentName ?? 'Student';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const onSignOut = async () => {
    setSigningOut(true);
    await logout();
    router.replace('/login');
  };

  const stats = [
    { icon: BookOpen, label: 'Courses enrolled', value: courses.length },
    { icon: CheckCircle2, label: 'Lessons completed', value: lessonsDone },
    { icon: Trophy, label: 'Courses completed', value: completed },
  ];

  return (
    <PageContainer className="max-w-3xl space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-strong to-brand p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10" aria-hidden="true" />
        <div className="relative flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-xl font-bold text-brand-strong shadow">
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : initials || 'S'}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{name}</h1>
            <p className="truncate text-sm text-white/75">{email}</p>
            <span className="mt-1.5 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">Student</span>
          </div>
        </div>
        <div className="relative mt-6">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-white/80">Overall progress</span>
            <span className="font-semibold">{overall}%</span>
          </div>
          <ProgressBar value={overall} tone="light" className="h-2" />
        </div>
      </section>

      <section aria-label="Learning summary" className="grid grid-cols-3 gap-3">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-2xl border bg-white p-4 text-center shadow-sm">
            <Icon className="mx-auto h-5 w-5 text-brand" aria-hidden="true" />
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <h2 className="px-5 pb-2 pt-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Account</h2>
        <ul className="divide-y">
          {[
            { href: '/student/performance', icon: ChartColumn, label: 'My Performance' },
            { href: '/student/courses', icon: BookOpen, label: 'My Courses' },
            { href: '/student/quizzes', icon: ClipboardCheck, label: 'Tests & Exams' },
            { href: '/student/labs', icon: FlaskConical, label: 'Practice Labs' },
            { href: '/change-password', icon: KeyRound, label: 'Change password' },
          ].map(({ href, icon: Icon, label }) => (
            <li key={href}>
              <Link href={href} className="flex min-h-14 items-center gap-3 px-5 text-sm font-medium text-slate-800 hover:bg-slate-50">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="flex-1">{label}</span>
                <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden="true" />
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={onSignOut}
              disabled={signingOut}
              className="flex min-h-14 w-full items-center gap-3 px-5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
                {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              </span>
              Sign out
            </button>
          </li>
        </ul>
      </section>
    </PageContainer>
  );
}
