'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { KeyRound, Loader2, LogOut, Menu, X } from 'lucide-react';
import {
  getAccessToken,
  getStoredUser,
  homePathForRole,
  loginRedirectUrl,
  logout,
  refreshAccessToken,
  type SessionUser,
  type UserRole,
} from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { staffCanOpen, staffNav } from '@/lib/staff-access';

export interface NavItem {
  href: string;
  label: string;
}

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

/**
 * Responsive application shell (Task 58, Requirement R34).
 * Horizontal navigation from md up; collapses into a toggle menu on phones.
 */
export function AppShell({ roleLabel: areaLabel, nav: areaNav, adminNav, roles, staffByPermission, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const rolesKey = roles.join(',');

  // Route guard: only render the area for a signed-in user with an allowed role.
  // The API still enforces roles on every request; this keeps people out of screens they can't use.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      let current = getAccessToken() ? getStoredUser() : null;
      if (!current) {
        // Access token missing: the refresh cookie may still be valid
        current = (await refreshAccessToken()) ? getStoredUser() : null;
      }
      if (cancelled) return;
      if (!current) {
        router.replace(loginRedirectUrl(pathname));
        return;
      }
      if (current.mustChangePassword) {
        router.replace(`/change-password?next=${encodeURIComponent(pathname)}`);
        return;
      }
      if (!rolesKey.split(',').includes(current.role)) {
        router.replace(homePathForRole(current.role));
        return;
      }
      if (current.role === 'STAFF') {
        // Read permissions fresh each time an area opens, so a revoked one disappears at once (R3.5)
        try {
          const { data } = await apiClient.get<{ permissions?: string[] }>('/auth/me');
          current = { ...current, permissions: data.permissions ?? [] };
          localStorage.setItem('authUser', JSON.stringify(current));
        } catch {
          // Keep the stored permissions; the API still checks every request
        }
        if (cancelled) return;
      }
      setUser(current);
    };
    check();
    return () => {
      cancelled = true;
    };
    // Re-check only when the allowed roles change; pathname changes stay inside the same area
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesKey, router]);

  const onSignOut = async () => {
    setSigningOut(true);
    await logout();
    router.replace('/login');
  };

  // Close the mobile menu after navigating
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Staff in the admin area: only screens their permissions open (re-checked on every navigation)
  const staffBlocked = !!user && user.role === 'STAFF' && !!staffByPermission && !staffCanOpen(pathname, user.permissions);
  useEffect(() => {
    if (staffBlocked) router.replace(homePathForRole('STAFF'));
  }, [staffBlocked, router]);

  if (!user || staffBlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="sr-only">Checking your session…</span>
      </div>
    );
  }

  const isAdmin = user.role === 'ADMINISTRATOR' || user.role === 'SUPER_ADMIN';
  const isStaff = user.role === 'STAFF';
  const nav = isStaff ? staffNav(user.permissions) : isAdmin && adminNav ? adminNav : areaNav;
  const roleLabel = isStaff ? 'Staff' : isAdmin && adminNav ? 'Administrator' : areaLabel;
  // Long menus (admin) collapse until there's room for all items
  const wide = nav.length > 5;

  const signOutButton = (className: string) => (
    <button
      type="button"
      onClick={onSignOut}
      disabled={signingOut}
      className={className}
    >
      {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Sign out
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href={nav[0]?.href ?? '/'} className="flex min-h-11 items-center gap-2 shrink-0">
            <Image src="/logo.webp" alt="" width={32} height={29} priority className="h-8 w-auto" />
            <span className="font-bold text-gray-900">TAXBROS</span>
            <span className="hidden rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 sm:inline">
              {roleLabel}
            </span>
          </Link>

          <nav aria-label="Main" className={`ml-auto hidden ${wide ? 'xl:block' : 'md:block'}`}>
            <ul className={`flex items-center ${wide ? 'gap-0.5' : 'gap-1'}`}>
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={`inline-flex h-9 items-center whitespace-nowrap rounded-md text-sm font-medium transition-colors ${wide ? 'px-2.5' : 'px-3'} ${
                      isActive(item.href)
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className={`hidden items-center gap-2 border-l pl-3 ${wide ? 'xl:flex' : 'md:flex'}`}>
            <span className={`max-w-[12rem] truncate text-sm text-gray-600 ${wide ? 'hidden 2xl:inline' : ''}`} title={user.email}>
              {user.email}
            </span>
            <Link
              href="/change-password"
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <KeyRound className="h-4 w-4" />
              <span className={wide ? 'hidden 2xl:inline' : 'hidden lg:inline'}>Change password</span>
              <span className={wide ? 'sr-only 2xl:hidden' : 'sr-only lg:hidden'}>Change password</span>
            </Link>
            {signOutButton(
              'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50',
            )}
          </div>

          <button
            type="button"
            className={`ml-auto inline-flex h-11 w-11 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 ${wide ? 'xl:hidden' : 'md:hidden'}`}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {open && (
          <nav id="mobile-nav" aria-label="Main" className={`border-t bg-white ${wide ? 'xl:hidden' : 'md:hidden'}`}>
            <ul className="mx-auto max-w-7xl space-y-1 px-4 py-2">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={`flex min-h-11 items-center rounded-md px-3 text-base font-medium ${
                      isActive(item.href) ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="mt-1 border-t pt-2">
                <p className="truncate px-3 pb-1 text-sm text-gray-500">{user.email}</p>
                <Link
                  href="/change-password"
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-base font-medium text-gray-700 hover:bg-gray-100"
                >
                  <KeyRound className="h-4 w-4" /> Change password
                </Link>
                {signOutButton(
                  'flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-base font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50',
                )}
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main id="main-content">{children}</main>
    </div>
  );
}
