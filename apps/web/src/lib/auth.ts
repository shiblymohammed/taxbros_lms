/**
 * Client-side session handling.
 *
 * - The access token (15 min) is kept in localStorage and sent as a Bearer header by `apiClient`.
 * - The refresh token (7 days) lives in an httpOnly cookie set by the API; JavaScript never sees it.
 * - On a 401 the API client calls `refreshAccessToken()` once, then retries the request.
 */

export type UserRole = 'SUPER_ADMIN' | 'ADMINISTRATOR' | 'STAFF' | 'STUDENT';

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  mustChangePassword?: boolean;
  /** Staff permissions from GET /auth/me (administrators hold all of them) */
  permissions?: string[];
}

const TOKEN_KEY = 'accessToken';
const USER_KEY = 'authUser';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const isBrowser = () => typeof window !== 'undefined';

export function getAccessToken(): string | null {
  return isBrowser() ? localStorage.getItem(TOKEN_KEY) : null;
}

export function getStoredUser(): SessionUser | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function setSession(accessToken: string, user?: SessionUser) {
  if (!isBrowser()) return;
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  if (!isBrowser()) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Where each role lands after signing in. */
export function homePathForRole(role: UserRole | string | undefined): string {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMINISTRATOR':
      return '/admin/dashboard';
    case 'STAFF':
      return '/staff/attendance';
    case 'STUDENT':
      return '/student/dashboard';
    default:
      return '/login';
  }
}

/** Route prefixes each role may open. */
const ROLE_AREAS: Record<UserRole, string[]> = {
  SUPER_ADMIN: ['/admin', '/staff'],
  ADMINISTRATOR: ['/admin', '/staff'],
  // Staff also open the admin screens their permissions allow (checked by AppShell)
  STAFF: ['/staff', '/admin'],
  STUDENT: ['/student'],
};

export function canAccessPath(role: UserRole | undefined, path: string): boolean {
  if (!role) return false;
  return (ROLE_AREAS[role] ?? []).some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Only follow `next` if it is a same-origin, in-app path the role may open.
 * Prevents open redirects such as `?next=//evil.example`.
 */
export function safeRedirectPath(next: string | null | undefined, role: UserRole | undefined): string {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) {
    const pathOnly = next.split(/[?#]/)[0];
    if (canAccessPath(role, pathOnly)) return next;
  }
  return homePathForRole(role);
}

/** Read the role/sub from a JWT without verifying it (display/routing only; the API verifies). */
export function decodeToken(token: string): { sub?: string; email?: string; role?: UserRole; exp?: number } | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Exchange the httpOnly refresh cookie for a new access token.
 * Concurrent callers share one request, because the API rotates the refresh token on each use.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { accessToken?: string };
        if (!data.accessToken) return null;

        const claims = decodeToken(data.accessToken);
        const existing = getStoredUser();
        const user: SessionUser | undefined =
          claims?.sub && claims.role
            ? {
                id: claims.sub,
                email: claims.email ?? existing?.email ?? '',
                role: claims.role,
                mustChangePassword: existing?.mustChangePassword,
                permissions: existing?.permissions,
              }
            : existing ?? undefined;
        setSession(data.accessToken, user);
        return data.accessToken;
      } catch {
        return null;
      } finally {
        // Let the next expiry trigger a fresh refresh
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }
  return refreshInFlight;
}

/** Sign out on the server (invalidates the refresh token) and locally. */
export async function logout(): Promise<void> {
  const token = getAccessToken();
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    // Still sign out locally if the API is unreachable
  } finally {
    clearSession();
  }
}

export function loginRedirectUrl(currentPath?: string): string {
  const path = currentPath ?? (isBrowser() ? window.location.pathname + window.location.search : '');
  return path && path !== '/' && !path.startsWith('/login') ? `/login?next=${encodeURIComponent(path)}` : '/login';
}
