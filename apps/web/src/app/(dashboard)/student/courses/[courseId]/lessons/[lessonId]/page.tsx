'use client';

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ReactPlayer from 'react-player';
import { CheckCircle2, ChevronLeft, ClipboardCheck, Loader2, Lock, PlayCircle, VideoOff } from 'lucide-react';
import { ProgressBar } from '@/components/features/courses/course-progress-card';
import { ModuleContent } from '@/components/features/student/module-content';
import { EmptyState } from '@/components/features/student/student-ui';
import { PageContainer } from '@/components/layout/page-header';
import { blockerText, formatDuration, nextStep, type Blocker, type CourseLesson, type CourseQuiz } from '@/hooks/use-student-overview';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

interface LessonData {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  duration: number | null;
  module: { id: string; title: string; course: { id: string; title: string } };
}

interface ProgressData {
  id: string | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  lastPosition: number;
  watchedDuration: number;
  completedAt: string | null;
}

type Tab = 'lessons' | 'about';

/** API error body for a lesson the student has not reached yet (learning order / quiz gate) */
interface LockedInfo {
  message: string;
  blockedBy: Blocker | null;
}

const errorInfo = (err: unknown) =>
  (err as { response?: { status?: number; data?: { message?: string; code?: string; blockedBy?: Blocker | null } } }).response;

