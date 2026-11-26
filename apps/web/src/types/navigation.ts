/**
 * Icon keys for menu entries. Layouts are server components, so menus carry a plain key
 * (serialisable) and the sidebar maps it to an icon component.
 */
export type NavIcon =
  | 'dashboard'
  | 'users'
  | 'classes'
  | 'courses'
  | 'quizzes'
  | 'labs'
  | 'register'
  | 'check-in'
  | 'staff-attendance'
  | 'reports'
  | 'settings'
  | 'profile';

export interface NavItem {
  href: string;
  label: string;
  icon?: NavIcon;
  /** Sidebar section heading; consecutive items with the same group sit together. */
  group?: string;
  /** Shown in the phone bottom tab bar (otherwise the first entries are used) */
  tab?: boolean;
  /** Shorter label for the bottom tab bar */
  tabLabel?: string;
}
