'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  getAccessToken,
  getStoredUser,
  homePathForRole,
  loginRedirectUrl,
  refreshAccessToken,
  type SessionUser,
  type UserRole,
} from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { staffCanOpen } from '@/lib/staff-access';

interface SessionGuardOptions {
  /** Roles allowed in this area; anyone else is redirected (signed out -> /login). */
  roles: UserRole[];
  /** Admin area: staff may enter, but only the screens their permissions allow. */
  staffByPermission?: boolean;
}

/**
 * Route guard for a signed-in area (R2, R3). Returns the user once they may see the screen,
 * otherwise null while it redirects. The API still enforces roles on every request; this only
 * keeps people out of screens they can't use.
 */
export function useSessionGuard({ roles, staffByPermission }: SessionGuardOptions): SessionUser | null {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const rolesKey = roles.join(',');

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
        // Keep the query (e.g. a class check-in code from a QR link) through sign-in
        router.replace(loginRedirectUrl(pathname + window.location.search));
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

  // Staff in the admin area: only screens their permissions open (re-checked on every navigation)
  const staffBlocked = !!user && user.role === 'STAFF' && !!staffByPermission && !staffCanOpen(pathname, user.permissions);
  useEffect(() => {
    if (staffBlocked) router.replace(homePathForRole('STAFF'));
  }, [staffBlocked, router]);

  return staffBlocked ? null : user;
}
