import { describe, expect, it } from 'vitest';
import { ADMIN_NAV, STUDENT_NAV } from '@/config/navigation';
import { staffNav } from '@/lib/staff-access';
import { bottomTabs } from './bottom-nav';

describe('bottomTabs (phone tab bar)', () => {
  it('shows the whole student menu', () => {
    expect(bottomTabs(STUDENT_NAV)).toEqual({ tabs: STUDENT_NAV, more: false });
  });

  it('shows the four flagged admin screens and a More button', () => {
    const { tabs, more } = bottomTabs(ADMIN_NAV);
    expect(tabs.map((t) => t.tabLabel ?? t.label)).toEqual(['Home', 'Users', 'Courses', 'Register']);
    expect(more).toBe(true);
  });

  it('falls back to the first entries for long staff menus', () => {
    const nav = staffNav(['MANAGE_STUDENTS', 'MANAGE_CLASSES', 'MANAGE_COURSES', 'MANAGE_LABS', 'VIEW_REPORTS']);
    const { tabs, more } = bottomTabs(nav);
    expect(more).toBe(true);
    expect(tabs).toHaveLength(4);
  });
});
