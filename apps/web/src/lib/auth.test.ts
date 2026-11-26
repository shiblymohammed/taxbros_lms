import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canAccessPath,
  clearSession,
  decodeToken,
  getAccessToken,
  getStoredUser,
  homePathForRole,
  loginRedirectUrl,
  refreshAccessToken,
  safeRedirectPath,
  setSession,
} from './auth';

// The shared setup stubs localStorage with no-ops; these tests need a working store
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  },
});

function fakeJwt(payload: Record<string, unknown>) {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`;
}

describe('role routing', () => {
  it('sends each role to its home', () => {
    expect(homePathForRole('STUDENT')).toBe('/student/dashboard');
    expect(homePathForRole('STAFF')).toBe('/staff/check-in');
    expect(homePathForRole('ADMINISTRATOR')).toBe('/admin/dashboard');
    expect(homePathForRole('SUPER_ADMIN')).toBe('/admin/dashboard');
    expect(homePathForRole(undefined)).toBe('/login');
  });

  it('limits areas by role', () => {
    expect(canAccessPath('STUDENT', '/student/labs/gst')).toBe(true);
    expect(canAccessPath('STUDENT', '/admin/labs')).toBe(false);
    // Staff may enter /admin; the shell then allows only the screens their permissions cover
    expect(canAccessPath('STAFF', '/admin/classes')).toBe(true);
    expect(canAccessPath('STAFF', '/student/dashboard')).toBe(false);
    expect(canAccessPath('ADMINISTRATOR', '/staff/attendance')).toBe(true);
    expect(canAccessPath('STUDENT', '/studentx')).toBe(false);
  });
});

describe('safeRedirectPath', () => {
  it('follows an allowed in-app path', () => {
    expect(safeRedirectPath('/student/labs/itr?x=1', 'STUDENT')).toBe('/student/labs/itr?x=1');
  });

  it('ignores paths outside the role area', () => {
    expect(safeRedirectPath('/admin/labs', 'STUDENT')).toBe('/student/dashboard');
  });

  it('blocks open redirects', () => {
    expect(safeRedirectPath('//evil.example/student', 'STUDENT')).toBe('/student/dashboard');
    expect(safeRedirectPath('https://evil.example', 'STUDENT')).toBe('/student/dashboard');
    expect(safeRedirectPath('/\evil.example', 'STUDENT')).toBe('/student/dashboard');
  });
});

describe('session storage', () => {
  beforeEach(() => localStorage.clear());

  it('stores and clears the session', () => {
    setSession('tok', { id: 'u1', email: 'a@b.c', role: 'STUDENT' });
    expect(getAccessToken()).toBe('tok');
    expect(getStoredUser()?.role).toBe('STUDENT');
    clearSession();
    expect(getAccessToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  it('decodes JWT claims', () => {
    expect(decodeToken(fakeJwt({ sub: 'u1', role: 'STAFF' }))).toMatchObject({ sub: 'u1', role: 'STAFF' });
    expect(decodeToken('garbage')).toBeNull();
  });

  it('builds a login URL that returns to the current page', () => {
    expect(loginRedirectUrl('/student/labs')).toBe('/login?next=%2Fstudent%2Flabs');
    expect(loginRedirectUrl('/')).toBe('/login');
  });
});

describe('refreshAccessToken', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('shares one request between concurrent callers and stores the new token', async () => {
    const token = fakeJwt({ sub: 'u1', email: 'a@b.c', role: 'STUDENT' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accessToken: token }) });
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([refreshAccessToken(), refreshAccessToken()]);
    expect(a).toBe(token);
    expect(b).toBe(token);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(getStoredUser()).toMatchObject({ id: 'u1', role: 'STUDENT' });
  });

  it('returns null when the refresh cookie is rejected', async () => {
    await new Promise((r) => setTimeout(r, 0));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await refreshAccessToken()).toBeNull();
    expect(getAccessToken()).toBeNull();
  });
});
