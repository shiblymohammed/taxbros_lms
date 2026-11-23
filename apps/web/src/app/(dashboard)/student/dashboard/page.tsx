'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock,
  FlaskConical,
  Loader2,
  Play,
  Target,
  Trophy,
} from 'lucide-react';
import { CourseProgressCard, ProgressBar } from '@/components/features/courses/course-progress-card';
import { PageContainer } from '@/components/layout/page-header';
import { apiClient, quizzesApi, type Quiz } from '@/lib/api';
import { continueCourse, greeting } from '@/hooks/use-student-progress';
import { cn } from '@/lib/utils';

interface Course {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  courseCoverImage: string | null;
  enrollmentStatus: 'ACTIVE' | 'COMPLETED' | 'DROPPED';
  progressPercentage: number;
  totalLessons: number;
  completedLessons: number;
  lastAccessedAt: string | null;
  enrolledAt: string;
}

interface StudentProgress {
  studentId: string;
  studentName: string;
  courses: Course[];
}

interface NextLesson {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
}

interface AvailableQuiz extends Quiz {
  courseTitle?: string;
  attemptCount: number;
  bestScore?: number;
  bestAttemptPassed: boolean;
  lastAttemptDate?: string;
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [nextLessons, setNextLessons] = useState<Map<string, NextLesson>>(new Map());
  const [availableQuizzes, setAvailableQuizzes] = useState<AvailableQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // The signed-in user's Student profile ID (students cannot list /students)
        const userResponse = await apiClient.get<{ studentId: string | null }>('/auth/me');
        const studentId = userResponse.data.studentId;

        if (!studentId) {
          setError('No student profile found for this user');
          setLoading(false);
          return;
        }

        // Fetch student progress
        const progressResponse = await apiClient.get(`/students/${studentId}/progress`);
        setProgress(progressResponse.data);

        // Fetch next unwatched lesson for each enrolled course
        const nextLessonsMap = new Map<string, NextLesson>();
        for (const course of progressResponse.data.courses) {
          if (course.enrollmentStatus === 'ACTIVE') {
            try {
              const courseProgressResponse = await apiClient.get(`/courses/${course.courseId}/progress`);
              const courseProgress = courseProgressResponse.data;
              
              // Find the first lesson that is not completed
              const nextLesson = courseProgress.lessons?.find(
                (lesson: any) => lesson.status !== 'COMPLETED'
              );
              
              if (nextLesson) {
                nextLessonsMap.set(course.courseId, {
                  courseId: course.courseId,
                  lessonId: nextLesson.lessonId,
                  lessonTitle: nextLesson.lessonTitle,
                  moduleTitle: nextLesson.moduleTitle,
                });
              }
            } catch (err) {
              console.error(`Failed to fetch next lesson for course ${course.courseId}:`, err);
            }
          }
        }
        setNextLessons(nextLessonsMap);

