import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SettingsPage from './page';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({ apiClient: { get: vi.fn(), patch: vi.fn() } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const settings = [
  {
    key: 'timezone',
    label: 'Institute timezone',
    description: 'Used for attendance dates',
    value: 'Asia/Kolkata',
    isDefault: true,
    updatedBy: null,
    updatedByName: null,
    updatedAt: null,
  },
  {
    key: 'instituteName',
    label: 'Institute name',
    description: 'Shown in the app',
    value: 'TaxBros Academy',
    isDefault: false,
    updatedBy: 'admin-1',
    updatedByName: 'admin@taxbros.test',
    updatedAt: '2026-11-21T09:00:00Z',
  },
];

describe('SettingsPage (R6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: settings });
  });

  it('shows each setting with who changed it last', async () => {
    render(<SettingsPage />);
    expect(await screen.findByLabelText('Institute timezone')).toHaveValue('Asia/Kolkata');
    expect(screen.getByText('Using the default value')).toBeInTheDocument();
    expect(screen.getByText(/last changed by admin@taxbros.test on 21 Nov 2026/i)).toBeInTheDocument();
  });

  it('saves a new timezone', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { ...settings[0], value: 'Asia/Dubai', isDefault: false } });
    render(<SettingsPage />);
    const select = await screen.findByLabelText('Institute timezone');
    fireEvent.change(select, { target: { value: 'Asia/Dubai' } });
    fireEvent.click(screen.getAllByRole('button', { name: /save/i })[0]);

    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/settings/timezone', { value: 'Asia/Dubai' }));
  });

  it('shows the server error when a value is refused', async () => {
    vi.mocked(apiClient.patch).mockRejectedValue({ response: { status: 403, data: { message: 'Forbidden resource' } } });
    render(<SettingsPage />);
    const name = await screen.findByLabelText('Institute name');
    fireEvent.change(name, { target: { value: 'TaxBros Kochi' } });
    fireEvent.click(screen.getAllByRole('button', { name: /save/i })[1]);

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden resource');
  });

  it('checks the name length before saving', async () => {
    render(<SettingsPage />);
    const name = await screen.findByLabelText('Institute name');
    fireEvent.change(name, { target: { value: 'X' } });
    fireEvent.click(screen.getAllByRole('button', { name: /save/i })[1]);

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 2 characters/);
    expect(apiClient.patch).not.toHaveBeenCalled();
  });
});
