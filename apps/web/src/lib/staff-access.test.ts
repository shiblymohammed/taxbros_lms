import { describe, expect, it } from 'vitest';
import { staffCanOpen, staffNav } from './staff-access';
import { canAccessPath } from './auth';

describe('staff access to admin screens (R3)', () => {
  it('opens only the screens the permissions cover', () => {
    const perms = ['MANAGE_CLASSES', 'VIEW_REPORTS'];
    expect(staffCanOpen('/admin/classes', perms)).toBe(true);
    expect(staffCanOpen('/admin/reports/attendance', perms)).toBe(true);
    expect(staffCanOpen('/admin/courses', perms)).toBe(false);
    expect(staffCanOpen('/admin/users', perms)).toBe(false);
  });

  it('opens Users with either account permission, and student profiles only with MANAGE_STUDENTS', () => {
    expect(staffCanOpen('/admin/users', ['MANAGE_STAFF'])).toBe(true);
    expect(staffCanOpen('/admin/students/abc', ['MANAGE_STAFF'])).toBe(false);
    expect(staffCanOpen('/admin/students/abc', ['MANAGE_STUDENTS'])).toBe(true);
  });

  it('opens course and quiz screens with MANAGE_COURSES', () => {
    expect(staffCanOpen('/admin/courses/c1', ['MANAGE_COURSES'])).toBe(true);
    expect(staffCanOpen('/admin/quizzes/q1', ['MANAGE_COURSES'])).toBe(true);
    expect(staffCanOpen('/admin/labs', ['MANAGE_COURSES'])).toBe(false);
  });

  it('never opens admin-only screens to staff', () => {
    const all = ['MARK_ATTENDANCE', 'VIEW_REPORTS', 'MANAGE_COURSES', 'MANAGE_STUDENTS', 'MANAGE_STAFF', 'MANAGE_CLASSES', 'MANAGE_LABS'];
    for (const path of ['/admin/dashboard', '/admin/settings', '/admin/staff-attendance', '/admin']) {
      expect(staffCanOpen(path, all)).toBe(false);
    }
    expect(staffCanOpen('/admin/classes', undefined)).toBe(false);
  });

  it('builds the staff menu from the permissions', () => {
    expect(staffNav([]).map((n) => n.label)).toEqual(['Class Register']);
    expect(staffNav(['MANAGE_COURSES', 'MANAGE_STUDENTS']).map((n) => n.label)).toEqual([
      'Class Register',
      'Users',
      'Courses',
      'Quizzes',
    ]);
  });

  it('lets staff follow sign-in redirects into /admin (the shell then checks permissions)', () => {
    expect(canAccessPath('STAFF', '/admin/classes')).toBe(true);
    expect(canAccessPath('STUDENT', '/admin/classes')).toBe(false);
  });
});
