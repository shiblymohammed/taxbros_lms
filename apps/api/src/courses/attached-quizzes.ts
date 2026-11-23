import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Quizzes point at a course, module or lesson by id without a database relation, so deleting
 * content would leave them behind. These helpers find and remove them with the content.
 */

type Db = Prisma.TransactionClient;

export interface ContentIds {
  courseIds?: string[];
  moduleIds?: string[];
  lessonIds?: string[];
}

function whereAttached({ courseIds = [], moduleIds = [], lessonIds = [] }: ContentIds): Prisma.QuizWhereInput {
  return {
    OR: [
      ...(courseIds.length ? [{ courseId: { in: courseIds } }] : []),
      ...(moduleIds.length ? [{ moduleId: { in: moduleIds } }] : []),
      ...(lessonIds.length ? [{ lessonId: { in: lessonIds } }] : []),
    ],
  };
}

/** Throws 409 if any quiz on this content already has student attempts (their results would be lost). */
export async function assertNoQuizAttempts(db: Db, ids: ContentIds, what: string): Promise<void> {
  const where = whereAttached(ids);
  if (!where.OR?.length) return;
  const taken = await db.quiz.findMany({
    where: { ...where, attempts: { some: {} } },
    select: { title: true },
  });
  if (taken.length > 0) {
    const titles = taken.map((q) => `"${q.title}"`).join(', ');
    throw new ConflictException(
      `This ${what} can't be deleted because students have already taken its quiz ${titles}. ` +
        'Unpublish it instead, or delete the quiz first if its results are no longer needed.',
    );
  }
}

/** Deletes the quizzes (and their questions) attached to the content; returns how many. */
export async function deleteAttachedQuizzes(db: Db, ids: ContentIds): Promise<number> {
  const where = whereAttached(ids);
  if (!where.OR?.length) return 0;
  const { count } = await db.quiz.deleteMany({ where });
  return count;
}
