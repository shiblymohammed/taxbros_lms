'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clearQuizTimer, formatRemaining, startQuizTimer, type QuizTimer } from '@/lib/quiz-timer';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Clock, AlertCircle, CheckCircle } from 'lucide-react';

interface QuizQuestion {
  id: string;
  questionText: string;
  options: Array<{ id: string; text: string }>;
  marks: number;
  displayOrder: number;
}

interface QuizData {
  id: string;
  title: string;
  description: string | null;
  passMark: number;
  totalMarks: number;
  timeLimit: number | null;
  questions: QuizQuestion[];
}

interface Answer {
  questionId: string;
  selectedAnswer: string;
}

export default function QuizTakingPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const quizId = params.quizId as string;

  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [unansweredQuestions, setUnansweredQuestions] = useState<string[]>([]);
  // Time limit (R25): counts down from when the quiz was opened and submits automatically at zero
  const [timer, setTimer] = useState<QuizTimer | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  const submittedRef = useRef(false);

  // Load quiz data
  useEffect(() => {
    const loadQuiz = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(`/quizzes/${quizId}`);
        setQuiz(response.data);
        setTimer(startQuizTimer(quizId, response.data.timeLimit ?? null));
        setNow(Date.now());
        setError(null);
      } catch (err: any) {
        console.error('Error loading quiz:', err);
        setError(err.response?.data?.message || 'Failed to load quiz');
        toast({
          title: 'Error',
          description: err.response?.data?.message || 'Failed to load quiz',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadQuiz();
  }, [quizId, toast]);

  // Handle answer selection
  const handleAnswerChange = (questionId: string, answerId: string) => {
    setAnswers((prev) => {
      const newAnswers = new Map(prev);
      newAnswers.set(questionId, answerId);
      return newAnswers;
    });
  };

  // Validate all questions answered
  const validateAllAnswered = (): boolean => {
    if (!quiz) return false;

    const unanswered: string[] = [];
    quiz.questions.forEach((question) => {
      if (!answers.has(question.id)) {
        unanswered.push(question.id);
      }
    });

    setUnansweredQuestions(unanswered);
    return unanswered.length === 0;
  };

  // Handle submit button click
  const handleSubmitClick = () => {
    if (!validateAllAnswered()) {
      toast({
        title: 'Incomplete Quiz',
        description: 'Please answer all questions before submitting.',
        variant: 'destructive',
      });
      return;
    }

    setShowConfirmDialog(true);
  };

  // Submit the quiz. timedOut lets unanswered questions through (they score 0).
  const submitQuiz = useCallback(
    async (timedOut: boolean) => {
      if (!quiz || submittedRef.current) return;
      submittedRef.current = true;

      try {
        setSubmitting(true);
        setShowConfirmDialog(false);

        const answersPayload: Answer[] = Array.from(answersRef.current.entries()).map(
          ([questionId, selectedAnswer]) => ({ questionId, selectedAnswer })
        );

        const response = await apiClient.post(`/quizzes/${quizId}/submit`, {
          answers: answersPayload,
          ...(timedOut ? { timedOut: true } : {}),
          ...(timer ? { startedAt: timer.startedAt } : {}),
        });
        clearQuizTimer(quizId);

        // Redirect to results page
        router.push(`/student/quizzes/${quizId}/results/${response.data.attemptId}`);
      } catch (err: any) {
        console.error('Error submitting quiz:', err);
        submittedRef.current = false;
        toast({
          title: 'Submission Failed',
          description: err.response?.data?.message || 'Failed to submit quiz',
          variant: 'destructive',
        });
        setSubmitting(false);
      }
    },
    [quiz, quizId, router, timer, toast]
  );

  const handleConfirmedSubmit = () => submitQuiz(false);

  // Tick once a second while a time limit is running
  const deadline = timer?.deadline ?? null;
  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const remainingMs = deadline === null ? null : deadline - now;
  const timeUp = remainingMs !== null && remainingMs <= 0;

  // Time's up: submit whatever has been answered
  useEffect(() => {
    if (!timeUp || submittedRef.current) return;
    toast({ title: "Time's up", description: 'Your answers have been submitted.' });
    submitQuiz(true);
  }, [timeUp, submitQuiz, toast]);

  // Check if question is unanswered
  const isQuestionUnanswered = (questionId: string): boolean => {
    return unansweredQuestions.includes(questionId);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error || 'Quiz not found'}</p>
            <Button onClick={() => router.push('/student/dashboard')} className="mt-4">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allAnswered = quiz.questions.every((q) => answers.has(q.id));
  const answeredCount = answers.size;
  const totalQuestions = quiz.questions.length;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="link"
          onClick={() => router.push('/student/dashboard')}
          className="p-0 h-auto mb-2"
        >
          ← Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{quiz.title}</h1>
        {quiz.description && (
          <p className="text-gray-600 text-lg">{quiz.description}</p>
        )}
      </div>

      {/* Quiz Info Card */}
      <Card className="mb-6 border-brand-soft bg-brand-soft/50">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Questions</p>
              <p className="text-2xl font-bold text-gray-900">{totalQuestions}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Marks</p>
              <p className="text-2xl font-bold text-gray-900">{quiz.totalMarks}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Pass Mark</p>
              <p className="text-2xl font-bold text-gray-900">{quiz.passMark}</p>
            </div>
            {quiz.timeLimit && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Time left ({quiz.timeLimit} min)</p>
                <p
                  role="timer"
                  aria-label="Time left"
                  className={`text-2xl font-bold flex items-center gap-1 tabular-nums ${
                    remainingMs !== null && remainingMs < 60_000 ? 'text-red-700' : 'text-gray-900'
                  }`}
                >
                  <Clock className="h-5 w-5" />
                  {remainingMs === null ? `${quiz.timeLimit}m` : formatRemaining(remainingMs)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress Indicator */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm font-semibold text-gray-900">
              {answeredCount} / {totalQuestions} answered
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-brand h-2 rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <div className="space-y-6 mb-6">
        {quiz.questions
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((question, index) => {
            const isUnanswered = isQuestionUnanswered(question.id);
            const isAnswered = answers.has(question.id);

            return (
              <Card
                key={question.id}
                className={`${
                  isUnanswered
                    ? 'border-red-300 bg-red-50'
                    : isAnswered
                    ? 'border-green-200 bg-green-50'
                    : ''
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-gray-900 mb-2">
                        Question {index + 1}
                        <span className="ml-2 text-sm font-normal text-gray-600">
                          ({question.marks} {question.marks === 1 ? 'mark' : 'marks'})
                        </span>
                      </CardTitle>
                      <p className="text-gray-800 text-base">{question.questionText}</p>
                    </div>
                    {isAnswered && (
                      <div className="flex-shrink-0">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      </div>
                    )}
                    {isUnanswered && (
                      <div className="flex-shrink-0">
                        <AlertCircle className="h-6 w-6 text-red-600" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={answers.get(question.id) || ''}
                    onValueChange={(value) => handleAnswerChange(question.id, value)}
                  >
                    <div className="space-y-3">
                      {question.options.map((option) => (
                        <div
                          key={option.id}
                          className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                            answers.get(question.id) === option.id
                              ? 'bg-brand-soft border-brand-soft'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <RadioGroupItem value={option.id} id={`${question.id}-${option.id}`} />
                          <Label
                            htmlFor={`${question.id}-${option.id}`}
                            className="flex-1 cursor-pointer text-gray-800"
                          >
                            {option.text}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                  {isUnanswered && (
                    <p className="text-red-600 text-sm mt-3 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Please select an answer
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Submit Button */}
      <Card className="sticky bottom-24 shadow-lg lg:bottom-4">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              {!allAnswered && (
                <p className="text-orange-600 text-sm flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {totalQuestions - answeredCount} question(s) remaining
                </p>
              )}
              {allAnswered && (
                <p className="text-green-600 text-sm flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  All questions answered
                </p>
              )}
            </div>
            <Button
              onClick={handleSubmitClick}
              disabled={submitting}
              size="lg"
              className="min-w-[200px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                'Submit Quiz'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Quiz?</DialogTitle>
            <DialogDescription className="space-y-2">
              <p>Are you sure you want to submit your answers?</p>
              <p className="font-medium text-gray-900">
                You have answered {answeredCount} out of {totalQuestions} questions.
              </p>
              <p className="text-sm text-gray-600">
                Once submitted, you cannot change your answers.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Review Answers
            </Button>
            <Button onClick={handleConfirmedSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                'Submit Quiz'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