        // Fetch available quizzes (published quizzes in enrolled courses)
        try {
          const quizzesResponse = await quizzesApi.getAvailableQuizzes(studentId);
          
          // Filter quizzes to only those in enrolled courses
          const enrolledCourseIds = progressResponse.data.courses
            .filter((c: Course) => c.enrollmentStatus === 'ACTIVE')
            .map((c: Course) => c.courseId);
          
          // The API already limits students to their enrolled courses; owningCourseId also covers
          // quizzes attached to a module or a lesson
          const courseOf = (quiz: Quiz) => quiz.owningCourseId ?? quiz.courseId;
          const enrolledQuizzes = quizzesResponse.filter((quiz: Quiz) => {
            const courseId = courseOf(quiz);
            return !!courseId && enrolledCourseIds.includes(courseId);
          });

          // Fetch attempt history for each quiz
          const enrichedQuizzes: AvailableQuiz[] = [];
          
          for (const quiz of enrolledQuizzes) {
            try {
              const attempts = await quizzesApi.getQuizAttempts(quiz.id);
              
              // Calculate best score and attempt count
              const bestAttempt = attempts.reduce((best, current) => {
                return current.score > (best?.score || 0) ? current : best;
              }, attempts[0]);

              const courseTitle = progressResponse.data.courses.find(
                (c: Course) => c.courseId === courseOf(quiz)
              )?.courseTitle || 'Unknown Course';

              enrichedQuizzes.push({
                ...quiz,
                courseTitle,
                attemptCount: attempts.length,
                bestScore: bestAttempt?.score,
                bestAttemptPassed: bestAttempt?.passed || false,
                lastAttemptDate: attempts[0]?.submittedAt,
              });
            } catch {
              // No attempts yet for this quiz
              const courseTitle = progressResponse.data.courses.find(
                (c: Course) => c.courseId === courseOf(quiz)
              )?.courseTitle || 'Unknown Course';

              enrichedQuizzes.push({
                ...quiz,
                courseTitle,
                attemptCount: 0,
                bestAttemptPassed: false,
              });
            }
          }
          
          setAvailableQuizzes(enrichedQuizzes);
        } catch (err) {
          console.error('Failed to fetch quizzes:', err);
        }
      } catch (err: any) {
        console.error('Error fetching student dashboard data:', err);
        setError(err.response?.data?.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleContinueLearning = (courseId: string) => {
    const nextLesson = nextLessons.get(courseId);
    if (nextLesson) {
      router.push(`/student/courses/${courseId}/lessons/${nextLesson.lessonId}`);
    } else {
      router.push(`/student/courses/${courseId}`);
    }
  };

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
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center" role="alert">
        <p className="text-lg text-red-600">{error}</p>
      </div>
    );
  }

  const courses = progress?.courses ?? [];
  const activeCourses = courses.filter((c) => c.enrollmentStatus === 'ACTIVE');
  const completedCount = courses.filter((c) => c.enrollmentStatus === 'COMPLETED' || c.progressPercentage >= 100).length;
  const current = continueCourse(courses);
  const currentNext = current ? nextLessons.get(current.courseId) : undefined;
  const pendingQuizzes = availableQuizzes.filter((q) => !q.bestAttemptPassed);
  const firstName = (progress?.studentName || 'Student').split(' ')[0];

  // This week's focus: the next lesson in each course, then quizzes still to pass
  const focus = [
    ...activeCourses
      .map((c) => ({ course: c, next: nextLessons.get(c.courseId) }))
      .filter((f): f is { course: Course; next: NextLesson } => !!f.next)
      .slice(0, 3)
      .map(({ course, next }) => ({
        key: `lesson-${course.courseId}`,
        label: `Watch “${next.lessonTitle}”`,
        hint: course.courseTitle,
        href: `/student/courses/${course.courseId}/lessons/${next.lessonId}`,
        done: false,
      })),
    ...availableQuizzes.slice(0, 3).map((q) => ({
      key: `quiz-${q.id}`,
      label: q.bestAttemptPassed ? `Passed “${q.title}”` : `Attempt “${q.title}”`,
      hint: q.courseTitle ?? '',
      href: `/student/quizzes/${q.id}`,
      done: q.bestAttemptPassed,
    })),
  ];

  const tiles = [
    { href: '/student/courses', icon: BookOpen, title: 'My Courses', text: `${activeCourses.length} enrolled`, tone: 'bg-brand-soft text-brand-strong' },
    { href: '/student/labs', icon: FlaskConical, title: 'Practice Labs', text: 'GST · ITR · MCA', tone: 'bg-orange-50 text-flame' },
    { href: '#quizzes', icon: ClipboardCheck, title: 'Tests & Quizzes', text: `${pendingQuizzes.length} pending`, tone: 'bg-rose-50 text-rose-500' },
    { href: '/student/courses', icon: Trophy, title: 'Completed', text: `${completedCount} course${completedCount === 1 ? '' : 's'}`, tone: 'bg-emerald-50 text-emerald-600' },
  ];

  return (
    <PageContainer className="space-y-6 sm:space-y-8">
      {/* Greeting */}
      <div>
        <p className="text-sm text-slate-500 sm:text-base">{greeting()},</p>
        <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
          {firstName} <span aria-hidden="true">👋</span>
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          {/* Continue learning */}
          {current ? (
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-strong via-[#135d6e] to-brand p-5 text-white shadow-lg sm:p-7">
              <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10" aria-hidden="true" />
              <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/5" aria-hidden="true" />
              <span className="relative inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-strong">
                <Play className="h-3 w-3 fill-current" aria-hidden="true" /> Continue Learning
              </span>
              <h2 className="relative mt-3 text-xl font-bold leading-tight sm:text-2xl">{current.courseTitle}</h2>
              <p className="relative mt-1 line-clamp-1 text-sm text-white/75">
                {currentNext
                  ? `${currentNext.moduleTitle} · ${currentNext.lessonTitle}`
                  : `${current.completedLessons} of ${current.totalLessons} lessons done`}
              </p>
              <div className="relative mt-5 flex items-end gap-4">
                <div className="min-w-0 flex-1">
                  <ProgressBar value={current.progressPercentage} tone="light" className="h-2" />
                  <p className="mt-2 text-sm font-medium text-white/90">{current.progressPercentage}% completed</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleContinueLearning(current.courseId)}
                  aria-label={`Continue ${current.courseTitle}`}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-strong shadow-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Play className="h-5 w-5 fill-current" />
                </button>
              </div>
            </section>
          ) : (
            <section className="rounded-3xl border border-dashed bg-white p-8 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
              <p className="mt-3 font-semibold text-slate-800">
                {activeCourses.length === 0 ? 'No active courses yet' : 'All caught up!'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {activeCourses.length === 0
                  ? 'Ask your administrator to enrol you in a course.'
                  : 'You have finished every lesson in your courses.'}
              </p>
            </section>
          )}

          {/* Quick tiles */}
          <section aria-label="Shortcuts" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {tiles.map(({ href, icon: Icon, title, text, tone }) => (
              <Link
                key={title}
                href={href}
                className="rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tone)}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-bold text-slate-900">{title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{text}</p>
              </Link>
            ))}
          </section>

          {/* Courses */}
          {activeCourses.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">My Courses</h2>
                <Link href="/student/courses" className="text-sm font-semibold text-brand hover:underline">
                  View all
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {activeCourses.slice(0, 4).map((course) => (
                  <CourseProgressCard key={course.enrollmentId} course={course} href={`/student/courses/${course.courseId}`} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="min-w-0 space-y-6">
          {/* This week's focus */}
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                <Target className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="text-base font-bold text-slate-900">This Week&apos;s Focus</h2>
            </div>
            {focus.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">Nothing pending. Great work!</p>
            ) : (
              <ul className="divide-y">
                {focus.map((f) => (
                  <li key={f.key}>
                    <Link
                      href={f.href}
                      className="group flex items-start gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {f.done ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-label="Done" />
                      ) : (
                        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" aria-label="To do" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block text-sm font-medium text-slate-800 group-hover:text-brand-strong',
                            f.done && 'text-slate-400 line-through',
                          )}
                        >
                          {f.label}
                        </span>
                        {f.hint && <span className="block truncate text-xs text-slate-500">{f.hint}</span>}
                      </span>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Quizzes */}
          <section id="quizzes" className="scroll-mt-24 rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-bold text-slate-900">Tests &amp; Quizzes</h2>
            {availableQuizzes.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">No quizzes available yet.</p>
            ) : (
              <ul className="space-y-3">
                {availableQuizzes.map((quiz) => (
                  <li key={quiz.id}>
                    <Link
                      href={`/student/quizzes/${quiz.id}`}
                      className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-brand/40 hover:bg-brand-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                          quiz.bestAttemptPassed ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500',
                        )}
                      >
                        {quiz.bestAttemptPassed ? <Trophy className="h-5 w-5" /> : <ClipboardCheck className="h-5 w-5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{quiz.title}</span>
                        <span className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                          <span>{quiz.totalMarks} marks</span>
                          {quiz.timeLimit && (
                            <span className="inline-flex items-center gap-0.5">
                              <Clock className="h-3 w-3" aria-hidden="true" /> {quiz.timeLimit} min
                            </span>
                          )}
                          {quiz.attemptCount > 0 && (
                            <span>
                              Best {quiz.bestScore}/{quiz.totalMarks}
                            </span>
                          )}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                          quiz.bestAttemptPassed
                            ? 'bg-emerald-50 text-emerald-700'
                            : quiz.attemptCount > 0
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-brand-soft text-brand-strong',
                        )}
                      >
                        {quiz.bestAttemptPassed ? 'Passed' : quiz.attemptCount > 0 ? 'Retake' : 'Start'}
                      </span>
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