/** Lesson player (TAXBROS mobile design): video on top, title, tabs and the module content list. */
export default function LessonVideoPlayerPage() {
  const params = useParams();
  const lessonId = params.lessonId as string;
  const courseId = params.courseId as string;

  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [courseLessons, setCourseLessons] = useState<CourseLesson[]>([]);
  const [courseQuizzes, setCourseQuizzes] = useState<CourseQuiz[]>([]);
  const [locked, setLocked] = useState<LockedInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [tab, setTab] = useState<Tab>('lessons');

  // react-player v3 exposes the underlying media element (HTMLVideoElement API)
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const resumedRef = useRef(false);
  const lastUpdateRef = useRef<number>(0);
  // First watch: no skipping ahead past the furthest point watched. Rewatching a completed lesson is free.
  const maxWatchedRef = useRef(0);
  const completedRef = useRef(false);
  const [skipNotice, setSkipNotice] = useState(false);

  // Course outline with lock state; reloaded after the lesson completes so the next step unlocks
  const loadOutline = useCallback(async () => {
    try {
      const { data } = await apiClient.get<{ lessons?: CourseLesson[]; quizzes?: CourseQuiz[] }>(`/courses/${courseId}/progress`);
      setCourseLessons(data.lessons ?? []);
      setCourseQuizzes(data.quizzes ?? []);
    } catch {
      // The outline is a nice-to-have: the lesson still plays if it fails
    }
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;
    resumedRef.current = false;
    lastUpdateRef.current = 0;
    maxWatchedRef.current = 0;
    completedRef.current = false;
    (async () => {
      try {
        setLoading(true);
        const [l, p] = await Promise.all([apiClient.get<LessonData>(`/lessons/${lessonId}`), apiClient.get<ProgressData>(`/lessons/${lessonId}/progress`)]);
        if (cancelled) return;
        setLesson(l.data);
        setProgress(p.data);
        maxWatchedRef.current = p.data.lastPosition || 0;
        completedRef.current = p.data.status === 'COMPLETED';
        setError(null);
        setLocked(null);
      } catch (err) {
        const res = errorInfo(err);
        if (!cancelled) {
          if (res?.status === 403 && res.data?.code === 'LESSON_LOCKED') {
            setLocked({ message: res.data.message || 'This lesson is locked', blockedBy: res.data.blockedBy ?? null });
          } else {
            setError(res?.data?.message || 'We could not load this lesson.');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    loadOutline();
    return () => {
      cancelled = true;
    };
  }, [lessonId, courseId, loadOutline]);

  useEffect(() => {
    completedRef.current = progress?.status === 'COMPLETED';
  }, [progress?.status]);

  useEffect(() => {
    if (!skipNotice) return;
    const id = setTimeout(() => setSkipNotice(false), 4000);
    return () => clearTimeout(id);
  }, [skipNotice]);

  /** On a first watch, send the video back if it jumped past what has been watched. True if it did. */
  const blockSkip = (player: HTMLVideoElement) => {
    if (completedRef.current) return false;
    if ((player.currentTime || 0) > maxWatchedRef.current + 2) {
      player.currentTime = maxWatchedRef.current;
      setSkipNotice(true);
      return true;
    }
    return false;
  };

  const handleSeeking = (event: SyntheticEvent<HTMLVideoElement>) => {
    blockSkip(event.currentTarget);
  };

  const markLocal = (status: ProgressData['status']) =>
    setCourseLessons((ls) => ls.map((l) => (l.lessonId === lessonId ? { ...l, status } : l)));

  const resumeFromLastPosition = () => {
    const player = playerRef.current;
    if (resumedRef.current || !player || !progress || progress.lastPosition <= 0) return;
    resumedRef.current = true;
    lastUpdateRef.current = progress.lastPosition;
    player.currentTime = progress.lastPosition;
  };

  // Save the position every 10 seconds of playback
  const updatePosition = async (currentTime: number) => {
    if (!progress || !lesson) return;
    try {
      // The API answers { lessonProgress, autoCompleted }
      const { data } = await apiClient.patch<{ lessonProgress?: ProgressData; autoCompleted?: boolean }>(`/lessons/${lessonId}/progress`, {
        position: currentTime,
      });
      const saved = data.lessonProgress;
      if (saved) {
        setProgress(saved);
        if (saved.status !== 'NOT_STARTED') markLocal(saved.status);
      }
      // Finished the video (90%): the lesson quiz or the next lesson unlocks
      if (data.autoCompleted || saved?.status === 'COMPLETED') loadOutline();
    } catch (err) {
      console.error('Error updating position:', err);
    }
  };

  const handleTimeUpdate = (event: SyntheticEvent<HTMLVideoElement>) => {
    const player = event.currentTarget;
    // Some players skip without a "seeking" event: catch the jump here too
    if (blockSkip(player)) return;
    maxWatchedRef.current = Math.max(maxWatchedRef.current, player.currentTime || 0);
    const currentTime = Math.floor(player.currentTime || 0);
    if (currentTime - lastUpdateRef.current >= 10) {
      lastUpdateRef.current = currentTime;
      updatePosition(currentTime);
    }
  };

  const handleMarkComplete = async () => {
    try {
      setCompleting(true);
      setActionError(null);
      const { data } = await apiClient.post<{ lessonProgress: ProgressData }>(`/lessons/${lessonId}/complete`);
      setProgress(data.lessonProgress);
      markLocal('COMPLETED');
      loadOutline();
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setActionError(message || 'Could not mark the lesson as complete. Try again.');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <span className="sr-only">Loading lesson…</span>
      </div>
    );
  }

  if (locked) {
    const b = locked.blockedBy;
    return (
      <PageContainer className="max-w-3xl">
        <Link href={`/student/courses/${courseId}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back to course
        </Link>
        <EmptyState
          icon={Lock}
          title="This lesson is locked"
          actions={
            <>
              {b && (
                <Link
                  href={b.kind === 'QUIZ' ? `/student/quizzes/${b.id}` : `/student/courses/${courseId}/lessons/${b.id}`}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-strong px-5 text-sm font-semibold text-white hover:bg-brand"
                >
                  {b.kind === 'QUIZ' ? <ClipboardCheck className="h-4 w-4" aria-hidden="true" /> : <PlayCircle className="h-4 w-4" aria-hidden="true" />}
                  {b.kind === 'QUIZ' ? 'Take the quiz' : 'Go to that lesson'}
                </Link>
              )}
              <Link
                href={`/student/courses/${courseId}`}
                className="inline-flex h-11 items-center rounded-xl border bg-white px-5 text-sm font-semibold text-brand-strong hover:bg-slate-50"
              >
                Course outline
              </Link>
            </>
          }
        >
          Lessons open one by one. {blockerText(b)}, then this lesson unlocks.
        </EmptyState>
      </PageContainer>
    );
  }

  if (error || !lesson || !progress) {
    return (
      <PageContainer className="max-w-3xl">
        <Link href={`/student/courses/${courseId}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back to course
        </Link>
        <EmptyState
          icon={VideoOff}
          title="Lesson not available"
          actions={
            <Link href={`/student/courses/${courseId}`} className="inline-flex h-11 items-center rounded-xl bg-brand-strong px-5 text-sm font-semibold text-white hover:bg-brand">
              Back to course
            </Link>
          }
        >
          {error || 'This lesson could not be found.'} It may have been moved or unpublished.
        </EmptyState>
      </PageContainer>
    );
  }

  const isCompleted = progress.status === 'COMPLETED';
  const done = courseLessons.filter((l) => l.status === 'COMPLETED').length;
  const coursePct = courseLessons.length > 0 ? Math.round((done / courseLessons.length) * 100) : 0;
  const index = courseLessons.findIndex((l) => l.lessonId === lessonId);
  const following = index >= 0 ? courseLessons[index + 1] : undefined;
  // The quiz the student must pass now (this lesson's, or the module test after the module's last lesson)
  const step = nextStep(courseId, courseLessons, courseQuizzes);
  const quizToPass = isCompleted && step?.kind === 'quiz' ? step.quiz : undefined;

  const moduleContent = (
    <section aria-label="Module content">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <h2 className="text-base font-bold text-slate-900">Module Content</h2>
        <span className="text-sm font-semibold text-slate-700">{coursePct}%</span>
      </div>
      <ProgressBar value={coursePct} className="mb-3 h-2" />
      {courseLessons.length > 0 ? (
        <ModuleContent courseId={courseId} lessons={courseLessons} quizzes={courseQuizzes} currentLessonId={lessonId} />
      ) : (
        <p className="px-1 py-4 text-sm text-slate-500">The course outline is not available right now.</p>
      )}
    </section>
  );

  const about = (
    <section aria-label="About this lesson" className="text-sm leading-relaxed text-slate-700">
      {lesson.description ? <p className="whitespace-pre-wrap">{lesson.description}</p> : <p className="text-slate-500">No notes for this lesson.</p>}
    </section>
  );

  return (
    <div className="lg:mx-auto lg:max-w-7xl lg:px-8 lg:py-8">
      <Link
        href={`/student/courses/${courseId}`}
        className="mb-4 hidden items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900 md:inline-flex lg:mb-5"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {lesson.module.course.title}
      </Link>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-8">
        <div className="min-w-0">
          {/* Phones: dark bar above the video, like the app design */}
          <div className="flex h-12 items-center gap-2 bg-slate-950 px-2 text-white md:hidden">
            <Link href={`/student/courses/${courseId}`} aria-label="Back to course" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <span className="truncate text-sm font-medium text-white/80">{lesson.module.course.title}</span>
          </div>
          <div className="aspect-video overflow-hidden bg-black md:rounded-2xl md:shadow-lg">
            <ReactPlayer
              ref={playerRef}
              src={lesson.videoUrl}
              width="100%"
              height="100%"
              controls
              playing={isPlaying}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
              onSeeking={handleSeeking}
              onReady={resumeFromLastPosition}
              onLoadedMetadata={resumeFromLastPosition}
              config={{ youtube: { rel: 0 } }}
            />
          </div>

          {skipNotice && (
            <p role="status" className="flex items-center gap-2 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 md:mt-3 md:rounded-xl">
              <Lock className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              Skipping ahead opens after you have watched this lesson once. Going back is fine.
            </p>
          )}

          <div className="min-h-[60vh] bg-white px-4 pb-8 pt-5 sm:px-6 md:min-h-0 md:bg-transparent md:px-0 md:pb-0">
            <h1 className="font-display text-xl font-extrabold leading-tight text-slate-900 sm:text-2xl">{lesson.title}</h1>
            <p className="mt-1 text-sm text-slate-500 sm:text-base">
              {lesson.module.course.title} · {lesson.module.title}
              {lesson.duration ? ` · ${formatDuration(lesson.duration)}` : ''}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {isCompleted ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Completed
                </span>
              ) : lesson.duration ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-border">
                  <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" /> Watch to the end to complete
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleMarkComplete}
                  disabled={completing}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-strong px-4 text-xs font-semibold text-white hover:bg-brand disabled:opacity-60"
                >
                  {completing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Mark as complete
                </button>
              )}
              {following &&
                (following.locked ? (
                  <span
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-slate-100 px-4 text-xs font-semibold text-slate-400"
                    title={blockerText(following.blockedBy)}
                  >
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Next lesson
                  </span>
                ) : (
                  <Link
                    href={`/student/courses/${courseId}/lessons/${following.lessonId}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-semibold text-brand-strong ring-1 ring-border hover:bg-brand-soft"
                  >
                    <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" /> Next lesson
                  </Link>
                ))}
            </div>

            {/* Video done, quiz pending: the gate to the next lesson or module */}
            {quizToPass && (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-brand/20 bg-brand-soft/50 p-4 sm:flex-row sm:items-center">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-strong shadow-sm">
                  <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">
                    {quizToPass.attachmentType === 'MODULE' ? 'Module test' : 'Lesson quiz'}: {quizToPass.title}
                  </p>
                  <p className="text-xs text-slate-600 sm:text-sm">
                    Score {quizToPass.passMark}/{quizToPass.totalMarks} or more to unlock the next {quizToPass.attachmentType === 'MODULE' ? 'module' : 'lesson'}. You can
                    rewatch the video and try as many times as you need.
                  </p>
                </div>
                <Link
                  href={`/student/quizzes/${quizToPass.quizId}`}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-strong px-4 text-sm font-semibold text-white hover:bg-brand"
                >
                  {quizToPass.attemptCount > 0 ? 'Try again' : 'Take quiz'}
                </Link>
              </div>
            )}
            {actionError && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {actionError}
              </p>
            )}

            {/* Phones and tablets: tabs; desktop shows About here and the outline on the right */}
            <div role="tablist" aria-label="Lesson sections" className="mt-6 flex gap-6 border-b lg:hidden">
              {(
                [
                  ['lessons', 'Lessons'],
                  ['about', 'About'],
                ] as Array<[Tab, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={cn(
                    '-mb-px border-b-2 pb-2.5 text-sm font-semibold transition-colors',
                    tab === key ? 'border-brand-strong text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 lg:hidden">{tab === 'lessons' ? moduleContent : about}</div>

            <div className="mt-6 hidden rounded-[1.25rem] border bg-white p-6 shadow-sm lg:block">
              <h2 className="mb-2 text-base font-bold text-slate-900">About this lesson</h2>
              {about}
            </div>
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-[1.25rem] border bg-white p-5 shadow-sm">{moduleContent}</div>
        </aside>
      </div>
    </div>
  );
}
