'use client';

import { useEffect, useState, useRef, type SyntheticEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactPlayer from 'react-player';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface LessonData {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  duration: number | null;
  module: {
    id: string;
    title: string;
    course: {
      id: string;
      title: string;
    };
  };
}

interface ProgressData {
  id: string | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  lastPosition: number;
  watchedDuration: number;
  completedAt: string | null;
}

export default function LessonVideoPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.lessonId as string;
  const courseId = params.courseId as string;

  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [completing, setCompleting] = useState(false);

  // react-player v3 exposes the underlying media element (HTMLVideoElement API)
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const resumedRef = useRef(false);
  const lastUpdateRef = useRef<number>(0);

  // Load lesson and progress data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Fetch lesson details
        const lessonResponse = await apiClient.get(`/lessons/${lessonId}`);
        setLesson(lessonResponse.data);

        // Fetch progress
        const progressResponse = await apiClient.get(`/lessons/${lessonId}/progress`);
        setProgress(progressResponse.data);

        setError(null);
      } catch (err: any) {
        console.error('Error loading lesson:', err);
        setError(err.response?.data?.message || 'Failed to load lesson');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [lessonId]);

  // Resume from last position when progress is loaded
  const resumeFromLastPosition = () => {
    const player = playerRef.current;
    if (resumedRef.current || !player || !progress || progress.lastPosition <= 0) return;
    resumedRef.current = true;
    lastUpdateRef.current = progress.lastPosition;
    player.currentTime = progress.lastPosition;
  };

  // Send position updates every 10 seconds
  const updatePosition = async (currentTime: number) => {
    if (!progress || !lesson) return;

    try {
      const response = await apiClient.patch(`/lessons/${lessonId}/progress`, {
        position: currentTime,
      });

      // Update local progress state
      setProgress(response.data);

      // Check for auto-completion at 90%
      if (
        lesson.duration &&
        currentTime >= lesson.duration * 0.9 &&
        progress.status !== 'COMPLETED'
      ) {
        setProgress((prev) => (prev ? { ...prev, status: 'COMPLETED' } : prev));
      }
    } catch (err) {
      console.error('Error updating position:', err);
    }
  };

  // Handle progress updates during playback
  const handleTimeUpdate = (event: SyntheticEvent<HTMLVideoElement>) => {
    const currentTime = Math.floor(event.currentTarget.currentTime || 0);

    // Only update if 10 seconds have passed since last update
    if (currentTime - lastUpdateRef.current >= 10) {
      lastUpdateRef.current = currentTime;
      updatePosition(currentTime);
    }
  };

  // Handle manual completion
  const handleMarkComplete = async () => {
    try {
      setCompleting(true);
      const response = await apiClient.post(`/lessons/${lessonId}/complete`);
      setProgress(response.data);
    } catch (err: any) {
      console.error('Error marking complete:', err);
      setError(err.response?.data?.message || 'Failed to mark as complete');
    } finally {
      setCompleting(false);
    }
  };

  // Handle player ready
  const handleReady = () => {
    resumeFromLastPosition();
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !lesson || !progress) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error || 'Lesson not found'}</p>
            <Button
              onClick={() => router.push(`/student/courses/${courseId}`)}
              className="mt-4"
            >
              Back to Course
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCompleted = progress.status === 'COMPLETED';

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-gray-600">
        <Button
          variant="link"
          onClick={() => router.push('/student/dashboard')}
          className="p-0 h-auto"
        >
          Dashboard
        </Button>
        {' / '}
        <Button
          variant="link"
          onClick={() => router.push(`/student/courses/${courseId}`)}
          className="p-0 h-auto"
        >
          {lesson.module.course.title}
        </Button>
        {' / '}
        <span className="text-gray-900">{lesson.title}</span>
      </nav>

      {/* Video Player Card */}
      <Card className="mb-6">
        <CardContent className="p-0">
          <div className="aspect-video bg-black">
            <ReactPlayer
              ref={playerRef}
              src={lesson.videoUrl}
              width="100%"
              height="100%"
              controls
              playing={isPlaying}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
              onReady={handleReady}
              onLoadedMetadata={handleReady}
              config={{
                youtube: {
                  rel: 0,
                },
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lesson Info and Actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-2xl mb-2">{lesson.title}</CardTitle>
                  <CardDescription className="text-base">
                    Module: {lesson.module.title}
                  </CardDescription>
                </div>
                {isCompleted && (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Completed</span>
                  </div>
                )}
              </div>
            </CardHeader>
            {lesson.description && (
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{lesson.description}</p>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Actions Sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress Status */}
              <div>
                <p className="text-sm text-gray-600 mb-1">Status</p>
                <p className="font-medium">
                  {progress.status === 'NOT_STARTED' && 'Not Started'}
                  {progress.status === 'IN_PROGRESS' && 'In Progress'}
                  {progress.status === 'COMPLETED' && 'Completed'}
                </p>
              </div>

              {/* Duration Info */}
              {lesson.duration && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Duration</p>
                  <p className="font-medium">
                    {Math.floor(lesson.duration / 60)} minutes
                  </p>
                </div>
              )}

              {/* Watched Duration */}
              {progress.watchedDuration > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Watched</p>
                  <p className="font-medium">
                    {Math.floor(progress.watchedDuration / 60)} minutes
                  </p>
                </div>
              )}

              {/* Completion Date */}
              {progress.completedAt && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Completed On</p>
                  <p className="font-medium">
                    {new Date(progress.completedAt).toLocaleDateString()}
                  </p>
                </div>
              )}

              {/* Mark as Complete Button */}
              <Button
                onClick={handleMarkComplete}
                disabled={completing || isCompleted}
                className="w-full"
                variant={isCompleted ? 'secondary' : 'default'}
              >
                {completing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {isCompleted ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Completed
                  </>
                ) : (
                  'Mark as Complete'
                )}
              </Button>

              {/* Back to Course Button */}
              <Button
                onClick={() => router.push(`/student/courses/${courseId}`)}
                variant="outline"
                className="w-full"
              >
                Back to Course
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
