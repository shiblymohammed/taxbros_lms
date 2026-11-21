/**
 * Date helpers for date-only columns (@db.Date) and the institute timezone (R6.1, R6.6, R6.7).
 *
 * Timestamps are stored in UTC. Attendance dates are calendar dates, so month ranges are built
 * as UTC midnights: building them in server-local time shifts them by a day on servers that are
 * not on UTC (e.g. an IST machine turns 1 Nov into 31 Oct).
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/** First and last calendar day of a month (month is 1–12) as UTC midnights. */
export function monthRange(year: number, month: number): { startDate: Date; endDate: Date } {
  return {
    startDate: new Date(Date.UTC(year, month - 1, 1)),
    endDate: new Date(Date.UTC(year, month, 0)),
  };
}

/** Number of days in a month (month is 1–12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** True when the value is an IANA timezone this runtime knows (e.g. "Asia/Kolkata"). */
export function isValidTimezone(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Today's calendar date (YYYY-MM-DD) in the given timezone. */
export function todayInTimezone(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
