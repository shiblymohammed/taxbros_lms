import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChangePasswordPage from './page';
import { apiClient } from '@/lib/api';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams('next=/student/labs'),
}));

vi.mock('@/lib/api', () => ({ apiClient: { post: vi.fn() } }));

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

describe('ChangePasswordPage (R36)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    store.set('accessToken', 'old-token');
    store.set('authUser', JSON.stringify({ id: 'u1', email: 's@taxbros.test', role: 'STUDENT', mustChangePassword: true }));
  });

  const fill = (current: string, next: string, confirm = next) => {
    fireEvent.change(screen.getByLabelText(/current \(temporary\) password/i), { target: { value: current } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: next } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: confirm } });
  };

  it('explains a forced change and blocks weak passwords', async () => {
    render(<ChangePasswordPage />);
    expect(await screen.findByText(/set a new password before you continue/i)).toBeInTheDocument();

    fill('Temp#Pass12', 'weakpass');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/does not meet all the rules/i);
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('changes the password, stores the new token, clears the flag and continues', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { accessToken: 'new-token' } });
    render(<ChangePasswordPage />);
    await screen.findByLabelText(/current \(temporary\) password/i);

    fill('Temp#Pass12', 'N3w#Password');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/student/labs'));
    expect(apiClient.post).toHaveBeenCalledWith('/auth/change-password', {
      currentPassword: 'Temp#Pass12',
      newPassword: 'N3w#Password',
    });
    expect(store.get('accessToken')).toBe('new-token');
    expect(JSON.parse(store.get('authUser')!).mustChangePassword).toBe(false);
  });

  it('shows the API error (e.g. wrong current password)', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({ response: { status: 400, data: { message: 'Current password is incorrect' } } });
    render(<ChangePasswordPage />);
    await screen.findByLabelText(/current \(temporary\) password/i);

    fill('Wrong#Pass1', 'N3w#Password');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect');
    expect(replace).not.toHaveBeenCalled();
  });
});
