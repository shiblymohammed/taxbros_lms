import { describe, expect, it } from 'vitest';
import { ADMIN_NAV, STUDENT_NAV } from '@/config/navigation';
import { pageTrail } from './breadcrumbs';

describe('pageTrail (top bar breadcrumbs)', () => {
  it('shows the section and the menu entry for a menu page', () => {
    expect(pageTrail(ADMIN_NAV, '/admin/users')).toEqual({ section: 'People', crumbs: [{ label: 'Users' }] });
  });

  it('links back to the list from a detail page', () => {
    expect(pageTrail(ADMIN_NAV, '/admin/courses/c1')).toEqual({
      section: 'Learning',
      crumbs: [{ label: 'Courses', href: '/admin/courses' }, { label: 'Course editor' }],
    });
  });

  it('places a student profile under Users', () => {
    expect(pageTrail(ADMIN_NAV, '/admin/students/s1').crumbs).toEqual([
      { label: 'Users', href: '/admin/users' },
      { label: 'Student profile' },
    ]);
  });

  it('builds the full path to a lesson for students', () => {
    expect(pageTrail(STUDENT_NAV, '/student/courses/c1/lessons/l1').crumbs).toEqual([
      { label: 'My Courses', href: '/student/courses' },
      { label: 'Course', href: '/student/courses/c1' },
      { label: 'Lesson' },
    ]);
  });

  it('names each practice lab', () => {
    expect(pageTrail(STUDENT_NAV, '/student/labs/itr').crumbs.at(-1)).toEqual({ label: 'Income tax return' });
  });

  it('returns no crumbs for a page outside the menu', () => {
    expect(pageTrail(ADMIN_NAV, '/elsewhere')).toEqual({ section: undefined, crumbs: [] });
  });
});
