import { computeCourseAccess, type AccessModule, type AccessQuiz } from './course-access';

const lesson = (id: string, completed = false) => ({ id, title: `Lesson ${id}`, completed });
const quiz = (id: string, at: Partial<AccessQuiz>, passed = false): AccessQuiz => ({
  id,
  title: `Quiz ${id}`,
  attachmentType: 'LESSON',
  passed,
  ...at,
});

describe('computeCourseAccess (quiz gate)', () => {
  const modules = (done: string[]): AccessModule[] => [
    { id: 'm1', title: 'Module 1', lessons: [lesson('a', done.includes('a')), lesson('b', done.includes('b'))] },
    { id: 'm2', title: 'Module 2', lessons: [lesson('c', done.includes('c'))] },
  ];

  it('opens only the first lesson for a new student', () => {
    const { lessons } = computeCourseAccess(modules([]), []);
    expect(lessons.get('a')).toEqual({ open: true });
    expect(lessons.get('b')).toEqual({ open: false, blockedBy: { kind: 'LESSON', id: 'a', title: 'Lesson a' } });
    expect(lessons.get('c')?.open).toBe(false);
  });

  it('without quizzes, completing a video opens the next lesson and the next module', () => {
    const { lessons } = computeCourseAccess(modules(['a', 'b']), []);
    expect(lessons.get('b')?.open).toBe(true);
    expect(lessons.get('c')?.open).toBe(true);
  });

  it('keeps completed lessons open for rewatching', () => {
    const { lessons } = computeCourseAccess(modules(['a']), [quiz('qa', { lessonId: 'a' })]);
    expect(lessons.get('a')?.open).toBe(true);
  });

  it('opens a lesson quiz after its video and locks the next lesson until it is passed', () => {
    const notWatched = computeCourseAccess(modules([]), [quiz('qa', { lessonId: 'a' })]);
    expect(notWatched.quizzes.get('qa')).toEqual({ open: false, blockedBy: { kind: 'LESSON', id: 'a', title: 'Lesson a' } });

    const watched = computeCourseAccess(modules(['a']), [quiz('qa', { lessonId: 'a' })]);
    expect(watched.quizzes.get('qa')).toEqual({ open: true });
    expect(watched.lessons.get('b')).toEqual({ open: false, blockedBy: { kind: 'QUIZ', id: 'qa', title: 'Quiz qa' } });

    const passed = computeCourseAccess(modules(['a']), [quiz('qa', { lessonId: 'a' }, true)]);
    expect(passed.lessons.get('b')?.open).toBe(true);
  });

  it('opens a module quiz after every lesson in the module and locks the next module until passed', () => {
    const mq = (passed: boolean) => [quiz('qm', { attachmentType: 'MODULE', moduleId: 'm1' }, passed)];
    expect(computeCourseAccess(modules(['a']), mq(false)).quizzes.get('qm')?.open).toBe(false);

    const ready = computeCourseAccess(modules(['a', 'b']), mq(false));
    expect(ready.quizzes.get('qm')?.open).toBe(true);
    expect(ready.lessons.get('c')).toEqual({ open: false, blockedBy: { kind: 'QUIZ', id: 'qm', title: 'Quiz qm' } });

    expect(computeCourseAccess(modules(['a', 'b']), mq(true)).lessons.get('c')?.open).toBe(true);
  });

  it('requires lesson quizzes before the module quiz opens', () => {
    const quizzes = [quiz('qb', { lessonId: 'b' }), quiz('qm', { attachmentType: 'MODULE', moduleId: 'm1' })];
    const { quizzes: q } = computeCourseAccess(modules(['a', 'b']), quizzes);
    expect(q.get('qb')?.open).toBe(true);
    expect(q.get('qm')).toEqual({ open: false, blockedBy: { kind: 'QUIZ', id: 'qb', title: 'Quiz qb' } });
  });

  it('keeps course quizzes always open and quizzes on unpublished lessons closed', () => {
    const { quizzes } = computeCourseAccess(modules([]), [
      quiz('final', { attachmentType: 'COURSE' }),
      quiz('ghost', { lessonId: 'not-published' }),
    ]);
    expect(quizzes.get('final')).toEqual({ open: true });
    expect(quizzes.get('ghost')).toEqual({ open: false });
  });
});
