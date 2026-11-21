import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient, coursesApi } from './api';

describe('coursesApi.uploadCoverImage (R15)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('posts the file to the course-specific upload route and returns the stored path', async () => {
    const post = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { message: 'ok', coverImage: '/uploads/2026/11/cover.webp' } });
    const file = new File(['x'], 'cover.png', { type: 'image/png' });

    const result = await coursesApi.uploadCoverImage('course-1', file);

    // Must match the API route POST /upload/course-cover/:courseId
    expect(post.mock.calls[0][0]).toBe('/upload/course-cover/course-1');
    expect((post.mock.calls[0][1] as FormData).get('file')).toBe(file);
    expect(result.coverImage).toBe('/uploads/2026/11/cover.webp');
  });
});
