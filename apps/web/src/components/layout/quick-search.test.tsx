import { describe, expect, it } from 'vitest';
import { ADMIN_NAV } from '@/config/navigation';
import { filterNav } from './quick-search';

describe('filterNav (quick page search)', () => {
  it('lists every page before anything is typed', () => {
    expect(filterNav(ADMIN_NAV, '  ')).toHaveLength(ADMIN_NAV.length);
  });

  it('matches page names and section names, ignoring case', () => {
    expect(filterNav(ADMIN_NAV, 'QUIZ').map((i) => i.label)).toEqual(['Quizzes']);
    expect(filterNav(ADMIN_NAV, 'attendance').map((i) => i.label)).toEqual(['Class Register', 'Staff Attendance', 'Reports']);
    expect(filterNav(ADMIN_NAV, 'staff att').map((i) => i.label)).toEqual(['Staff Attendance']);
  });

  it('returns nothing for an unknown page', () => {
    expect(filterNav(ADMIN_NAV, 'payroll')).toEqual([]);
  });
});
