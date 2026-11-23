import { describe, expect, it } from 'vitest';
import { continueCourse, filterCourses, greeting, type StudentCourse } from './use-student-progress';

const course = (over: Partial<StudentCourse>): StudentCourse => ({
  enrollmentId: 'e',
  courseId: 'c',
  courseTitle: 'Course',
  courseCoverImage: null,
  enrollmentStatus: 'ACTIVE',
  progressPercentage: 0,
  totalLessons: 4,
  completedLessons: 0,
  lastAccessedAt: null,
  enrolledAt: '2026-01-01',
  ...over,
});

describe('student course helpers', () => {
  const gst = course({ courseId: 'gst', courseTitle: 'GST Basics', progressPercentage: 40, lastAccessedAt: '2026-11-01' });
  const itr = course({ courseId: 'itr', courseTitle: 'Income Tax', progressPercentage: 70, lastAccessedAt: '2026-11-20' });
  const done = course({ courseId: 'mca', courseTitle: 'MCA', progressPercentage: 100, enrollmentStatus: 'COMPLETED' });
  const dropped = course({ courseId: 'old', enrollmentStatus: 'DROPPED' });

  it('continues the most recently opened unfinished course', () => {
    expect(continueCourse([gst, itr, done])?.courseId).toBe('itr');
    expect(continueCourse([done])).toBeUndefined();
  });

  it('filters by tab and search, never listing dropped courses', () => {
    const all = [gst, itr, done, dropped];
    expect(filterCourses(all, 'all', '').map((c) => c.courseId)).toEqual(['gst', 'itr', 'mca']);
    expect(filterCourses(all, 'progress', '').map((c) => c.courseId)).toEqual(['gst', 'itr']);
    expect(filterCourses(all, 'completed', '').map((c) => c.courseId)).toEqual(['mca']);
    expect(filterCourses(all, 'all', 'income').map((c) => c.courseId)).toEqual(['itr']);
  });

  it('greets by time of day', () => {
    expect(greeting(new Date(2026, 0, 1, 9))).toBe('Good morning');
    expect(greeting(new Date(2026, 0, 1, 14))).toBe('Good afternoon');
    expect(greeting(new Date(2026, 0, 1, 20))).toBe('Good evening');
  });
});
