import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppShell } from './app-shell';
import { apiClient } from '@/lib/api';
import { ADMIN_NAV } from '@/config/navigation';

const replace = vi.fn();
// Stable like the real Next router (the shell re-checks the session when it changes)
const router = { replace, push: vi.fn() };
let pathname = '/admin/classes';
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => pathname,
}));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('@/lib/api', () => ({ apiClient: { get: vi.fn() } }));

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

const adminArea = (
  <AppShell roleLabel="Administrator" nav={ADMIN_NAV} roles={['ADMINISTRATOR', 'SUPER_ADMIN', 'STAFF']} staffByPermission>
    <p>screen content</p>
  </AppShell>
);

describe('AppShell staff access to admin screens (R3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    store.set('accessToken', 'token');
    store.set('authUser', JSON.stringify({ id: 'u1', email: 'staff@taxbros.test', role: 'STAFF' }));
    vi.mocked(apiClient.get).mockResolvedValue({ data: { permissions: ['MANAGE_CLASSES'] } });
  });

  it('opens a permitted screen with a menu built from the permissions', async () => {
    pathname = '/admin/classes';
    render(adminArea);

    expect(await screen.findByText('screen content')).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/auth/me');
    expect(screen.getAllByRole('link', { name: 'Classes' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Courses' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    expect(JSON.parse(store.get('authUser')!).permissions).toEqual(['MANAGE_CLASSES']);
  });

  it('sends staff back to the class register from a screen they lack permission for', async () => {
    pathname = '/admin/courses';
    render(adminArea);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/staff/attendance'));
    expect(screen.queryByText('screen content')).not.toBeInTheDocument();
  });

  it('follows a revoked permission straight away', async () => {
    store.set('authUser', JSON.stringify({ id: 'u1', email: 's@t', role: 'STAFF', permissions: ['MANAGE_CLASSES'] }));
    vi.mocked(apiClient.get).mockResolvedValue({ data: { permissions: [] } });
    pathname = '/admin/classes';
    render(adminArea);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/staff/attendance'));
  });

  it('keeps the full admin menu for administrators', async () => {
    store.set('authUser', JSON.stringify({ id: 'a1', email: 'admin@taxbros.test', role: 'ADMINISTRATOR' }));
    pathname = '/admin/settings';
    render(adminArea);

    expect(await screen.findByText('screen content')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Settings' }).length).toBeGreaterThan(0);
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});
