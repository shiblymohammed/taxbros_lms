'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Award, 
  Clock, 
  RotateCcw, 
  History 
} from 'lucide-react';

interface QuestionResult {
  id: string;
  questionText: string;
  options: Array<{ id: string; text: string }>;
  correctAnswer: string;
  marks: number;
  displayOrder: number;
  selectedAnswer: string | null;
  isCorrect: boolean;
  marksAwarded: number;
}

interface AttemptDetail {
  id: string;
  quizId: string;
  quizTitle: string;
  studentId: string;
  studentName: string;
  admissionId: string;
  score: number;
  totalMarks: number;
  passMark: number;
  passed: boolean;
  startedAt: string;
  submittedAt: string;
  questions: QuestionResult[];
}

export default function QuizResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const quizId = params.quizId as string;
  const attemptId = params.attemptId as string;

  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load attempt details
  useEffect(() => {
    const loadAttemptDetails = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(`/quizzes/attempts/${attemptId}`);
        setAttempt(response.data);
        setError(null);
      } catch (err: any) {
        console.error('Error loading attempt details:', err);
        setError(err.response?.data?.message || 'Failed to load quiz results');
        toast({
          title: 'Error',
          description: err.response?.data?.message || 'Failed to load quiz results',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadAttemptDetails();
  }, [attemptId, toast]);

  // Handle retake quiz
  const handleRetake = () => {
    router.push(`/student/quizzes/${quizId}`);
  };

  // Handle view history
  const handleViewHistory = () => {
    // Navigate to attempts history page (to be implemented)
    router.push(`/student/quizzes/${quizId}/attempts`);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error || 'Quiz results not found'}</p>
            <Button onClick={() => router.push('/student/dashboard')} className="mt-4">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const percentage = Math.round((attempt.score / attempt.totalMarks) * 100);
  const correctCount = attempt.questions.filter((q) => q.isCorrect).length;
  const incorrectCount = attempt.questions.length - correctCount;

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="link"
          onClick={() => router.push('/student/dashboard')}
          className="p-0 h-auto mb-2"
        >
          ← Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{attempt.quizTitle}</h1>
        <p className="text-gray-600">Quiz Results</p>
      </div>

      {/* Overall Results Card */}
      <Card className={`mb-6 ${attempt.passed ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Score Display */}
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-full ${attempt.passed ? 'bg-green-100' : 'bg-red-100'}`}>
                {attempt.passed ? (
                  <Award className={`h-12 w-12 ${attempt.passed ? 'text-green-600' : 'text-red-600'}`} />
                ) : (
                  <XCircle className="h-12 w-12 text-red-600" />
                )}
              </div>
              <div>
                <h2 className="text-4xl font-bold text-gray-900">
                  {attempt.score} / {attempt.totalMarks}
                </h2>
                <p className="text-lg text-gray-700 font-medium">
                  {percentage}% Score
                </p>
              </div>
            </div>

            {/* Pass/Fail Badge */}
            <div className="text-center">
              <Badge 
                variant={attempt.passed ? 'default' : 'destructive'} 
                className="text-lg px-6 py-2 mb-2"
              >
                {attempt.passed ? 'PASSED' : 'FAILED'}
              </Badge>
              <p className="text-sm text-gray-600">
                Pass Mark: {attempt.passMark} / {attempt.totalMarks}
              </p>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-2xl font-bold">{correctCount}</span>
                </div>
                <p className="text-sm text-gray-600">Correct</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
                  <XCircle className="h-5 w-5" />
                  <span className="text-2xl font-bold">{incorrectCount}</span>
                </div>
                <p className="text-sm text-gray-600">Incorrect</p>
              </div>
            </div>
          </div>

          {/* Submission Time */}
          <div className="mt-6 pt-6 border-t border-gray-300 flex items-center justify-center gap-2 text-gray-600 text-sm">
            <Clock className="h-4 w-4" />
            <span>
              Submitted on {new Date(attempt.submittedAt).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Asia/Kolkata',
              })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Button onClick={handleRetake} size="lg" className="flex-1 min-w-[200px]">
          <RotateCcw className="h-5 w-5 mr-2" />
          Retake Quiz
        </Button>
        <Button onClick={handleViewHistory} variant="outline" size="lg" className="flex-1 min-w-[200px]">
          <History className="h-5 w-5 mr-2" />
          View All Attempts
        </Button>
      </div>

      {/* Question Results */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Answer Review</h2>
        
        {attempt.questions
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((question, index) => (
            <Card 
              key={question.id}
              className={`${
                question.isCorrect 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-red-200 bg-red-50'
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-gray-900 mb-2">
                      Question {index + 1}
                      <span className="ml-2 text-sm font-normal text-gray-600">
                        ({question.marksAwarded} / {question.marks} {question.marks === 1 ? 'mark' : 'marks'})
                      </span>
                    </CardTitle>
                    <p className="text-gray-800 text-base font-normal">{question.questionText}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {question.isCorrect ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-6 w-6" />
                        <span className="font-semibold">Correct</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-600">
                        <XCircle className="h-6 w-6" />
                        <span className="font-semibold">Incorrect</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {question.options.map((option) => {
                    const isSelected = question.selectedAnswer === option.id;
                    const isCorrect = question.correctAnswer === option.id;
                    
                    let className = 'p-4 rounded-lg border transition-colors ';
                    let icon = null;
                    
                    if (isCorrect && isSelected) {
                      // Correct answer and selected
                      className += 'bg-green-100 border-green-400';
                      icon = <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />;
                    } else if (isCorrect && !isSelected) {
                      // Correct answer but not selected
                      className += 'bg-green-50 border-green-300';
                      icon = <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />;
                    } else if (isSelected && !isCorrect) {
                      // Selected but incorrect
                      className += 'bg-red-100 border-red-400';
                      icon = <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />;
                    } else {
                      // Not selected and not correct
                      className += 'bg-white border-gray-200';
                    }

                    return (
                      <div key={option.id} className={className}>
                        <div className="flex items-start gap-3">
                          {icon}
                          <div className="flex-1">
                            <p className="text-gray-800 font-medium">{option.text}</p>
                            {isSelected && !isCorrect && (
                              <p className="text-red-600 text-sm mt-1">Your answer</p>
                            )}
                            {isCorrect && (
                              <p className="text-green-600 text-sm mt-1 font-semibold">
                                {isSelected ? 'Your answer (Correct!)' : 'Correct answer'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Bottom Action Buttons */}
      <div className="flex flex-wrap gap-4 mt-8 mb-6">
        <Button onClick={handleRetake} size="lg" className="flex-1 min-w-[200px]">
          <RotateCcw className="h-5 w-5 mr-2" />
          Retake Quiz
        </Button>
        <Button onClick={handleViewHistory} variant="outline" size="lg" className="flex-1 min-w-[200px]">
          <History className="h-5 w-5 mr-2" />
          View All Attempts
        </Button>
      </div>
    </div>
  );
}
