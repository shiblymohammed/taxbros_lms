import { describe, expect, it } from 'vitest';
import { formatCalendarDate, formatDateTime, todayInTimezone } from './institute-time';
import { cleanFilters, timezoneOptions } from './admin-api';

describe('institute time (R6.6, R6.7)', () => {
  it('works out today in the institute timezone, not the device or UTC', () => {
    const now = new Date('2026-11-21T20:00:00Z'); // 01:30 on 22 Nov in India
    expect(todayInTimezone('Asia/Kolkata', now)).toBe('2026-11-22');
    expect(todayInTimezone('UTC', now)).toBe('2026-11-21');
    expect(todayInTimezone('Not/AZone', now)).toBe('2026-11-22'); // falls back to Asia/Kolkata
  });

  it('shows UTC timestamps in the institute timezone', () => {
    expect(formatDateTime('2026-11-21T09:00:00Z', 'Asia/Kolkata')).toMatch(/21 Nov 2026.*2:30/i);
    expect(formatDateTime(null, 'Asia/Kolkata')).toBe('—');
  });

  it('shows calendar dates without shifting them a day', () => {
    expect(formatCalendarDate('2026-06-01T00:00:00.000Z')).toMatch(/1 Jun 2026/);
  });
});

describe('admin helpers', () => {
  it('drops empty filters before calling the API (R1.11, R1.12)', () => {
    expect(cleanFilters({ search: '', classId: 'c1', department: '  ', admissionId: undefined, page: 1 })).toEqual({
      classId: 'c1',
      page: 1,
    });
  });

  it('lists timezones with Asia/Kolkata first and keeps the current value', () => {
    const zones = timezoneOptions('Asia/Dubai');
    expect(zones[0]).toBe('Asia/Kolkata');
    expect(zones).toContain('Asia/Dubai');
    expect(new Set(zones).size).toBe(zones.length);
  });
});
