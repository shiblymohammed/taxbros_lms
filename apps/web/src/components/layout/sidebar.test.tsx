import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ADMIN_NAV } from '@/config/navigation';
import { staffNav } from '@/lib/staff-access';
import { Sidebar, activeNavItem, groupNav } from './sidebar';

vi.mock('next/image', () => ({ default: () => null }));

describe('Sidebar (R34)', () => {
  it('groups the admin menu under section headings in order', () => {
    expect(groupNav(ADMIN_NAV).map((g) => g.group)).toEqual(['Overview', 'People', 'Learning', 'Attendance', 'System']);
  });

  it('keeps a group together even when its items are not next to each other', () => {
    const groups = groupNav(staffNav(['VIEW_REPORTS', 'MANAGE_CLASSES']));
    expect(groups.map((g) => [g.group, g.items.map((i) => i.label)])).toEqual([
      ['Attendance', ['Class Register', 'Reports']],
      ['People', ['Classes']],
    ]);
  });

  it('highlights the closest menu entry for nested pages', () => {
    expect(activeNavItem(ADMIN_NAV, '/admin/courses/abc')?.label).toBe('Courses');
    expect(activeNavItem(ADMIN_NAV, '/admin/reports/attendance')?.label).toBe('Reports');
    expect(activeNavItem(ADMIN_NAV, '/elsewhere')).toBeUndefined();
  });

  it('marks the current page and keeps labels readable when collapsed', () => {
    render(<Sidebar nav={ADMIN_NAV} pathname="/admin/quizzes/q1" roleLabel="Administrator" collapsed onToggleCollapsed={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Quizzes' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Users' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });
});
