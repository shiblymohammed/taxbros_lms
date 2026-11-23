'use client';

import { Fragment, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Home, Search } from 'lucide-react';
import type { SessionUser } from '@/lib/auth';
import { pageTrail } from '@/lib/breadcrumbs';
import type { NavItem } from '@/types/navigation';
import { QuickSearch } from './quick-search';
import { UserMenu } from './user-menu';

interface TopbarProps {
  nav: NavItem[];
  pathname: string;
  user: SessionUser;
  signingOut: boolean;
  onSignOut: () => void;
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Top bar of a signed-in area (design.md: Layout Components → Navbar).
 * Breadcrumbs show where you are (as in Canvas and Moodle), with quick page search and the account menu.
 */
export function Topbar({ nav, pathname, user, signingOut, onSignOut }: TopbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { section, crumbs } = pageTrail(nav, pathname);
  const current = crumbs.at(-1);
  const back = crumbs.length > 1 ? crumbs.at(-2) : undefined;
  const home = nav[0];
  const shortcut = isMac() ? '⌘K' : 'Ctrl K';

  // Ctrl K / ⌘ K opens page search from anywhere in the area
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-white/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/75 sm:gap-3 sm:px-6 lg:px-8">
      {/* Phones: back to the parent page, then the page name */}
      <div className="flex min-w-0 flex-1 items-center gap-1 md:hidden">
        {back?.href ? (
          <Link
            href={back.href}
            aria-label={`Back to ${back.label}`}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        ) : (
          <Link href={home?.href ?? '/'} className="mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-strong">
            <Image src="/logo-mark.webp" alt="TAXBROS home" width={24} height={22} unoptimized className="h-5 w-auto" />
          </Link>
        )}
        <p className="truncate text-base font-semibold text-slate-900">{current?.label ?? home?.label}</p>
      </div>

      {/* Tablet and desktop: full breadcrumb trail */}
      <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 md:block">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          {home && (
            <li className="shrink-0">
              <Link
                href={home.href}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">{home.label}</span>
              </Link>
            </li>
          )}
          {section && (
            <>
              <li aria-hidden="true" className="text-slate-300">
                <ChevronRight className="h-4 w-4" />
              </li>
              <li className="shrink-0 text-slate-500">{section}</li>
            </>
          )}
          {crumbs.map((crumb, i) => (
            <Fragment key={`${crumb.label}-${i}`}>
              <li aria-hidden="true" className="text-slate-300">
                <ChevronRight className="h-4 w-4" />
              </li>
              <li className="min-w-0">
                {crumb.href ? (
                  <Link href={crumb.href} className="truncate text-slate-500 hover:text-slate-900 hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="block truncate font-semibold text-slate-900">
                    {crumb.label}
                  </span>
                )}
              </li>
            </Fragment>
          ))}
        </ol>
      </nav>

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        aria-label="Search pages"
        aria-keyshortcuts="Control+K Meta+K"
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg text-sm text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand max-sm:w-10 max-sm:justify-center sm:w-56 sm:border sm:bg-slate-50 sm:px-3 sm:hover:bg-white lg:w-64"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="hidden flex-1 text-left sm:inline">Search pages…</span>
        <kbd className="hidden rounded border bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-500 sm:inline">{shortcut}</kbd>
      </button>

      <div className="hidden h-8 w-px bg-slate-200 sm:block" aria-hidden="true" />
      <UserMenu user={user} signingOut={signingOut} onSignOut={onSignOut} />

      <QuickSearch nav={nav} open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
