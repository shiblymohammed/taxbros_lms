/**
 * Quiz Taking Page Tests
 * 
 * Tests for Task 44: Build quiz taking UI
 * 
 * Requirements validated:
 * - R23: Quiz title, description, time limit display
 * - R24: Questions with radio button options
 * - R25: Answer validation and submission
 * 
 * Test Coverage:
 * - T5: Quiz taking flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import QuizTakingPage from './page';
import { apiClient } from '@/lib/api';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}));

import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

// Sample quiz data
const mockQuizData = {
  id: 'quiz-123',
  title: 'JavaScript Fundamentals Quiz',
  description: 'Test your knowledge of JavaScript basics',
  passMark: 60,
  totalMarks: 100,
  timeLimit: 30,
  questions: [
    {
      id: 'q1',
      questionText: 'What is the correct syntax to print a message in console?',
      options: [
        { id: 'opt1', text: 'print("Hello")' },
        { id: 'opt2', text: 'console.log("Hello")' },
        { id: 'opt3', text: 'echo("Hello")' },
      ],
      marks: 10,
      displayOrder: 1,
    },
    {
      id: 'q2',
      questionText: 'Which keyword is used to declare a constant?',
      options: [
        { id: 'opt4', text: 'var' },
        { id: 'opt5', text: 'let' },
        { id: 'opt6', text: 'const' },
      ],
      marks: 10,
      displayOrder: 2,
    },
  ],
};

// Matches QuizzesService.submitQuiz's response
const mockAttemptResponse = {
  attemptId: 'attempt-456',
  quizId: 'quiz-123',
  score: 80,
  passed: true,
  correctAnswers: [
    { questionId: 'q1', correctAnswer: 'opt2' },
    { questionId: 'q2', correctAnswer: 'opt6' },
  ],
  submittedAt: '2024-01-15T10:30:00Z',
};

describe('QuizTakingPage', () => {
  const mockPush = vi.fn();
  const mockToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(useParams).mockReturnValue({ quizId: 'quiz-123' });
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any);
    vi.mocked(useToast).mockReturnValue({ toast: mockToast } as unknown as ReturnType<typeof useToast>);
  });

  describe('Quiz Loading', () => {
    it('should display loading spinner while fetching quiz', () => {
      vi.mocked(apiClient.get).mockImplementation(() => new Promise(() => {}));

      render(<QuizTakingPage />);

      // Check for loading spinner by class name
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should load and display quiz details', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockQuizData } as any);

      render(<QuizTakingPage />);

      await waitFor(() => {
        expect(screen.getByText('JavaScript Fundamentals Quiz')).toBeInTheDocument();
        expect(screen.getByText('Test your knowledge of JavaScript basics')).toBeInTheDocument();
      });
    });

    it('should display quiz metadata (total questions, marks, pass mark, time limit)', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockQuizData } as any);

      render(<QuizTakingPage />);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument(); // Total questions
        expect(screen.getByText('100')).toBeInTheDocument(); // Total marks
        expect(screen.getByText('60')).toBeInTheDocument(); // Pass mark
        expect(screen.getByText(/30 min/)).toBeInTheDocument(); // Time limit
        expect(screen.getByRole('timer')).toHaveTextContent(/(30:00|29:5\d)/);
      });
    });

    it('should display error message when quiz loading fails', async () => {
      vi.mocked(apiClient.get).mockRejectedValue({
        response: { data: { message: 'Quiz not found' } },
      });

      render(<QuizTakingPage />);

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('Quiz not found')).toBeInTheDocument();
      });
    });
  });

  describe('Questions Rendering', () => {
    beforeEach(async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockQuizData } as any);
    });

    it('should render all questions in correct order', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        expect(screen.getByText('Question 1')).toBeInTheDocument();
        expect(screen.getByText('Question 2')).toBeInTheDocument();
        expect(
          screen.getByText('What is the correct syntax to print a message in console?')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Which keyword is used to declare a constant?')
        ).toBeInTheDocument();
      });
    });

    it('should display question marks', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        // Both sample questions are worth 10 marks
        expect(screen.getAllByText('(10 marks)')).toHaveLength(2);
      });
    });

    it('should render radio button options for each question', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        expect(screen.getByText('print("Hello")')).toBeInTheDocument();
        expect(screen.getByText('console.log("Hello")')).toBeInTheDocument();
        expect(screen.getByText('echo("Hello")')).toBeInTheDocument();
        expect(screen.getByText('var')).toBeInTheDocument();
        expect(screen.getByText('let')).toBeInTheDocument();
        expect(screen.getByText('const')).toBeInTheDocument();
      });
    });
  });

  describe('Answer Selection', () => {
    beforeEach(async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockQuizData } as any);
    });

    it('should allow selecting an answer for a question', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        const radioButton = screen.getByLabelText('console.log("Hello")');
        fireEvent.click(radioButton);
        expect(radioButton).toBeChecked();
      });
    });

    it('should update progress indicator when answers are selected', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        expect(screen.getByText('0 / 2 answered')).toBeInTheDocument();
      });

      const radioButton = screen.getByLabelText('console.log("Hello")');
      fireEvent.click(radioButton);

      await waitFor(() => {
        expect(screen.getByText('1 / 2 answered')).toBeInTheDocument();
      });
    });

    it('should highlight answered questions with checkmark', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        const radioButton = screen.getByLabelText('console.log("Hello")');
        fireEvent.click(radioButton);
      });

      // Check that question card has green styling when answered
      await waitFor(() => {
        const cards = document.querySelectorAll('.bg-green-50');
        expect(cards.length).toBeGreaterThan(0);
      });
    });

    it('should allow changing answer selection', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        const firstOption = screen.getByLabelText('print("Hello")');
        fireEvent.click(firstOption);
        expect(firstOption).toBeChecked();

        const secondOption = screen.getByLabelText('console.log("Hello")');
        fireEvent.click(secondOption);
        expect(secondOption).toBeChecked();
        expect(firstOption).not.toBeChecked();
      });
    });
  });

  describe('Answer Validation', () => {
    beforeEach(async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockQuizData } as any);
    });

    it('should show error when attempting to submit with unanswered questions', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit Quiz');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Incomplete Quiz',
          description: 'Please answer all questions before submitting.',
          variant: 'destructive',
        });
      });
    });

    it('should highlight unanswered questions in red', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit Quiz');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getAllByText('Please select an answer')).toHaveLength(2);
      });
    });

    it('should show confirmation dialog when all questions are answered', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        const answer1 = screen.getByLabelText('console.log("Hello")');
        fireEvent.click(answer1);
        const answer2 = screen.getByLabelText('const');
        fireEvent.click(answer2);
      });

      const submitButton = screen.getByText('Submit Quiz');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Submit Quiz?')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to submit your answers?/)).toBeInTheDocument();
      });
    });
  });

  describe('Quiz Submission', () => {
    beforeEach(async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockQuizData } as any);
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockAttemptResponse } as any);
    });

    it('should display loading state during submission', async () => {
      vi.mocked(apiClient.post).mockImplementation(() => new Promise(() => {}));

      render(<QuizTakingPage />);

      await waitFor(() => {
        const answer1 = screen.getByLabelText('console.log("Hello")');
        fireEvent.click(answer1);
        const answer2 = screen.getByLabelText('const');
        fireEvent.click(answer2);
      });

      const submitButton = screen.getByText('Submit Quiz');
      fireEvent.click(submitButton);

      await waitFor(() => {
        const confirmButton = within(screen.getByRole('dialog')).getByRole('button', { name: 'Submit Quiz' });
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Submitting...')).toBeInTheDocument();
      });
    });

    it('should submit answers with correct payload format', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        const answer1 = screen.getByLabelText('console.log("Hello")');
        fireEvent.click(answer1);
        const answer2 = screen.getByLabelText('const');
        fireEvent.click(answer2);
      });

      const submitButton = screen.getByText('Submit Quiz');
      fireEvent.click(submitButton);

      await waitFor(() => {
        const confirmButton = within(screen.getByRole('dialog')).getByRole('button', { name: 'Submit Quiz' });
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          '/quizzes/quiz-123/submit',
          expect.objectContaining({
            answers: expect.arrayContaining([
              expect.objectContaining({
                questionId: expect.any(String),
                selectedAnswer: expect.any(String),
              }),
            ]),
          })
        );
      });
    });

    it('should redirect to results page on successful submission', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        const answer1 = screen.getByLabelText('console.log("Hello")');
        fireEvent.click(answer1);
        const answer2 = screen.getByLabelText('const');
        fireEvent.click(answer2);
      });

      const submitButton = screen.getByText('Submit Quiz');
      fireEvent.click(submitButton);

      await waitFor(() => {
        const confirmButton = within(screen.getByRole('dialog')).getByRole('button', { name: 'Submit Quiz' });
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/student/quizzes/quiz-123/results/attempt-456');
      });
    });

    it('should show error toast on submission failure', async () => {
      vi.mocked(apiClient.post).mockRejectedValue({
        response: { data: { message: 'Submission failed' } },
      });

      render(<QuizTakingPage />);

      await waitFor(() => {
        const answer1 = screen.getByLabelText('console.log("Hello")');
        fireEvent.click(answer1);
        const answer2 = screen.getByLabelText('const');
        fireEvent.click(answer2);
      });

      const submitButton = screen.getByText('Submit Quiz');
      fireEvent.click(submitButton);

      await waitFor(() => {
        const confirmButton = within(screen.getByRole('dialog')).getByRole('button', { name: 'Submit Quiz' });
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Submission Failed',
          description: 'Submission failed',
          variant: 'destructive',
        });
      });
    });
  });

  describe('Confirmation Dialog', () => {
    beforeEach(async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockQuizData } as any);
    });

    it('should display answer count in confirmation dialog', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        const answer1 = screen.getByLabelText('console.log("Hello")');
        fireEvent.click(answer1);
        const answer2 = screen.getByLabelText('const');
        fireEvent.click(answer2);
      });

      const submitButton = screen.getByText('Submit Quiz');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/You have answered 2 out of 2 questions/)).toBeInTheDocument();
      });
    });

    it('should warn that answers cannot be changed after submission', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        const answer1 = screen.getByLabelText('console.log("Hello")');
        fireEvent.click(answer1);
        const answer2 = screen.getByLabelText('const');
        fireEvent.click(answer2);
      });

      const submitButton = screen.getByText('Submit Quiz');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText('Once submitted, you cannot change your answers.')
        ).toBeInTheDocument();
      });
    });

    it('should allow canceling submission to review answers', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        const answer1 = screen.getByLabelText('console.log("Hello")');
        fireEvent.click(answer1);
        const answer2 = screen.getByLabelText('const');
        fireEvent.click(answer2);
      });

      const submitButton = screen.getByText('Submit Quiz');
      fireEvent.click(submitButton);

      await waitFor(() => {
        const reviewButton = screen.getByText('Review Answers');
        fireEvent.click(reviewButton);
      });

      await waitFor(() => {
        expect(screen.queryByText('Submit Quiz?')).not.toBeInTheDocument();
      });
    });
  });

  describe('UI/UX Features', () => {
    beforeEach(async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockQuizData } as any);
    });

    it('should display progress bar showing completion percentage', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        // Check that progress bar element exists
        const progressBar = document.querySelector('.bg-blue-600');
        expect(progressBar).toBeInTheDocument();
      });
    });

    it('should enable submit button regardless of answer status', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit Quiz');
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should show remaining questions count', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        expect(screen.getByText('2 question(s) remaining')).toBeInTheDocument();
      });

      const answer1 = screen.getByLabelText('console.log("Hello")');
      fireEvent.click(answer1);

      await waitFor(() => {
        expect(screen.getByText('1 question(s) remaining')).toBeInTheDocument();
      });
    });

    it('should show success message when all questions are answered', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        const answer1 = screen.getByLabelText('console.log("Hello")');
        fireEvent.click(answer1);
        const answer2 = screen.getByLabelText('const');
        fireEvent.click(answer2);
      });

      await waitFor(() => {
        expect(screen.getByText('All questions answered')).toBeInTheDocument();
      });
    });

    it('should have back to dashboard navigation', async () => {
      render(<QuizTakingPage />);

      await waitFor(() => {
        const backButton = screen.getByText('← Back to Dashboard');
        expect(backButton).toBeInTheDocument();
        fireEvent.click(backButton);
        expect(mockPush).toHaveBeenCalledWith('/student/dashboard');
      });
    });
  });

  describe('Time limit (R25)', () => {
    it('submits automatically when time runs out, with unanswered questions allowed', async () => {
      // The quiz was opened earlier and its time is already up
      const startedAt = new Date(Date.now() - 31 * 60_000).toISOString();
      sessionStorage.setItem('quiz-timer:quiz-123', JSON.stringify({ startedAt, deadline: Date.now() - 1000 }));
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockQuizData } as any);
      vi.mocked(apiClient.post).mockResolvedValue({ data: { attemptId: 'attempt-9' } } as any);

      render(<QuizTakingPage />);

      await waitFor(() =>
        expect(apiClient.post).toHaveBeenCalledWith('/quizzes/quiz-123/submit', {
          answers: [],
          timedOut: true,
          startedAt,
        }),
      );
      expect(mockPush).toHaveBeenCalledWith('/student/quizzes/quiz-123/results/attempt-9');
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Time's up" }));
      expect(sessionStorage.getItem('quiz-timer:quiz-123')).toBeNull();
      expect(apiClient.post).toHaveBeenCalledTimes(1);
    });
  });
});
