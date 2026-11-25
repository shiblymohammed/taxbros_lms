/**
 * Learning order inside a course (quiz gate).
 *
 * Lessons open one after another, module by module:
 * - A lesson opens once the lesson before it is completed (its video watched).
 * - A lesson quiz opens once its lesson is completed; the next lesson stays locked until it is passed.
 * - A module quiz opens once every lesson in the module is completed (and their quizzes passed);
 *   the next module stays locked until it is passed.
 * - Lessons without a quiz unlock the next lesson as soon as the video is completed.
 * Course-level quizzes are not part of the order and are always open.
 *
 * Pure function so the rules can be tested without a database.
 */

export interface AccessLesson {
  id: string;
  title: string;
  completed: boolean;
}

export interface AccessModule {
  id: string;
  title: string;
  lessons: AccessLesson[];
}

export interface AccessQuiz {
  id: string;
  title: string;
  attachmentType: 'COURSE' | 'MODULE' | 'LESSON';
  lessonId?: string | null;
  moduleId?: string | null;
  passed: boolean;
}

/** The first thing the student still has to finish before an item opens. */
export interface Blocker {
  kind: 'LESSON' | 'QUIZ';
  id: string;
  title: string;
}

export interface ItemAccess {
  /** Lessons: whether it can be opened. Quizzes: whether it can be taken. */
  open: boolean;
  blockedBy?: Blocker;
}

export interface CourseAccess {
  lessons: Map<string, ItemAccess>;
  quizzes: Map<string, ItemAccess>;
}

export function computeCourseAccess(modules: AccessModule[], quizzes: AccessQuiz[]): CourseAccess {
  const lessons = new Map<string, ItemAccess>();
  const quizAccess = new Map<string, ItemAccess>();
  let blocker: Blocker | undefined;

  const gate = (attached: AccessQuiz[]) => {
    const open = !blocker;
    for (const q of attached) quizAccess.set(q.id, open ? { open: true } : { open: false, blockedBy: blocker });
    if (open) {
      const unpassed = attached.find((q) => !q.passed);
      if (unpassed) blocker = { kind: 'QUIZ', id: unpassed.id, title: unpassed.title };
    }
  };

  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      lessons.set(lesson.id, blocker ? { open: false, blockedBy: blocker } : { open: true });
      if (!blocker && !lesson.completed) blocker = { kind: 'LESSON', id: lesson.id, title: lesson.title };
      gate(quizzes.filter((q) => q.attachmentType === 'LESSON' && q.lessonId === lesson.id));
    }
    gate(quizzes.filter((q) => q.attachmentType === 'MODULE' && q.moduleId === mod.id));
  }

  for (const q of quizzes) {
    if (quizAccess.has(q.id)) continue;
    // Course quizzes are always open; a quiz on an unpublished lesson or module is not reachable yet
    quizAccess.set(q.id, { open: q.attachmentType === 'COURSE' });
  }

  return { lessons, quizzes: quizAccess };
}
