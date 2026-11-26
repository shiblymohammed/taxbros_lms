import Link from 'next/link';
import { Check, ClipboardCheck, Lock, Pause, Play, Trophy } from 'lucide-react';
import { blockerText, formatDuration, groupByModule, quizzesAfter, type CourseLesson, type CourseQuiz } from '@/hooks/use-student-overview';
import { cn } from '@/lib/utils';

/**
 * Lessons of a course grouped by module, numbered "3.2" like the TAXBROS mobile design.
 * Quizzes after videos sit under their lesson or module; locked lessons and quizzes show what to finish first.
 */
export function ModuleContent({
  courseId,
  lessons,
  quizzes,
  currentLessonId,
}: {
  courseId: string;
  lessons: CourseLesson[];
  quizzes?: CourseQuiz[];
  currentLessonId?: string;
}) {
  const modules = groupByModule(lessons);
  return (
    <div className="space-y-5">
      {modules.map((mod) => {
        const moduleQuizzes = quizzesAfter(quizzes, { moduleId: mod.lessons[0]?.moduleId });
        return (
          <section key={`${mod.number}-${mod.title}`} aria-label={`Module ${mod.number}: ${mod.title}`}>
            {modules.length > 1 && (
              <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Module {mod.number} · <span className="normal-case tracking-normal">{mod.title}</span>
              </h3>
            )}
            <ol className="space-y-1">
              {mod.lessons.map((lesson, i) => (
                <li key={lesson.lessonId}>
                  <LessonRow courseId={courseId} lesson={lesson} label={`${mod.number}.${i + 1}`} current={lesson.lessonId === currentLessonId} />
                  {quizzesAfter(quizzes, { lessonId: lesson.lessonId }).map((q) => (
                    <QuizRow key={q.quizId} quiz={q} kind="Lesson quiz" />
                  ))}
                </li>
              ))}
              {moduleQuizzes.map((q) => (
                <li key={q.quizId}>
                  <QuizRow quiz={q} kind="Module test" />
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function LessonRow({ courseId, lesson, label, current }: { courseId: string; lesson: CourseLesson; label: string; current: boolean }) {
  const done = lesson.status === 'COMPLETED';
  const body = (
    <>
      {current ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
          <Pause className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
        </span>
      ) : lesson.locked ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400" aria-label="Locked">
          <Lock className="h-3 w-3" />
        </span>
      ) : done ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-white" aria-label="Completed">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      ) : lesson.status === 'IN_PROGRESS' ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-brand text-brand" aria-label="In progress">
          <Play className="ml-px h-2.5 w-2.5 fill-current" />
        </span>
      ) : (
        <span className="h-6 w-6 shrink-0 rounded-full border-2 border-slate-300" aria-label="Not started" />
      )}
      <span className={cn('min-w-0 flex-1 leading-snug', current ? 'font-semibold text-brand-strong' : lesson.locked ? 'text-slate-400' : 'text-slate-800')}>
        <span className="mr-1.5 tabular-nums text-slate-500">{label}</span>
        {lesson.lessonTitle}
        {lesson.locked && <span className="mt-0.5 block text-xs text-slate-400">{blockerText(lesson.blockedBy)}</span>}
      </span>
      <span className="shrink-0 tabular-nums text-xs text-slate-500">{formatDuration(lesson.duration)}</span>
    </>
  );
  const rowClass = cn(
    'flex items-center gap-3 rounded-xl px-2.5 py-3 text-sm transition-colors',
    current ? 'bg-brand-soft' : lesson.locked ? 'cursor-not-allowed' : 'hover:bg-slate-50',
  );
  if (lesson.locked && !current) {
    return (
      <div className={rowClass} aria-disabled="true">
        {body}
      </div>
    );
  }
  return (
    <Link
      href={`/student/courses/${courseId}/lessons/${lesson.lessonId}`}
      aria-current={current ? 'true' : undefined}
      className={cn(rowClass, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand')}
    >
      {body}
    </Link>
  );
}

/** A quiz after a video: Passed, Take quiz (open) or Locked, with best score once attempted. */
export function QuizRow({ quiz, kind }: { quiz: CourseQuiz; kind: string }) {
  const body = (
    <>
      <span
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          quiz.passed ? 'bg-emerald-500 text-white' : quiz.locked ? 'bg-slate-100 text-slate-400' : 'bg-rose-50 text-rose-500',
        )}
        aria-hidden="true"
      >
        {quiz.passed ? <Trophy className="h-3.5 w-3.5" /> : quiz.locked ? <Lock className="h-3 w-3" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
      </span>
      <span className={cn('min-w-0 flex-1 leading-snug', quiz.locked ? 'text-slate-400' : 'text-slate-800')}>
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{kind}</span>
        <span className="font-medium">{quiz.title}</span>
        {quiz.locked ? (
          <span className="block text-xs text-slate-400">Opens after the video{kind === 'Module test' ? 's in this module' : ''}</span>
        ) : quiz.attemptCount > 0 && quiz.bestScore !== null ? (
          <span className="block text-xs text-slate-500">
            Best {quiz.bestScore}/{quiz.totalMarks} · pass mark {quiz.passMark}
          </span>
        ) : (
          <span className="block text-xs text-slate-500">Pass mark {quiz.passMark}/{quiz.totalMarks} to continue</span>
        )}
      </span>
      <span
        className={cn(
          'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
          quiz.passed ? 'bg-emerald-50 text-emerald-700' : quiz.locked ? 'bg-slate-100 text-slate-500' : 'bg-brand-strong text-white',
        )}
      >
        {quiz.passed ? 'Passed' : quiz.locked ? 'Locked' : quiz.attemptCount > 0 ? 'Try again' : 'Take quiz'}
      </span>
    </>
  );
  const rowClass = 'ml-2 flex items-center gap-3 rounded-xl border border-dashed px-2.5 py-2.5 text-sm';
  if (quiz.locked) {
    return (
      <div className={cn(rowClass, 'my-1 cursor-not-allowed border-slate-200')} aria-disabled="true">
        {body}
      </div>
    );
  }
  return (
    <Link
      href={`/student/quizzes/${quiz.quizId}`}
      className={cn(rowClass, 'my-1 border-brand/30 bg-brand-soft/30 hover:bg-brand-soft/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand')}
    >
      {body}
    </Link>
  );
}

/** Faded placeholder rows shown where the outline will appear once lessons are published. */
export function OutlinePlaceholder() {
  return (
    <div aria-hidden="true" className="divide-y divide-dashed">
      {[46, 62, 38].map((w) => (
        <div key={w} className="flex items-center gap-3 py-3.5">
          <span className="h-6 w-6 shrink-0 rounded-full border-2 border-dashed border-slate-300" />
          <span className="h-2.5 rounded-full bg-slate-100" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}
