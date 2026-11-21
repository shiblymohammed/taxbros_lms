/**
 * Quiz time limits (R25). The deadline is kept in sessionStorage so reloading the page doesn't
 * restart the clock; it is cleared once the quiz is submitted.
 */

export interface QuizTimer {
  /** When the student opened the quiz (ISO time) */
  startedAt: string;
  /** Epoch milliseconds when time runs out, or null for an untimed quiz */
  deadline: number | null;
}

const key = (quizId: string) => `quiz-timer:${quizId}`;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): Store | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** Start (or resume) the timer for a quiz. */
export function startQuizTimer(quizId: string, timeLimitMinutes: number | null, now = Date.now(), store = storage()): QuizTimer {
  const saved = store?.getItem(key(quizId));
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as QuizTimer;
      // Reuse only if it matches the quiz's current limit setting
      if (typeof parsed.startedAt === 'string' && (parsed.deadline === null) === !timeLimitMinutes) return parsed;
    } catch {
      // fall through and start again
    }
  }
  const timer: QuizTimer = {
    startedAt: new Date(now).toISOString(),
    deadline: timeLimitMinutes ? now + timeLimitMinutes * 60_000 : null,
  };
  store?.setItem(key(quizId), JSON.stringify(timer));
  return timer;
}

export function clearQuizTimer(quizId: string, store = storage()) {
  store?.removeItem(key(quizId));
}

/** "9:05" or "1:02:03" */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
