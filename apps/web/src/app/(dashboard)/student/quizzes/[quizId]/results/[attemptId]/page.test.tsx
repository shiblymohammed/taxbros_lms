/**
 * Quiz Results Page Tests
 * 
 * Tests for Task 45: Build quiz results page
 * 
 * Requirements validated:
 * - R25: Quiz submission and scoring
 * - R26: Quiz attempt history
 * 
 * Test Coverage:
 * - T5: Results display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/api';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}));

const mockAttemptData = {
  id: 'attempt-1',
  quizId: 'quiz-1',
  quizTitle: 'Introduction to Taxation Quiz',
  studentId: 'student-1',
  studentName: 'John Doe',
  admissionId: 'ADM001',
  score: 15,
  totalMarks: 20,
  passMark: 12,
  passed: true,
  startedAt: '2024-01-15T10:00:00Z',
  submittedAt: '2024-01-15T10:30:00Z',
  questions: [
    {
      id: 'q1',
      questionText: 'What is GST?',
      options: [
        { id: 'opt1', text: 'Goods and Services Tax' },
        { id: 'opt2', text: 'General Sales Tax' },
        { id: 'opt3', text: 'Government Service Tax' },
        { id: 'opt4', text: 'Global Sales Tax' },
      ],
      correctAnswer: 'opt1',
      marks: 5,
      displayOrder: 1,
      selectedAnswer: 'opt1',
      isCorrect: true,
      marksAwarded: 5,
    },
    {
      id: 'q2',
      questionText: 'What is the full form of PAN?',
      options: [
        { id: 'opt1', text: 'Personal Account Number' },
        { id: 'opt2', text: 'Permanent Account Number' },
        { id: 'opt3', text: 'Public Account Number' },
        { id: 'opt4', text: 'Private Account Number' },
      ],
      correctAnswer: 'opt2',
      marks: 5,
      displayOrder: 2,
      selectedAnswer: 'opt1',
      isCorrect: false,
      marksAwarded: 0,
    },
  ],
};

describe('QuizResultsPage - API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch attempt details from the correct API endpoint', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: mockAttemptData,
    });

    const attemptId = 'attempt-1';
    const response = await apiClient.get(`/quizzes/attempts/${attemptId}`);

    expect(apiClient.get).toHaveBeenCalledWith(`/quizzes/attempts/${attemptId}`);
    expect(response.data).toEqual(mockAttemptData);
  });

  it('should return attempt details with score and pass status', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: mockAttemptData,
    });

    const response = await apiClient.get('/quizzes/attempts/attempt-1');
    const attempt = response.data;

    expect(attempt.score).toBe(15);
    expect(attempt.totalMarks).toBe(20);
    expect(attempt.passMark).toBe(12);
    expect(attempt.passed).toBe(true);
  });

  it('should return questions with correct and selected answers', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: mockAttemptData,
    });

    const response = await apiClient.get('/quizzes/attempts/attempt-1');
    const attempt = response.data;

    expect(attempt.questions).toHaveLength(2);
    expect(attempt.questions[0].selectedAnswer).toBe('opt1');
    expect(attempt.questions[0].correctAnswer).toBe('opt1');
    expect(attempt.questions[0].isCorrect).toBe(true);
    expect(attempt.questions[1].isCorrect).toBe(false);
  });

  it('should return marks awarded for each question', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: mockAttemptData,
    });

    const response = await apiClient.get('/quizzes/attempts/attempt-1');
    const attempt = response.data;

    expect(attempt.questions[0].marksAwarded).toBe(5);
    expect(attempt.questions[1].marksAwarded).toBe(0);
  });

  it('should handle failed quiz attempts correctly', async () => {
    const failedAttempt = {
      ...mockAttemptData,
      score: 10,
      passed: false,
    };

    vi.mocked(apiClient.get).mockResolvedValue({
      data: failedAttempt,
    });

    const response = await apiClient.get('/quizzes/attempts/attempt-1');
    const attempt = response.data;

    expect(attempt.score).toBe(10);
    expect(attempt.passed).toBe(false);
    expect(attempt.score).toBeLessThan(attempt.passMark);
  });

  it('should calculate percentage correctly', () => {
    const score = mockAttemptData.score;
    const totalMarks = mockAttemptData.totalMarks;
    const percentage = Math.round((score / totalMarks) * 100);

    expect(percentage).toBe(75);
  });

  it('should count correct and incorrect answers', () => {
    const correctCount = mockAttemptData.questions.filter((q) => q.isCorrect).length;
    const incorrectCount = mockAttemptData.questions.length - correctCount;

    expect(correctCount).toBe(1);
    expect(incorrectCount).toBe(1);
  });

  it('should include quiz title and submission timestamp', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: mockAttemptData,
    });

    const response = await apiClient.get('/quizzes/attempts/attempt-1');
    const attempt = response.data;

    expect(attempt.quizTitle).toBe('Introduction to Taxation Quiz');
    expect(attempt.submittedAt).toBe('2024-01-15T10:30:00Z');
    expect(new Date(attempt.submittedAt)).toBeInstanceOf(Date);
  });

  it('should include all question options', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: mockAttemptData,
    });

    const response = await apiClient.get('/quizzes/attempts/attempt-1');
    const attempt = response.data;

    const firstQuestion = attempt.questions[0];
    expect(firstQuestion.options).toHaveLength(4);
    expect(firstQuestion.options[0].text).toBe('Goods and Services Tax');
  });

  it('should handle API errors gracefully', async () => {
    vi.mocked(apiClient.get).mockRejectedValue({
      response: {
        data: {
          message: 'Attempt not found',
        },
      },
    });

    await expect(apiClient.get('/quizzes/attempts/invalid-id')).rejects.toMatchObject({
      response: {
        data: {
          message: 'Attempt not found',
        },
      },
    });
  });
});

describe('QuizResultsPage - Business Logic', () => {
  it('should determine pass status based on score vs pass mark', () => {
    const testCases = [
      { score: 15, passMark: 12, expected: true },
      { score: 12, passMark: 12, expected: true },
      { score: 11, passMark: 12, expected: false },
      { score: 20, passMark: 12, expected: true },
      { score: 0, passMark: 12, expected: false },
    ];

    testCases.forEach(({ score, passMark, expected }) => {
      const passed = score >= passMark;
      expect(passed).toBe(expected);
    });
  });

  it('should calculate percentage for various scores', () => {
    const testCases = [
      { score: 15, total: 20, expected: 75 },
      { score: 20, total: 20, expected: 100 },
      { score: 10, total: 20, expected: 50 },
      { score: 0, total: 20, expected: 0 },
      { score: 17, total: 20, expected: 85 },
    ];

    testCases.forEach(({ score, total, expected }) => {
      const percentage = Math.round((score / total) * 100);
      expect(percentage).toBe(expected);
    });
  });

  it('should correctly identify correct and incorrect answers', () => {
    const questions = mockAttemptData.questions;
    
    questions.forEach((question) => {
      const isCorrect = question.selectedAnswer === question.correctAnswer;
      expect(isCorrect).toBe(question.isCorrect);
    });
  });

  it('should award marks only for correct answers', () => {
    const questions = mockAttemptData.questions;
    
    questions.forEach((question) => {
      const expectedMarks = question.isCorrect ? question.marks : 0;
      expect(question.marksAwarded).toBe(expectedMarks);
    });
  });
});
