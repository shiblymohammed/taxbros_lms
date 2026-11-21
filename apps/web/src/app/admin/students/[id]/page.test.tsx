import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import StudentProfilePage from './page';
import { apiClient, quizzesApi } from '@/lib/api';

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'stu-1' }) }));
vi.mock('@/lib/api', async (orig) => {
  const actual = await orig<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
    quizzesApi: { getAttemptDetail: vi.fn() },
  };
});

const profile = {
  id: 'stu-1',
  userId: 'u1',
  admissionId: 'TB-001',
  firstName: 'Aarav',
  lastName: 'Pillai',
  admissionDate: '2026-06-01T00:00:00.000Z',
  user: { id: 'u1', email: 'aarav@taxbros.test', status: 'ACTIVE', lastLoginAt: null },
  courseEnrollments: [
    { id: 'ce1', status: 'ACTIVE', progressPercentage: 40, enrolledAt: '', course: { id: 'c1', title: 'GST Basics', status: 'PUBLISHED' } },
  ],
  classEnrollments: [
    { id: 'cl1', status: 'ACTIVE', enrolledAt: '', class: { id: 'k1', name: 'Batch A', status: 'ACTIVE' } },
    { id: 'cl2', status: 'INACTIVE', enrolledAt: '', class: { id: 'k2', name: 'Batch Z', status: 'ACTIVE' } },
  ],
  quizAttempts: [
    { id: 'qa1', score: 4, passed: true, submittedAt: '2026-11-20T09:00:00Z', quiz: { id: 'q1', title: 'GST quiz', totalMarks: 5, passMark: 3 } },
    { id: 'qa2', score: 1, passed: false, submittedAt: '2026-11-19T09:00:00Z', quiz: { id: 'q1', title: 'GST quiz', totalMarks: 5, passMark: 3 } },
  ],
};

const attempt = {
  id: 'qa2',
  quizTitle: 'GST quiz',
  score: 1,
  totalMarks: 5,
  passMark: 3,
  passed: false,
  submittedAt: '2026-11-19T09:00:00Z',
  questions: [
    {
      id: 'q-1',
      questionText: 'Which return reports outward supplies?',
      options: [
        { id: 'a', text: 'GSTR-1' },
        { id: 'b', text: 'GSTR-3B' },
      ],
      correctAnswer: 'a',
      selectedAnswer: 'b',
      isCorrect: false,
      marks: 1,
      marksAwarded: 0,
      displayOrder: 1,
    },
  ],
};

describe('StudentProfilePage (R5.4, R26.5)', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url === '/students/stu-1') return { data: profile };
      if (url === '/settings') return { data: [{ key: 'timezone', value: 'Asia/Kolkata' }] };
      throw new Error(`unexpected ${url}`);
    });
    vi.mocked(quizzesApi.getAttemptDetail).mockResolvedValue(attempt as never);
  });

  it('shows course progress, current and past classes, and every quiz attempt', async () => {
    render(<StudentProfilePage />);

    expect(await screen.findByRole('heading', { name: 'Aarav Pillai' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /gst basics/i })).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText('Batch A')).toBeInTheDocument();
    expect(screen.getByText(/previously in: batch z/i)).toBeInTheDocument();
    expect(screen.getByText(/2 attempts, 1 passed/i)).toBeInTheDocument();
    expect(screen.getByText('Not passed')).toBeInTheDocument();
  });

  it('opens an attempt with the chosen and correct answers', async () => {
    render(<StudentProfilePage />);
    const buttons = await screen.findAllByRole('button', { name: 'Answers' });
    fireEvent.click(buttons[1]);

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/which return reports outward supplies/i)).toBeInTheDocument();
    expect(within(dialog).getByText('Answered: GSTR-3B')).toBeInTheDocument();
    expect(within(dialog).getByText('Correct: GSTR-1')).toBeInTheDocument();
    expect(within(dialog).getByText(/pass mark 3/i)).toBeInTheDocument();
    expect(quizzesApi.getAttemptDetail).toHaveBeenCalledWith('qa2');
  });

  it('shows the API error, e.g. when the student does not exist', async () => {
    vi.mocked(apiClient.get).mockRejectedValue({ response: { status: 404, data: { message: 'Student not found' } } });
    render(<StudentProfilePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Student not found');
  });
});
