'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CourseEnrollmentsCard } from '@/components/admin/course-enrollments-card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { coursesApi, modulesApi, lessonsApi, CourseWithModules, Module, Lesson } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

export default function CourseEditorPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const courseId = params.id as string;

  const [course, setCourse] = useState<CourseWithModules | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Edit states
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);

  // Module/Lesson modals
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [isAddLessonOpen, setIsAddLessonOpen] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  // Form states
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' });
  const [lessonForm, setLessonForm] = useState({ title: '', description: '', videoUrl: '', duration: '' });

  const fetchCourse = useCallback(async () => {
    try {
      setLoading(true);
      const data = await coursesApi.getCourseWithModules(courseId);
      setCourse(data);
      setEditedTitle(data.title);
      setEditedDescription(data.description || '');
      setCoverImagePreview(data.coverImage || null);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch course:', err);
      setError(err.response?.data?.message || 'Failed to load course');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) {
      fetchCourse();
    }
  }, [courseId, fetchCourse]);

  const handleSaveCourse = async () => {
    if (!editedTitle.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Course title is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);

      // Upload cover image if changed
      let coverImageUrl = course?.coverImage;
      if (coverImageFile) {
        // The API stores the image and sets it on the course
        const uploadResult = await coursesApi.uploadCoverImage(courseId, coverImageFile);
        coverImageUrl = uploadResult.coverImage;
      }

      await coursesApi.updateCourse(courseId, {
        title: editedTitle,
        description: editedDescription || undefined,
        coverImage: coverImageUrl ?? undefined,
      });

      toast({
        title: 'Success',
        description: 'Course updated successfully',
      });

      fetchCourse();
    } catch (err: any) {
      console.error('Failed to update course:', err);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to update course',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: 'Error',
          description: 'Image size must be less than 2MB',
          variant: 'destructive',
        });
        return;
      }
      setCoverImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTogglePublish = async () => {
    if (!course) return;
    
    try {
      if (course.status === 'PUBLISHED') {
        await coursesApi.unpublishCourse(courseId);
        toast({ title: 'Success', description: 'Course unpublished' });
      } else {
        await coursesApi.publishCourse(courseId);
        toast({ title: 'Success', description: 'Course published' });
      }
      fetchCourse();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const handleAddModule = async () => {
    if (!moduleForm.title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Module title is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const displayOrder = course?.modules?.length || 0;
      await modulesApi.createModule(courseId, {
        title: moduleForm.title,
        description: moduleForm.description || undefined,
        displayOrder,
      });

      toast({ title: 'Success', description: 'Module added' });
      setIsAddModuleOpen(false);
      setModuleForm({ title: '', description: '' });
      fetchCourse();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to add module',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateModule = async () => {
    if (!editingModule) return;
    if (!moduleForm.title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Module title is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await modulesApi.updateModule(editingModule.id, {
        title: moduleForm.title,
        description: moduleForm.description || undefined,
      });

      toast({ title: 'Success', description: 'Module updated' });
      setEditingModule(null);
      setModuleForm({ title: '', description: '' });
      fetchCourse();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to update module',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Are you sure you want to delete this module? All lessons will be deleted.')) {
      return;
    }

    try {
      await modulesApi.deleteModule(moduleId);
      toast({ title: 'Success', description: 'Module deleted' });
      fetchCourse();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to delete module',
        variant: 'destructive',
      });
    }
  };

  const handleAddLesson = async () => {
    if (!selectedModuleId) return;
    if (!lessonForm.title.trim() || !lessonForm.videoUrl.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Lesson title and video URL are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const targetModule = course?.modules.find(m => m.id === selectedModuleId);
      const displayOrder = targetModule?.lessons?.length || 0;

      await lessonsApi.createLesson(selectedModuleId, {
        title: lessonForm.title,
        description: lessonForm.description || undefined,
        videoUrl: lessonForm.videoUrl,
        duration: lessonForm.duration ? parseInt(lessonForm.duration) : undefined,
        displayOrder,
      });

      toast({ title: 'Success', description: 'Lesson added' });
      setIsAddLessonOpen(false);
      setSelectedModuleId(null);
      setLessonForm({ title: '', description: '', videoUrl: '', duration: '' });
      fetchCourse();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to add lesson',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateLesson = async () => {
    if (!editingLesson) return;
    if (!lessonForm.title.trim() || !lessonForm.videoUrl.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Lesson title and video URL are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await lessonsApi.updateLesson(editingLesson.id, {
        title: lessonForm.title,
        description: lessonForm.description || undefined,
        videoUrl: lessonForm.videoUrl,
        duration: lessonForm.duration ? parseInt(lessonForm.duration) : undefined,
      });

      toast({ title: 'Success', description: 'Lesson updated' });
      setEditingLesson(null);
      setLessonForm({ title: '', description: '', videoUrl: '', duration: '' });
      fetchCourse();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to update lesson',
        variant: 'destructive',
      });
    }
  };

  const handleToggleLessonPublish = async (lesson: Lesson) => {
    try {
      if (lesson.status === 'PUBLISHED') {
        await lessonsApi.unpublishLesson(lesson.id);
        toast({ title: 'Success', description: 'Lesson unpublished' });
      } else {
        await lessonsApi.publishLesson(lesson.id);
        toast({ title: 'Success', description: 'Lesson published' });
      }
      fetchCourse();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to update lesson status',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm('Are you sure you want to delete this lesson?')) {
      return;
    }

    try {
      await lessonsApi.deleteLesson(lessonId);
      toast({ title: 'Success', description: 'Lesson deleted' });
      fetchCourse();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to delete lesson',
        variant: 'destructive',
      });
    }
  };

  const openEditModule = (module: Module) => {
    setEditingModule(module);
    setModuleForm({
      title: module.title,
      description: module.description || '',
    });
  };

  const openEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setLessonForm({
      title: lesson.title,
      description: lesson.description || '',
      videoUrl: lesson.videoUrl,
      duration: lesson.duration?.toString() || '',
    });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading course...</p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error || 'Course not found'}</p>
          <Button onClick={() => router.push('/admin/courses')} className="mt-4">
            Back to Courses
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-start">
          <div>
            <Button
              onClick={() => router.push('/admin/courses')}
              variant="outline"
              className="mb-4"
            >
              ← Back to Courses
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">Course Editor</h1>
          </div>
          <div className="flex gap-2">
            <Badge className={course.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
              {course.status}
            </Badge>
          </div>
        </div>

        {/* Course Details Card */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Course Details</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cover Image */}
            <div>
              <Label>Cover Image</Label>
              <div className="mt-2">
                {coverImagePreview ? (
                  <div className="relative h-48 w-full">
                    {/* Preview may be a local blob: URL, so skip the optimiser */}
                    <Image
                      src={coverImagePreview}
                      alt="Cover"
                      fill
                      unoptimized
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="object-cover rounded-lg"
                    />
                    <Button
                      onClick={() => {
                        setCoverImageFile(null);
                        setCoverImagePreview(course.coverImage || null);
                      }}
                      variant="outline"
                      className="mt-2 w-full"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                    <span className="text-gray-500">No image</span>
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageChange}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">Max 2MB, will resize to 1200px width</p>
              </div>
            </div>

            {/* Course Info */}
            <div className="lg:col-span-2">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    placeholder="Course title"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    placeholder="Course description"
                    rows={4}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveCourse}
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    onClick={handleTogglePublish}
                    variant="outline"
                  >
                    {course.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Modules Section */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Modules & Lessons</h2>
            <Button
              onClick={() => setIsAddModuleOpen(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              + Add Module
            </Button>
          </div>

          {course.modules && course.modules.length > 0 ? (
            <div className="space-y-4">
              {course.modules
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((module, moduleIndex) => (
                  <Card key={module.id} className="p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {moduleIndex + 1}. {module.title}
                        </h3>
                        {module.description && (
                          <p className="text-gray-600 text-sm mt-1">{module.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => openEditModule(module)}
                          variant="outline"
                          className="text-sm"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => {
                            setSelectedModuleId(module.id);
                            setIsAddLessonOpen(true);
                          }}
                          className="text-sm bg-blue-600 hover:bg-blue-700"
                        >
                          + Lesson
                        </Button>
                        <Button
                          onClick={() => handleDeleteModule(module.id)}
                          variant="outline"
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    {/* Lessons */}
                    {module.lessons && module.lessons.length > 0 ? (
                      <div className="space-y-2 mt-3 pl-4">
                        {module.lessons
                          .sort((a, b) => a.displayOrder - b.displayOrder)
                          .map((lesson, lessonIndex) => (
                            <div
                              key={lesson.id}
                              className="flex justify-between items-center p-3 bg-white rounded border border-gray-200"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900">
                                    {moduleIndex + 1}.{lessonIndex + 1} {lesson.title}
                                  </span>
                                  <Badge
                                    className={
                                      lesson.status === 'PUBLISHED'
                                        ? 'bg-green-100 text-green-800 text-xs'
                                        : 'bg-gray-100 text-gray-800 text-xs'
                                    }
                                  >
                                    {lesson.status}
                                  </Badge>
                                </div>
                                {lesson.description && (
                                  <p className="text-gray-600 text-xs mt-1">{lesson.description}</p>
                                )}
                                <p className="text-gray-500 text-xs mt-1">
                                  Video: {lesson.videoUrl}
                                  {lesson.duration && ` • ${Math.floor(lesson.duration / 60)}m ${lesson.duration % 60}s`}
                                </p>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <Button
                                  onClick={() => openEditLesson(lesson)}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  Edit
                                </Button>
                                <Button
                                  onClick={() => handleToggleLessonPublish(lesson)}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {lesson.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                                </Button>
                                <Button
                                  onClick={() => handleDeleteLesson(lesson.id)}
                                  variant="outline"
                                  className="text-xs text-red-600 hover:text-red-700"
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm pl-4 mt-2">No lessons yet</p>
                    )}
                  </Card>
                ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No modules yet. Add your first module to get started.
            </p>
          )}
        </Card>

        <CourseEnrollmentsCard courseId={courseId} published={course.status === 'PUBLISHED'} />

        {/* Add Module Modal */}
        {isAddModuleOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Add Module</h2>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="module-title">Module Title *</Label>
                  <Input
                    id="module-title"
                    value={moduleForm.title}
                    onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                    placeholder="Enter module title"
                  />
                </div>

                <div>
                  <Label htmlFor="module-description">Description</Label>
                  <Textarea
                    id="module-description"
                    value={moduleForm.description}
                    onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                    placeholder="Enter module description"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => {
                    setIsAddModuleOpen(false);
                    setModuleForm({ title: '', description: '' });
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddModule}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Add Module
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Module Modal */}
        {editingModule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit Module</h2>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-module-title">Module Title *</Label>
                  <Input
                    id="edit-module-title"
                    value={moduleForm.title}
                    onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                    placeholder="Enter module title"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-module-description">Description</Label>
                  <Textarea
                    id="edit-module-description"
                    value={moduleForm.description}
                    onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                    placeholder="Enter module description"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => {
                    setEditingModule(null);
                    setModuleForm({ title: '', description: '' });
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateModule}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Update Module
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Add Lesson Modal */}
        {isAddLessonOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Add Lesson</h2>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="lesson-title">Lesson Title *</Label>
                  <Input
                    id="lesson-title"
                    value={lessonForm.title}
                    onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                    placeholder="Enter lesson title"
                  />
                </div>

                <div>
                  <Label htmlFor="lesson-video">YouTube Video URL *</Label>
                  <Input
                    id="lesson-video"
                    value={lessonForm.videoUrl}
                    onChange={(e) => setLessonForm({ ...lessonForm, videoUrl: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </div>

                <div>
                  <Label htmlFor="lesson-duration">Duration (seconds)</Label>
                  <Input
                    id="lesson-duration"
                    type="number"
                    value={lessonForm.duration}
                    onChange={(e) => setLessonForm({ ...lessonForm, duration: e.target.value })}
                    placeholder="e.g., 600 for 10 minutes"
                  />
                </div>

                <div>
                  <Label htmlFor="lesson-description">Description</Label>
                  <Textarea
                    id="lesson-description"
                    value={lessonForm.description}
                    onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                    placeholder="Enter lesson description"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => {
                    setIsAddLessonOpen(false);
                    setSelectedModuleId(null);
                    setLessonForm({ title: '', description: '', videoUrl: '', duration: '' });
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddLesson}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Add Lesson
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Lesson Modal */}
        {editingLesson && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit Lesson</h2>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-lesson-title">Lesson Title *</Label>
                  <Input
                    id="edit-lesson-title"
                    value={lessonForm.title}
                    onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                    placeholder="Enter lesson title"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-lesson-video">YouTube Video URL *</Label>
                  <Input
                    id="edit-lesson-video"
                    value={lessonForm.videoUrl}
                    onChange={(e) => setLessonForm({ ...lessonForm, videoUrl: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </div>

                <div>
                  <Label htmlFor="edit-lesson-duration">Duration (seconds)</Label>
                  <Input
                    id="edit-lesson-duration"
                    type="number"
                    value={lessonForm.duration}
                    onChange={(e) => setLessonForm({ ...lessonForm, duration: e.target.value })}
                    placeholder="e.g., 600 for 10 minutes"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-lesson-description">Description</Label>
                  <Textarea
                    id="edit-lesson-description"
                    value={lessonForm.description}
                    onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                    placeholder="Enter lesson description"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => {
                    setEditingLesson(null);
                    setLessonForm({ title: '', description: '', videoUrl: '', duration: '' });
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateLesson}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Update Lesson
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
