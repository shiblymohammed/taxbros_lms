'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  QrCode,
  BarChart3,
  BookOpen,
  CalendarCheck,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  School,
  Settings,
  UserRound,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { activeNavItem } from '@/lib/breadcrumbs';
import { cn } from '@/lib/utils';
import type { NavIcon, NavItem } from '@/types/navigation';

export { activeNavItem };

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  classes: School,
  courses: BookOpen,
  quizzes: ListChecks,
  labs: FlaskConical,
  register: CalendarCheck,
  'check-in': QrCode,
  'staff-attendance': UserCheck,
  reports: BarChart3,
  settings: Settings,
  profile: UserRound,
};

/** Icon for a menu entry (a generic list icon when it has none). */
export function NavIconGlyph({ icon, className }: { icon?: NavIcon; className?: string }) {
  const Icon = icon ? ICONS[icon] : ClipboardList;
  return <Icon className={className} aria-hidden="true" />;
}

/** Groups menu items under their headings, in the order each heading first appears. */
export function groupNav(nav: NavItem[]): Array<{ group?: string; items: NavItem[] }> {
  const groups: Array<{ group?: string; items: NavItem[] }> = [];
  for (const item of nav) {
    const existing = groups.find((g) => g.group === item.group);
    if (existing) existing.items.push(item);
    else groups.push({ group: item.group, items: [item] });
  }
  return groups;
}

interface SidebarProps {
  nav: NavItem[];
  pathname: string;
  roleLabel: string;
  /** Desktop: icons only */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Called after a link is chosen (closes the mobile drawer) */
  onNavigate?: () => void;
}

/** Role-based navigation menu (design.md: Layout Components → Sidebar). */
export function Sidebar({ nav, pathname, roleLabel, collapsed = false, onToggleCollapsed, onNavigate }: SidebarProps) {
  const active = activeNavItem(nav, pathname);

  return (
    <div className="flex h-full flex-col bg-sidebar bg-gradient-to-b from-[#0f4c5c] to-[#0a3440] text-sidebar-foreground">
      <div className={cn('flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border', collapsed ? 'justify-center px-2' : 'px-5')}>
        <Link href={nav[0]?.href ?? '/'} onClick={onNavigate} className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/95">
            <Image src="/logo-mark.webp" alt="" width={28} height={25} priority unoptimized className="h-6 w-auto" />
          </span>
          {!collapsed && (
            <span className="leading-tight">
              <span className="block text-sm font-bold tracking-wide text-white">TAXBROS</span>
              <span className="block text-xs text-sidebar-muted">{roleLabel}</span>
            </span>
          )}
          {collapsed && <span className="sr-only">TAXBROS {roleLabel}</span>}
        </Link>
      </div>

      <nav aria-label="Main" className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
        {groupNav(nav).map(({ group, items }) => (
          <div key={group ?? 'main'} className="mb-5 last:mb-0">
            {group && !collapsed && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">{group}</p>
            )}
            {group && collapsed && <div className="mx-3 mb-2 border-t border-sidebar-border" aria-hidden="true" />}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon ? ICONS[item.icon] : ClipboardList;
                const isActive = item === active;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'group relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                        collapsed && 'justify-center px-0',
                        isActive ? 'bg-white text-brand-strong shadow-sm' : 'hover:bg-white/10 hover:text-white',
                      )}
                    >
                      <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-brand' : 'text-sidebar-muted group-hover:text-white')} aria-hidden="true" />
                      <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {onToggleCollapsed && (
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? <ChevronsRight className="h-[18px] w-[18px]" /> : <ChevronsLeft className="h-[18px] w-[18px]" />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      )}
    </div>
  );
}
