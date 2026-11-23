'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { CheckCircle2, Circle, PlayCircle, ArrowLeft, Loader2 } from 'lucide-react';

interface Lesson {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  displayOrder: number;
  duration: number | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  lastPosition: number;
  watchedDuration: number;
  completedAt: string | null;
}

interface Module {
  id: string;
  title: string;
  description?: string;
  displayOrder: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  status: string;
}

interface CourseProgress {
  courseId: string;
  courseTitle: string;
  enrollmentStatus: 'ACTIVE' | 'COMPLETED' | 'DROPPED';
  progressPercentage: number;
  lessons: Lesson[];
}

export default function StudentCoursePage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.courseId as string;
  
  const [course, setCourse] = useState<Course | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    
    const fetchCourseData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch course details
        const courseResponse = await apiClient.get(`/courses/${courseId}`);
        setCourse(courseResponse.data);

        // Fetch course progress
        const progressResponse = await apiClient.get(`/courses/${courseId}/progress`);
        setProgress(progressResponse.data);

        // Organize lessons by module
        const lessonsByModule = new Map<string, Lesson[]>();
        progressResponse.data.lessons.forEach((lesson: Lesson) => {
          if (!lessonsByModule.has(lesson.moduleTitle)) {
            lessonsByModule.set(lesson.moduleTitle, []);
          }
          lessonsByModule.get(lesson.moduleTitle)!.push(lesson);
        });

        // Create module structure
        const moduleList: Module[] = [];
        let moduleOrder = 0;
        lessonsByModule.forEach((lessons, moduleTitle) => {
          // Sort lessons by display order
          lessons.sort((a, b) => a.displayOrder - b.displayOrder);
          
          moduleList.push({
            id: `module-${moduleOrder}`,
            title: moduleTitle,
            displayOrder: moduleOrder,
            lessons: lessons,
          });
          moduleOrder++;
        });

        // Sort modules (assuming first lesson's order indicates module order)
        moduleList.sort((a, b) => {
          const aFirstLesson = a.lessons[0]?.displayOrder || 0;
          const bFirstLesson = b.lessons[0]?.displayOrder || 0;
          return aFirstLesson - bFirstLesson;
        });

        setModules(moduleList);
      } catch (err: any) {
        console.error('Error fetching course data:', err);
        setError(err.response?.data?.message || 'Failed to load course data');
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [courseId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'IN_PROGRESS':
        return <PlayCircle className="h-5 w-5 text-brand" />;
      case 'NOT_STARTED':
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'Completed';
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'NOT_STARTED':
      default:
        return 'Not Started';
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Duration not set';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes < 60) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleLessonClick = (lessonId: string) => {
    router.push(`/student/courses/${courseId}/lessons/${lessonId}`);
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
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  if (!course || !progress) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-600 text-lg">Course not found</p>
        <Button onClick={() => router.push('/student/dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto p-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.push('/student/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Course Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-6">
              {/* Cover Image */}
              {course.coverImage && (
                <div className="relative w-full md:w-48 h-48 rounded-lg overflow-hidden flex-shrink-0">
                  <Image
                    src={course.coverImage}
                    alt={course.title}
                    fill
                    sizes="(min-width: 768px) 12rem, 100vw"
                    className="object-cover"
                  />
                </div>
              )}
              
              {/* Course Info */}
              <div className="flex-1">
                <CardTitle className="text-3xl mb-2">{course.title}</CardTitle>
                {course.description && (
                  <CardDescription className="text-base mb-4">
                    {course.description}
                  </CardDescription>
                )}
                
                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Course Progress
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {progress.progressPercentage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-brand h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress.progressPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Course Content - Modules and Lessons */}
        <div className="space-y-6">
          {modules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No published lessons available in this course yet.
              </CardContent>
            </Card>
          ) : (
            modules.map((module, moduleIndex) => (
              <Card key={module.id}>
                <CardHeader className="bg-gray-50 border-b">
                  <CardTitle className="text-xl">
                    Module {moduleIndex + 1}: {module.title}
                  </CardTitle>
                  {module.description && (
                    <CardDescription>{module.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {module.lessons.map((lesson, lessonIndex) => (
                      <div
                        key={lesson.lessonId}
                        className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleLessonClick(lesson.lessonId)}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                          {/* Status Icon */}
                          <div className="flex-shrink-0">
                            {getStatusIcon(lesson.status)}
                          </div>
                          
                          {/* Lesson Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">
                              Lesson {lessonIndex + 1}: {lesson.lessonTitle}
                            </h4>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-sm text-gray-500">
                                {formatDuration(lesson.duration)}
                              </span>
                              <span
                                className={`text-sm font-medium ${
                                  lesson.status === 'COMPLETED'
                                    ? 'text-green-600'
                                    : lesson.status === 'IN_PROGRESS'
                                    ? 'text-brand'
                                    : 'text-gray-500'
                                }`}
                              >
                                {getStatusText(lesson.status)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <Button
                          variant={lesson.status === 'NOT_STARTED' ? 'default' : 'outline'}
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLessonClick(lesson.lessonId);
                          }}
                        >
                          {lesson.status === 'COMPLETED' ? 'Review' : 
                           lesson.status === 'IN_PROGRESS' ? 'Continue' : 'Start'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
