import { describe, expect, it } from 'vitest';
import { clearQuizTimer, formatRemaining, startQuizTimer } from './quiz-timer';

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

describe('quiz timer (R25)', () => {
  it('sets a deadline from the time limit and keeps it across reloads', () => {
    const store = memory();
    const first = startQuizTimer('q1', 10, 1_000_000, store);
    expect(first.deadline).toBe(1_000_000 + 600_000);
    const reloaded = startQuizTimer('q1', 10, 1_500_000, store);
    expect(reloaded).toEqual(first);
  });

  it('has no deadline for untimed quizzes but still records the start', () => {
    const t = startQuizTimer('q2', null, 0, memory());
    expect(t.deadline).toBeNull();
    expect(t.startedAt).toBe('1970-01-01T00:00:00.000Z');
  });

  it('starts again after the quiz is submitted', () => {
    const store = memory();
    startQuizTimer('q1', 10, 0, store);
    clearQuizTimer('q1', store);
    expect(startQuizTimer('q1', 10, 5_000, store).deadline).toBe(605_000);
  });

  it('formats the time left', () => {
    expect(formatRemaining(545_000)).toBe('9:05');
    expect(formatRemaining(3_723_000)).toBe('1:02:03');
    expect(formatRemaining(-5)).toBe('0:00');
  });
});
