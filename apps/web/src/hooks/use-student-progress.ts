'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

export interface StudentCourse {
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

export interface StudentProgress {
  studentId: string;
  studentName: string;
  courses: StudentCourse[];
}

const STUDENT_ID_KEY = 'studentId';

/**
 * The signed-in user's student profile id. Looked up once with GET /auth/me, then kept for the
 * browser session (keyed by user, so another sign-in looks it up again). Null when the user has no
 * student profile.
 */
export async function getMyStudentId(): Promise<string | null> {
  const userId = getStoredUser()?.id;
  const cached = typeof window !== 'undefined' ? sessionStorage.getItem(STUDENT_ID_KEY) : null;
  if (userId && cached?.startsWith(`${userId}:`)) return cached.slice(userId.length + 1);
  const { data: me } = await apiClient.get<{ id?: string; studentId: string | null }>('/auth/me');
  const owner = me.id ?? userId;
  if (me.studentId && owner && typeof window !== 'undefined') sessionStorage.setItem(STUDENT_ID_KEY, `${owner}:${me.studentId}`);
  return me.studentId;
}

/** The signed-in student's enrolments and progress (GET /students/:id/progress). */
export function useStudentProgress() {
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const studentId = await getMyStudentId();
      if (!studentId) {
        setError('No student profile found for this user');
        return;
      }
      const { data } = await apiClient.get<StudentProgress>(`/students/${studentId}/progress`);
      setProgress(data);
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'Failed to load your courses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { progress, loading, error, reload: load };
}

/** Most recently opened unfinished course: the "continue learning" pick. */
export function continueCourse(courses: StudentCourse[]): StudentCourse | undefined {
  const open = courses.filter((c) => c.enrollmentStatus === 'ACTIVE' && c.progressPercentage < 100);
  return [...open].sort((a, b) => {
    const ta = a.lastAccessedAt ? Date.parse(a.lastAccessedAt) : 0;
    const tb = b.lastAccessedAt ? Date.parse(b.lastAccessedAt) : 0;
    return tb - ta || b.progressPercentage - a.progressPercentage;
  })[0];
}

/** "Good morning / afternoon / evening" for the hour of the day. */
export function greeting(date = new Date()): string {
  const h = date.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export type CourseFilter = 'all' | 'progress' | 'completed';

const isCompleted = (c: StudentCourse) => c.enrollmentStatus === 'COMPLETED' || c.progressPercentage >= 100;

/** My Courses tabs and search: dropped enrolments are never listed. */
export function filterCourses(courses: StudentCourse[], filter: CourseFilter, query: string): StudentCourse[] {
  const q = query.trim().toLowerCase();
  return courses
    .filter((c) => c.enrollmentStatus !== 'DROPPED')
    .filter((c) => (filter === 'all' ? true : filter === 'completed' ? isCompleted(c) : !isCompleted(c)))
    .filter((c) => !q || c.courseTitle.toLowerCase().includes(q));
}
