import type { NavItem } from '@/types/navigation';
import type { SessionUser } from './auth';

/**
 * Which admin screens a staff member may open, by permission (R3).
 * The API checks the same permissions on every request; this only decides what staff see.
 */

export type StaffPermission =
  | 'MARK_ATTENDANCE'
  | 'VIEW_REPORTS'
  | 'MANAGE_COURSES'
  | 'MANAGE_STUDENTS'
  | 'MANAGE_STAFF'
  | 'MANAGE_CLASSES'
  | 'MANAGE_LABS';

interface StaffArea {
  /** Route prefix under /admin */
  prefix: string;
  /** Menu entry, if the area has one */
  nav?: NavItem;
  /** Any one of these permissions opens the area */
  anyOf: StaffPermission[];
}

export const STAFF_AREAS: StaffArea[] = [
  { prefix: '/admin/users', nav: { href: '/admin/users', label: 'Users', icon: 'users', group: 'People' }, anyOf: ['MANAGE_STUDENTS', 'MANAGE_STAFF'] },
  { prefix: '/admin/students', anyOf: ['MANAGE_STUDENTS'] },
  { prefix: '/admin/classes', nav: { href: '/admin/classes', label: 'Classes', icon: 'classes', group: 'People' }, anyOf: ['MANAGE_CLASSES'] },
  { prefix: '/admin/courses', nav: { href: '/admin/courses', label: 'Courses', icon: 'courses', group: 'Learning' }, anyOf: ['MANAGE_COURSES'] },
  { prefix: '/admin/quizzes', nav: { href: '/admin/quizzes', label: 'Quizzes', icon: 'quizzes', group: 'Learning' }, anyOf: ['MANAGE_COURSES'] },
  { prefix: '/admin/labs', nav: { href: '/admin/labs', label: 'Labs', icon: 'labs', group: 'Learning' }, anyOf: ['MANAGE_LABS'] },
  { prefix: '/admin/reports', nav: { href: '/admin/reports/attendance', label: 'Reports', icon: 'reports', group: 'Attendance' }, anyOf: ['VIEW_REPORTS'] },
];

const matches = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export function hasAnyPermission(user: Pick<SessionUser, 'permissions'> | null | undefined, anyOf: StaffPermission[]): boolean {
  const held = user?.permissions ?? [];
  return anyOf.some((p) => held.includes(p));
}

/** Whether a staff member may open this /admin path (dashboard, settings and staff attendance stay admin-only). */
export function staffCanOpen(path: string, permissions: string[] | undefined): boolean {
  const area = STAFF_AREAS.find((a) => matches(path, a.prefix));
  return !!area && area.anyOf.some((p) => (permissions ?? []).includes(p));
}

/** Staff menu: the class register, then every admin area their permissions open. */
export function staffNav(permissions: string[] | undefined): NavItem[] {
  const held = permissions ?? [];
  return [
    { href: '/staff/attendance', label: 'Class Register', icon: 'register', group: 'Attendance' },
    ...STAFF_AREAS.filter((a) => a.nav && a.anyOf.some((p) => held.includes(p))).map((a) => a.nav!),
  ];
}
