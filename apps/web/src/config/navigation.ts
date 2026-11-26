import type { NavItem } from '@/types/navigation';

export type { NavItem };

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard', group: 'Overview', tab: true, tabLabel: 'Home' },
  { href: '/admin/users', label: 'Users', icon: 'users', group: 'People', tab: true },
  { href: '/admin/classes', label: 'Classes', icon: 'classes', group: 'People' },
  { href: '/admin/courses', label: 'Courses', icon: 'courses', group: 'Learning', tab: true },
  { href: '/admin/quizzes', label: 'Quizzes', icon: 'quizzes', group: 'Learning' },
  { href: '/admin/labs', label: 'Labs', icon: 'labs', group: 'Learning' },
  { href: '/staff/attendance', label: 'Class Register', icon: 'register', group: 'Attendance', tab: true, tabLabel: 'Register' },
  { href: '/admin/staff-attendance', label: 'Staff Attendance', icon: 'staff-attendance', group: 'Attendance' },
  { href: '/admin/reports/attendance', label: 'Reports', icon: 'reports', group: 'Attendance' },
  { href: '/admin/settings', label: 'Settings', icon: 'settings', group: 'System' },
];

export const STAFF_NAV: NavItem[] = [
  { href: '/staff/check-in', label: 'My Attendance', icon: 'check-in', group: 'Attendance' },
  { href: '/staff/attendance', label: 'Class Register', icon: 'register', group: 'Attendance' },
];

// Phone tab bar: Home · Courses · Check in · Tests · More (Labs, Profile; Profile is also the avatar on Home)
export const STUDENT_NAV: NavItem[] = [
  { href: '/student/dashboard', label: 'Dashboard', icon: 'dashboard', group: 'Learning', tab: true, tabLabel: 'Home' },
  { href: '/student/courses', label: 'My Courses', icon: 'courses', group: 'Learning', tab: true, tabLabel: 'Courses' },
  { href: '/student/check-in', label: 'Class Check-in', icon: 'check-in', group: 'Learning', tab: true, tabLabel: 'Check in' },
  { href: '/student/labs', label: 'Practice Labs', icon: 'labs', group: 'Learning', tabLabel: 'Labs' },
  { href: '/student/quizzes', label: 'Tests & Exams', icon: 'quizzes', group: 'Learning', tab: true, tabLabel: 'Tests' },
  { href: '/student/profile', label: 'Profile', icon: 'profile', group: 'Account' },
];
