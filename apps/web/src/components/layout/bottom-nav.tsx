'use client';

import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { activeNavItem } from '@/lib/breadcrumbs';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/types/navigation';
import { NavIconGlyph } from './sidebar';

const MAX_TABS = 5;

/** Entries for the phone tab bar: all of a short menu, else the flagged (or first) four plus "More". */
export function bottomTabs(nav: NavItem[]): { tabs: NavItem[]; more: boolean } {
  if (nav.length <= MAX_TABS) return { tabs: nav, more: false };
  const flagged = nav.filter((item) => item.tab);
  return { tabs: (flagged.length > 0 ? flagged : nav).slice(0, MAX_TABS - 1), more: true };
}

interface BottomNavProps {
  nav: NavItem[];
  pathname: string;
  onMore: () => void;
}

/** Phone and tablet tab bar (TAXBROS mobile design: Home · Courses · … · Profile). */
export function BottomNav({ nav, pathname, onMore }: BottomNavProps) {
  const { tabs, more } = bottomTabs(nav);
  const active = activeNavItem(nav, pathname);
  const moreActive = more && !!active && !tabs.includes(active);

  const itemClass = (isActive: boolean) =>
    cn(
      'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand',
      isActive ? 'text-brand-strong' : 'text-slate-500 hover:text-slate-800',
    );
  const iconWrap = (isActive: boolean) =>
    cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', isActive && 'bg-brand-soft');

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-xl">
        {tabs.map((item) => {
          const isActive = item === active;
          return (
            <li key={item.href} className="flex flex-1">
              <Link href={item.href} aria-current={isActive ? 'page' : undefined} className={itemClass(isActive)}>
                <span className={iconWrap(isActive)}>
                  <NavIconGlyph icon={item.icon} className="h-5 w-5" />
                </span>
                <span className="max-w-full truncate px-1">{item.tabLabel ?? item.label}</span>
              </Link>
            </li>
          );
        })}
        {more && (
          <li className="flex flex-1">
            <button type="button" onClick={onMore} aria-controls="mobile-sidebar" className={itemClass(moreActive)}>
              <span className={iconWrap(moreActive)}>
                <LayoutGrid className="h-5 w-5" aria-hidden="true" />
              </span>
              More
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
