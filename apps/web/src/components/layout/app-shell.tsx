'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { Loader2, X } from 'lucide-react';
import { logout, type UserRole } from '@/lib/auth';
import { staffNav } from '@/lib/staff-access';
import { cn } from '@/lib/utils';
import { useSessionGuard } from '@/hooks/use-session-guard';
import type { NavItem } from '@/types/navigation';
import { BottomNav } from './bottom-nav';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export type { NavItem };

interface AppShellProps {
  roleLabel: string;
  nav: NavItem[];
  /** Navigation shown instead when an administrator opens this area. */
  adminNav?: NavItem[];
  /** Roles allowed in this area; anyone else is redirected (signed out -> /login). */
  roles: UserRole[];
  /** Admin area: staff may enter, but only the screens their permissions allow. */
  staffByPermission?: boolean;
  children: ReactNode;
}

const COLLAPSED_KEY = 'sidebarCollapsed';

/**
 * Application shell for signed-in areas (R34, design.md: RoleLayout).
 * Fixed sidebar from lg up (collapsible to icons); a slide-in drawer on phones and tablets.
 */
export function AppShell({ roleLabel: areaLabel, nav: areaNav, adminNav, roles, staffByPermission, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useSessionGuard({ roles, staffByPermission });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.localStorage?.getItem(COLLAPSED_KEY) === '1',
  );

  // Close the drawer after navigating
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      localStorage.setItem(COLLAPSED_KEY, v ? '0' : '1');
      return !v;
    });
  };

  const onSignOut = async () => {
    setSigningOut(true);
    await logout();
    router.replace('/login');
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <span className="sr-only">Checking your session…</span>
      </div>
    );
  }

  const isAdmin = user.role === 'ADMINISTRATOR' || user.role === 'SUPER_ADMIN';
  const isStaff = user.role === 'STAFF';
  const nav = isStaff ? staffNav(user.permissions) : isAdmin && adminNav ? adminNav : areaNav;
  const roleLabel = isStaff ? 'Staff' : isAdmin && adminNav ? 'Administrator' : areaLabel;

  return (
    <div className="min-h-screen w-full bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-200 lg:block',
          collapsed ? 'w-[4.5rem]' : 'w-64',
        )}
      >
        <Sidebar
          nav={nav}
          pathname={pathname}
          roleLabel={roleLabel}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>

      {/* Mobile and tablet drawer */}
      <SheetPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetPrimitive.Portal>
          <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[1px] lg:hidden" />
          <SheetPrimitive.Content
            id="mobile-sidebar"
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl focus:outline-none lg:hidden"
          >
            <SheetPrimitive.Title className="sr-only">Menu</SheetPrimitive.Title>
            <SheetPrimitive.Description className="sr-only">Main navigation</SheetPrimitive.Description>
            <Sidebar nav={nav} pathname={pathname} roleLabel={roleLabel} onNavigate={() => setDrawerOpen(false)} />
            <SheetPrimitive.Close
              aria-label="Close menu"
              className="absolute right-3 top-3.5 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <X className="h-5 w-5" />
            </SheetPrimitive.Close>
          </SheetPrimitive.Content>
        </SheetPrimitive.Portal>
      </SheetPrimitive.Root>

      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-200', collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-64')}>
        <Topbar
          nav={nav}
          pathname={pathname}
          user={user}
          signingOut={signingOut}
          onSignOut={onSignOut}
        />
        {/* Room for the phone tab bar */}
        <main id="main-content" className="flex-1 pb-24 lg:pb-0">
          {children}
        </main>
        <footer className="hidden border-t bg-white/60 px-4 py-4 text-xs text-slate-500 sm:px-6 lg:block lg:px-8">
          © {new Date().getFullYear()} TAXBROS Institute · Learning Management System
        </footer>
      </div>

      <BottomNav nav={nav} pathname={pathname} onMore={() => setDrawerOpen(true)} />
    </div>
  );
}
