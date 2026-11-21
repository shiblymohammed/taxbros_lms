import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ClassRegisterPage from './page';
import { AttendanceStatus, classesApi, registersApi, type AttendanceRegister } from '@/lib/api';
import { changedMarks, entriesFromRegister } from '@/lib/attendance-register';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    classesApi: { getAll: vi.fn() },
    registersApi: { open: vi.fn(), mark: vi.fn() },
  };
});

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

function makeRegister(overrides: Partial<AttendanceRegister> = {}): AttendanceRegister {
  return {
    id: 'reg-1',
    classId: 'class-1',
    className: 'GST Batch A',
    attendanceDate: '2026-11-21T00:00:00.000Z',
    status: 'DRAFT',
    createdAt: '',
    updatedAt: '',
    students: [
      { studentId: 's1', admissionId: 'TB-001', firstName: 'Aarav', lastName: 'Pillai' },
      { studentId: 's2', admissionId: 'TB-002', firstName: 'Diya', lastName: 'Thomas' },
    ],
    ...overrides,
  };
}

describe('attendance register helpers', () => {
  it('sends only new or changed marks and never unmarked rows', () => {
    const saved = entriesFromRegister(
      makeRegister({
        students: [
          { studentId: 's1', admissionId: '1', firstName: 'A', lastName: 'A', status: AttendanceStatus.PRESENT },
          { studentId: 's2', admissionId: '2', firstName: 'B', lastName: 'B' },
          { studentId: 's3', admissionId: '3', firstName: 'C', lastName: 'C' },
        ],
      }),
    );
    const edited = {
      ...saved,
      s2: { status: AttendanceStatus.LATE, remarks: '  bus delay ' },
    };
    expect(changedMarks(edited, saved)).toEqual([{ studentId: 's2', status: 'LATE', remarks: 'bus delay' }]);
  });
});

describe('ClassRegisterPage (Task 22, T2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(classesApi.getAll).mockResolvedValue([{ id: 'class-1', name: 'GST Batch A', status: 'ACTIVE' }]);
  });

  it('opens the register for the only class and saves the marks', async () => {
    vi.mocked(registersApi.open).mockResolvedValue(makeRegister());
    vi.mocked(registersApi.mark).mockImplementation(async (_id, marks) =>
      makeRegister({
        status: 'SAVED',
        students: makeRegister().students.map((s) => ({
          ...s,
          status: marks.find((m) => m.studentId === s.studentId)?.status ?? null,
        })),
      }),
    );

    render(<ClassRegisterPage />);

    await screen.findByText('Aarav Pillai');
    expect(registersApi.open).toHaveBeenCalledWith('class-1', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(screen.getByText(/2 unmarked/)).toBeInTheDocument();

    // Save is disabled until something is marked
    const save = screen.getByRole('button', { name: /save register/i });
    expect(save).toBeDisabled();

    const aarav = screen.getByRole('radiogroup', { name: 'Attendance for Aarav Pillai' });
    fireEvent.click(within(aarav).getByRole('radio', { name: 'Absent' }));
    fireEvent.click(screen.getByRole('button', { name: /mark rest present/i }));
    expect(screen.getByText(/2 unsaved/)).toBeInTheDocument();

    fireEvent.click(save);

    await waitFor(() =>
      expect(registersApi.mark).toHaveBeenCalledWith('reg-1', [
        { studentId: 's1', status: 'ABSENT' },
        { studentId: 's2', status: 'PRESENT' },
      ]),
    );
    await screen.findByRole('button', { name: /save corrections/i });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Register saved' }));
  });

  it('sends only the corrected row when a saved register is changed', async () => {
    vi.mocked(registersApi.open).mockResolvedValue(
      makeRegister({
        status: 'SAVED',
        students: makeRegister().students.map((s) => ({ ...s, status: AttendanceStatus.PRESENT })),
      }),
    );
    vi.mocked(registersApi.mark).mockResolvedValue(makeRegister({ status: 'SAVED' }));

    render(<ClassRegisterPage />);
    const diya = await screen.findByRole('radiogroup', { name: 'Attendance for Diya Thomas' });
    fireEvent.click(within(diya).getByRole('radio', { name: 'Late' }));
    fireEvent.click(screen.getByRole('button', { name: /save corrections/i }));

    await waitFor(() =>
      expect(registersApi.mark).toHaveBeenCalledWith('reg-1', [{ studentId: 's2', status: 'LATE' }]),
    );
  });

  it('explains a missing MARK_ATTENDANCE permission instead of showing the roster', async () => {
    vi.mocked(registersApi.open).mockRejectedValue({ response: { status: 403, data: { message: 'denied' } } });

    render(<ClassRegisterPage />);

    expect(await screen.findByText(/need the Mark Attendance permission/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save register/i })).not.toBeInTheDocument();
  });

  it('tells the user when there are no classes', async () => {
    vi.mocked(classesApi.getAll).mockResolvedValue([]);
    render(<ClassRegisterPage />);
    expect(await screen.findByText(/No active classes yet/i)).toBeInTheDocument();
    expect(registersApi.open).not.toHaveBeenCalled();
  });
});
