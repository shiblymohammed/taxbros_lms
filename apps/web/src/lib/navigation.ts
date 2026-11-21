import type { NavItem } from '@/components/app-shell';

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/classes', label: 'Classes' },
  { href: '/admin/courses', label: 'Courses' },
  { href: '/admin/quizzes', label: 'Quizzes' },
  { href: '/admin/labs', label: 'Labs' },
  { href: '/staff/attendance', label: 'Class Register' },
  { href: '/admin/staff-attendance', label: 'Staff Attendance' },
  { href: '/admin/reports/attendance', label: 'Reports' },
  { href: '/admin/settings', label: 'Settings' },
];

export const STAFF_NAV: NavItem[] = [{ href: '/staff/attendance', label: 'Class Register' }];

export const STUDENT_NAV: NavItem[] = [
  { href: '/student/dashboard', label: 'Dashboard' },
  { href: '/student/labs', label: 'Practice Labs' },
];
