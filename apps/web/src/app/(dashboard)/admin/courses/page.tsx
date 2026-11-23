'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { coursesApi, Course } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

export default function CoursesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
  });

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await coursesApi.getAllCourses();
      setCourses(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch courses:', err);
      setError(err.response?.data?.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleCreateCourse = async () => {
    if (!newCourse.title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Course title is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreating(true);
      const created = await coursesApi.createCourse({
        title: newCourse.title,
        description: newCourse.description || undefined,
      });
      
      toast({
        title: 'Success',
        description: 'Course created successfully',
      });
      
      setIsCreateModalOpen(false);
      setNewCourse({ title: '', description: '' });
      
      // Navigate to the editor page
      router.push(`/admin/courses/${created.id}`);
    } catch (err: any) {
      console.error('Failed to create course:', err);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to create course',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleTogglePublish = async (course: Course) => {
    try {
      if (course.status === 'PUBLISHED') {
        await coursesApi.unpublishCourse(course.id);
        toast({
          title: 'Success',
          description: 'Course unpublished',
        });
      } else {
        await coursesApi.publishCourse(course.id);
        toast({
          title: 'Success',
          description: 'Course published',
        });
      }
      fetchCourses();
    } catch (err: any) {
      console.error('Failed to toggle publish:', err);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to update course status',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Published</Badge>;
      case 'DRAFT':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Draft</Badge>;
      case 'ARCHIVED':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Archived</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading courses...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error}</p>
          <Button onClick={fetchCourses} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Course Management</h1>
            <p className="text-gray-600 mt-2">Create and manage courses, modules, and lessons</p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
            + New Course
          </Button>
        </div>

        {/* Courses Grid */}
        {courses.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">No courses yet</p>
            <Button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              Create Your First Course
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {/* Cover Image */}
                <div className="h-48 bg-gradient-to-br from-blue-500 to-purple-600 relative">
                  {course.coverImage && (
                    <Image
                      src={course.coverImage}
                      alt={course.title}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover"
                    />
                  )}
                  <div className="absolute top-4 right-4">
                    {getStatusBadge(course.status)}
                  </div>
                </div>

                {/* Course Info */}
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{course.title}</h3>
                  {course.description && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{course.description}</p>
                  )}
                  
                  <div className="text-xs text-gray-500 mb-4">
                    Created: {new Date(course.createdAt).toLocaleDateString()}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => router.push(`/admin/courses/${course.id}`)}
                      className="flex-1 bg-gray-900 hover:bg-gray-800"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleTogglePublish(course)}
                      variant="outline"
                      className="flex-1"
                    >
                      {course.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create Course Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={(open) => !isCreating && setIsCreateModalOpen(open)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create new course</DialogTitle>
              <DialogDescription>New courses start as drafts; students see them once published.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Course title *</Label>
                <Input
                  id="title"
                  value={newCourse.title}
                  onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                  placeholder="Enter course title"
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  placeholder="Enter course description"
                  rows={4}
                  disabled={isCreating}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button onClick={() => setIsCreateModalOpen(false)} variant="outline" disabled={isCreating}>
                Cancel
              </Button>
              <Button onClick={handleCreateCourse} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create course'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
