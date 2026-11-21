'use client';

import { useEffect, useState } from 'react';
import { settingsApi } from './admin-api';

/**
 * Show times in the institute timezone (R6.7). The API stores UTC; the timezone comes from
 * GET /settings and is fetched once per page load.
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

let cached: Promise<string> | null = null;

export function loadInstituteTimezone(): Promise<string> {
  cached ??= settingsApi
    .list()
    .then((all) => all.find((s) => s.key === 'timezone')?.value || DEFAULT_TIMEZONE)
    .catch(() => {
      cached = null; // try again next time
      return DEFAULT_TIMEZONE;
    });
  return cached;
}

/** Forget the cached timezone (after an administrator changes it). */
export function resetInstituteTimezone(value?: string) {
  cached = value ? Promise.resolve(value) : null;
}

export function useInstituteTimezone(): string {
  const [tz, setTz] = useState(DEFAULT_TIMEZONE);
  useEffect(() => {
    let alive = true;
    loadInstituteTimezone().then((v) => alive && setTz(v));
    return () => {
      alive = false;
    };
  }, []);
  return tz;
}

/** e.g. "21 Nov 2026, 2:30 pm" in the given timezone. */
export function formatDateTime(value: string | Date | null | undefined, timeZone: string): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

/** Calendar dates (admission date, attendance date) are stored as UTC midnight: show them as-is. */
export function formatCalendarDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', dateStyle: 'medium' }).format(d);
}

/** Today's calendar date (YYYY-MM-DD) in the institute timezone (R6.6), not the device's. */
export function todayInTimezone(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  }
}

/** Today in the institute timezone; updates once the configured timezone has loaded. */
export function useInstituteToday(): string {
  return todayInTimezone(useInstituteTimezone());
}
