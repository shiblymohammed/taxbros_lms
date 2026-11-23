'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient, quizzesApi, type Quiz, type QuizAttemptSummary } from '@/lib/api';
import { Loader2, BookOpen, ClipboardCheck, Trophy, Clock, PlayCircle } from 'lucide-react';

interface Course {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  courseCoverImage: string | null;
  enrollmentStatus: 'ACTIVE' | 'COMPLETED' | 'DROPPED';
  progressPercentage: number;
  totalLessons: number;
  completedLessons: number;
  lastAccessedAt: string | null;
  enrolledAt: string;
}

interface StudentProgress {
  studentId: string;
  studentName: string;
  courses: Course[];
}

interface NextLesson {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
}

interface AvailableQuiz extends Quiz {
  courseTitle?: string;
  attemptCount: number;
  bestScore?: number;
  bestAttemptPassed: boolean;
  lastAttemptDate?: string;
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [nextLessons, setNextLessons] = useState<Map<string, NextLesson>>(new Map());
  const [availableQuizzes, setAvailableQuizzes] = useState<AvailableQuiz[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<Map<string, QuizAttemptSummary[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // The signed-in user's Student profile ID (students cannot list /students)
        const userResponse = await apiClient.get<{ studentId: string | null }>('/auth/me');
        const studentId = userResponse.data.studentId;

        if (!studentId) {
          setError('No student profile found for this user');
          setLoading(false);
          return;
        }

        // Fetch student progress
        const progressResponse = await apiClient.get(`/students/${studentId}/progress`);
        setProgress(progressResponse.data);

        // Fetch next unwatched lesson for each enrolled course
        const nextLessonsMap = new Map<string, NextLesson>();
        for (const course of progressResponse.data.courses) {
          if (course.enrollmentStatus === 'ACTIVE') {
            try {
              const courseProgressResponse = await apiClient.get(`/courses/${course.courseId}/progress`);
              const courseProgress = courseProgressResponse.data;
              
              // Find the first lesson that is not completed
              const nextLesson = courseProgress.lessons?.find(
                (lesson: any) => lesson.status !== 'COMPLETED'
              );
              
              if (nextLesson) {
                nextLessonsMap.set(course.courseId, {
                  courseId: course.courseId,
                  lessonId: nextLesson.lessonId,
                  lessonTitle: nextLesson.lessonTitle,
                  moduleTitle: nextLesson.moduleTitle,
                });
              }
            } catch (err) {
              console.error(`Failed to fetch next lesson for course ${course.courseId}:`, err);
            }
          }
        }
        setNextLessons(nextLessonsMap);

        // Fetch available quizzes (published quizzes in enrolled courses)
        try {
          const quizzesResponse = await quizzesApi.getAvailableQuizzes(studentId);
          
          // Filter quizzes to only those in enrolled courses
          const enrolledCourseIds = progressResponse.data.courses
            .filter((c: Course) => c.enrollmentStatus === 'ACTIVE')
            .map((c: Course) => c.courseId);
          
          // The API already limits students to their enrolled courses; owningCourseId also covers
          // quizzes attached to a module or a lesson
          const courseOf = (quiz: Quiz) => quiz.owningCourseId ?? quiz.courseId;
          const enrolledQuizzes = quizzesResponse.filter((quiz: Quiz) => {
            const courseId = courseOf(quiz);
            return !!courseId && enrolledCourseIds.includes(courseId);
          });

          // Fetch attempt history for each quiz
          const attemptsMap = new Map<string, QuizAttemptSummary[]>();
          const enrichedQuizzes: AvailableQuiz[] = [];
          
          for (const quiz of enrolledQuizzes) {
            try {
              const attempts = await quizzesApi.getQuizAttempts(quiz.id);
              attemptsMap.set(quiz.id, attempts);
              
              // Calculate best score and attempt count
              const bestAttempt = attempts.reduce((best, current) => {
                return current.score > (best?.score || 0) ? current : best;
              }, attempts[0]);

              const courseTitle = progressResponse.data.courses.find(
                (c: Course) => c.courseId === courseOf(quiz)
              )?.courseTitle || 'Unknown Course';

              enrichedQuizzes.push({
                ...quiz,
                courseTitle,
                attemptCount: attempts.length,
                bestScore: bestAttempt?.score,
                bestAttemptPassed: bestAttempt?.passed || false,
                lastAttemptDate: attempts[0]?.submittedAt,
              });
            } catch {
              // No attempts yet for this quiz
              const courseTitle = progressResponse.data.courses.find(
                (c: Course) => c.courseId === courseOf(quiz)
              )?.courseTitle || 'Unknown Course';

              enrichedQuizzes.push({
                ...quiz,
                courseTitle,
                attemptCount: 0,
                bestAttemptPassed: false,
              });
            }
          }
          
          setAvailableQuizzes(enrichedQuizzes);
          setQuizAttempts(attemptsMap);
        } catch (err) {
          console.error('Failed to fetch quizzes:', err);
        }
      } catch (err: any) {
        console.error('Error fetching student dashboard data:', err);
        setError(err.response?.data?.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleCourseClick = (courseId: string) => {
    router.push(`/student/courses/${courseId}`);
  };

  const handleContinueLearning = (courseId: string) => {
    const nextLesson = nextLessons.get(courseId);
    if (nextLesson) {
      router.push(`/student/courses/${courseId}/lessons/${nextLesson.lessonId}`);
    } else {
      router.push(`/student/courses/${courseId}`);
    }
  };

  const handleQuizClick = (quizId: string) => {
    router.push(`/student/quizzes/${quizId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-600 text-lg">{error}</p>
      </div>
    );
  }

  const activeCourses = progress?.courses.filter(c => c.enrollmentStatus === 'ACTIVE') || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {progress?.studentName || 'Student'}!
          </h1>
          <p className="text-gray-600">
            Continue your learning journey with your enrolled courses
          </p>
        </div>

        {/* Enrolled Courses */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">My Courses</h2>
          
          {activeCourses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-lg mb-2">No active courses</p>
                <p className="text-gray-500 text-sm">
                  Contact your administrator to enroll in courses
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeCourses.map((course) => {
                const nextLesson = nextLessons.get(course.courseId);
                return (
                  <Card
                    key={course.enrollmentId}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handleCourseClick(course.courseId)}
                  >
                    {/* Course Cover Image */}
                    {course.courseCoverImage ? (
                      <div className="relative w-full h-48">
                        <Image
                          src={course.courseCoverImage}
                          alt={course.courseTitle}
                          fill
                          className="object-cover rounded-t-lg"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-48 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <BookOpen className="h-16 w-16 text-white opacity-80" />
                      </div>
                    )}

                    <CardHeader>
                      <CardTitle className="text-xl line-clamp-2">
                        {course.courseTitle}
                      </CardTitle>
                      <CardDescription>
                        {course.completedLessons} of {course.totalLessons} lessons completed
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            Progress
                          </span>
                          <span className="text-sm font-semibold text-gray-900">
                            {course.progressPercentage}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${course.progressPercentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Next Lesson Preview */}
                      {nextLesson && (
                        <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <div className="flex items-start gap-2">
                            <PlayCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-blue-900 mb-1">
                                Up Next:
                              </p>
                              <p className="text-sm text-blue-800 line-clamp-2">
                                {nextLesson.lessonTitle}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Continue Button */}
                      <Button
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContinueLearning(course.courseId);
                        }}
                      >
                        {course.progressPercentage === 0 ? 'Start Course' : 'Continue Learning'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Available Quizzes */}
        {availableQuizzes.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Available Quizzes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableQuizzes.map((quiz) => {
                const attempts = quizAttempts.get(quiz.id) || [];
                const passedAttempts = attempts.filter(a => a.passed).length;
                
                return (
                  <Card
                    key={quiz.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handleQuizClick(quiz.id)}
                  >
                    <div className="w-full h-32 bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center relative">
                      <ClipboardCheck className="h-16 w-16 text-white opacity-80" />
                      {quiz.bestAttemptPassed && (
                        <div className="absolute top-3 right-3">
                          <Trophy className="h-6 w-6 text-yellow-300" />
                        </div>
                      )}
                    </div>

                    <CardHeader>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <CardTitle className="text-lg line-clamp-2 flex-1">
                          {quiz.title}
                        </CardTitle>
                        {quiz.bestAttemptPassed ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            Passed
                          </Badge>
                        ) : quiz.attemptCount > 0 ? (
                          <Badge variant="outline" className="border-orange-200 text-orange-800">
                            In Progress
                          </Badge>
                        ) : (
                          <Badge variant="outline">New</Badge>
                        )}
                      </div>
                      <CardDescription className="line-clamp-1">
                        {quiz.courseTitle}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {/* Quiz Stats */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Total Marks:</span>
                        <span className="font-semibold text-gray-900">{quiz.totalMarks}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Pass Mark:</span>
                        <span className="font-semibold text-gray-900">{quiz.passMark}</span>
                      </div>
                      {quiz.timeLimit && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Time Limit:</span>
                          <span className="font-semibold text-gray-900 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {quiz.timeLimit} min
                          </span>
                        </div>
                      )}

                      {/* Attempt Summary */}
                      {quiz.attemptCount > 0 && (
                        <div className="pt-3 border-t border-gray-200">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-600">Best Score:</span>
                            <span className="font-bold text-blue-600">
                              {quiz.bestScore}/{quiz.totalMarks}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Attempts:</span>
                            <span className="font-semibold text-gray-900">
                              {quiz.attemptCount}
                              {quiz.maxAttempts && ` / ${quiz.maxAttempts}`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Passed:</span>
                            <span className="font-semibold text-green-600">
                              {passedAttempts}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Action Button */}
                      <Button
                        className="w-full mt-4"
                        variant={quiz.bestAttemptPassed ? "outline" : "default"}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuizClick(quiz.id);
                        }}
                      >
                        {quiz.attemptCount === 0 ? 'Take Quiz' : quiz.bestAttemptPassed ? 'Review Quiz' : 'Retake Quiz'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed Courses Section */}
        {progress?.courses.some(c => c.enrollmentStatus === 'COMPLETED') && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Completed Courses</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {progress.courses
                .filter(c => c.enrollmentStatus === 'COMPLETED')
                .map((course) => (
                  <Card
                    key={course.enrollmentId}
                    className="hover:shadow-lg transition-shadow cursor-pointer opacity-75"
                    onClick={() => handleCourseClick(course.courseId)}
                  >
                    {course.courseCoverImage ? (
                      <div className="relative w-full h-48">
                        <Image
                          src={course.courseCoverImage}
                          alt={course.courseTitle}
                          fill
                          className="object-cover rounded-t-lg"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-48 bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
                        <BookOpen className="h-16 w-16 text-white opacity-80" />
                      </div>
                    )}

                    <CardHeader>
                      <CardTitle className="text-xl line-clamp-2">
                        {course.courseTitle}
                      </CardTitle>
                      <CardDescription className="text-green-600 font-medium">
                        Completed ✓
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      <Button variant="outline" className="w-full">
                        Review Course
                      </Button>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
