import type { NavItem } from '@/types/navigation';

export interface Crumb {
  label: string;
  /** Missing on the current page */
  href?: string;
}

export interface PageTrail {
  /** Menu section the page belongs to (e.g. "Learning") */
  section?: string;
  /** Path from the menu entry down to the current page; the last one is the current page */
  crumbs: Crumb[];
}

interface DetailPage {
  pattern: RegExp;
  /** Menu entry the page sits under (first one present in the menu) */
  parent: string | string[];
  trail: (match: RegExpMatchArray) => Crumb[];
}

/** Screens that are not menu entries themselves, and where they sit in the menu. */
const DETAIL_PAGES: DetailPage[] = [
  { pattern: /^\/admin\/students\/[^/]+$/, parent: '/admin/users', trail: () => [{ label: 'Student profile' }] },
  { pattern: /^\/admin\/courses\/[^/]+$/, parent: '/admin/courses', trail: () => [{ label: 'Course editor' }] },
  { pattern: /^\/admin\/quizzes\/[^/]+$/, parent: '/admin/quizzes', trail: () => [{ label: 'Quiz editor' }] },
  { pattern: /^\/student\/courses\/[^/]+$/, parent: ['/student/courses', '/student/dashboard'], trail: () => [{ label: 'Course' }] },
  {
    pattern: /^\/student\/courses\/([^/]+)\/lessons\/[^/]+$/,
    parent: ['/student/courses', '/student/dashboard'],
    trail: (m) => [{ label: 'Course', href: `/student/courses/${m[1]}` }, { label: 'Lesson' }],
  },
  { pattern: /^\/student\/quizzes\/[^/]+$/, parent: ['/student/quizzes', '/student/dashboard'], trail: () => [{ label: 'Quiz' }] },
  { pattern: /^\/student\/performance$/, parent: '/student/profile', trail: () => [{ label: 'My Performance' }] },
  {
    pattern: /^\/student\/quizzes\/([^/]+)\/results\/[^/]+$/,
    parent: ['/student/quizzes', '/student/dashboard'],
    trail: (m) => [{ label: 'Quiz', href: `/student/quizzes/${m[1]}` }, { label: 'Results' }],
  },
  { pattern: /^\/student\/labs\/gst$/, parent: '/student/labs', trail: () => [{ label: 'GST registration' }] },
  { pattern: /^\/student\/labs\/itr$/, parent: '/student/labs', trail: () => [{ label: 'Income tax return' }] },
  { pattern: /^\/student\/labs\/mca$/, parent: '/student/labs', trail: () => [{ label: 'Company incorporation' }] },
];

/** Longest matching menu entry for a path, so /admin/courses/123 highlights "Courses". */
export function activeNavItem(nav: NavItem[], pathname: string): NavItem | undefined {
  return nav
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/** Where the current page sits: menu section, then menu entry, then any detail pages. */
export function pageTrail(nav: NavItem[], pathname: string): PageTrail {
  let parent = activeNavItem(nav, pathname);
  let trail: Crumb[] = [];

  for (const page of DETAIL_PAGES) {
    const match = pathname.match(page.pattern);
    if (match) {
      const candidates = Array.isArray(page.parent) ? page.parent : [page.parent];
      parent = candidates.map((href) => nav.find((item) => item.href === href)).find(Boolean) ?? parent;
      trail = page.trail(match);
      break;
    }
  }

  const crumbs: Crumb[] = parent ? [{ label: parent.label, href: parent.href }, ...trail] : trail;
  if (crumbs.length > 0) crumbs[crumbs.length - 1] = { label: crumbs[crumbs.length - 1].label };
  return { section: parent?.group, crumbs };
}
