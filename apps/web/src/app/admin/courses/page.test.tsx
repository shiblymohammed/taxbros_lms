import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import CoursesPage from './page';
import { coursesApi, type Course } from '@/lib/api';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  coursesApi: {
    getAllCourses: vi.fn(),
    createCourse: vi.fn(),
    publishCourse: vi.fn(),
    unpublishCourse: vi.fn(),
  },
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('CoursesPage', () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    } as any);
  });

  it('should render loading state initially', () => {
    vi.mocked(coursesApi.getAllCourses).mockReturnValue(
      new Promise(() => {}) // Never resolves
    );

    render(<CoursesPage />);
    expect(screen.getByText('Loading courses...')).toBeDefined();
  });

  it('should display courses when loaded', async () => {
    const mockCourses: Course[] = [
      {
        id: '1',
        title: 'Introduction to JavaScript',
        description: 'Learn the basics of JavaScript',
        coverImage: null,
        status: 'DRAFT',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: '2',
        title: 'Advanced React',
        description: 'Master React patterns',
        coverImage: null,
        status: 'PUBLISHED',
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      },
    ];

    vi.mocked(coursesApi.getAllCourses).mockResolvedValue(mockCourses);

    render(<CoursesPage />);

    await waitFor(() => {
      expect(screen.getByText('Introduction to JavaScript')).toBeDefined();
      expect(screen.getByText('Advanced React')).toBeDefined();
    });
  });

  it('should display status badges correctly', async () => {
    const mockCourses: Course[] = [
      {
        id: '1',
        title: 'Draft Course',
        description: '',
        coverImage: null,
        status: 'DRAFT',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: '2',
        title: 'Published Course',
        description: '',
        coverImage: null,
        status: 'PUBLISHED',
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      },
    ];

    vi.mocked(coursesApi.getAllCourses).mockResolvedValue(mockCourses);

    render(<CoursesPage />);

    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeDefined();
      expect(screen.getByText('Published')).toBeDefined();
    });
  });

  it('should show empty state when no courses exist', async () => {
    vi.mocked(coursesApi.getAllCourses).mockResolvedValue([]);

    render(<CoursesPage />);

    await waitFor(() => {
      expect(screen.getByText('No courses yet')).toBeDefined();
      expect(screen.getByText('Create Your First Course')).toBeDefined();
    });
  });

  it('should display error message on API failure', async () => {
    vi.mocked(coursesApi.getAllCourses).mockRejectedValue(
      new Error('Network error')
    );

    render(<CoursesPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load courses')).toBeDefined();
    });
  });
});
