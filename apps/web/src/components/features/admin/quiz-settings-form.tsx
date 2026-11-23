'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { coursesApi, type Course, type CourseWithModules } from '@/lib/api';
import type { QuizPayload } from '@/lib/admin-api';

export interface QuizSettings {
  title: string;
  description: string;
  attachmentType: 'COURSE' | 'MODULE' | 'LESSON';
  courseId: string;
  moduleId: string;
  lessonId: string;
  passMark: string;
  totalMarks: string;
  timeLimit: string;
  maxAttempts: string;
}

export const emptyQuizSettings: QuizSettings = {
  title: '',
  description: '',
  attachmentType: 'COURSE',
  courseId: '',
  moduleId: '',
  lessonId: '',
  passMark: '',
  totalMarks: '',
  timeLimit: '',
  maxAttempts: '',
};

const int = (v: string) => (v.trim() === '' ? undefined : Number(v));

/** Validates settings (R23.1–R23.5) and builds the API payload. */
export function toQuizPayload(s: QuizSettings): { payload?: QuizPayload; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!s.title.trim()) errors.title = 'Required';
  const total = int(s.totalMarks);
  const pass = int(s.passMark);
  if (!total || !Number.isInteger(total) || total < 1) errors.totalMarks = 'Whole number, at least 1';
  if (pass === undefined || !Number.isInteger(pass) || pass < 0) errors.passMark = 'Whole number, 0 or more';
  else if (total && pass > total) errors.passMark = 'Cannot exceed total marks';
  const time = int(s.timeLimit);
  if (time !== undefined && (!Number.isInteger(time) || time < 1)) errors.timeLimit = 'Whole minutes, at least 1';
  const attempts = int(s.maxAttempts);
  if (attempts !== undefined && (!Number.isInteger(attempts) || attempts < 1)) errors.maxAttempts = 'At least 1';
  if (!s.courseId) errors.courseId = 'Choose a course';
  if (s.attachmentType !== 'COURSE' && !s.moduleId) errors.moduleId = 'Choose a module';
  if (s.attachmentType === 'LESSON' && !s.lessonId) errors.lessonId = 'Choose a lesson';
  if (Object.keys(errors).length) return { errors };

  return {
    errors,
    payload: {
      title: s.title.trim(),
      ...(s.description.trim() ? { description: s.description.trim() } : {}),
      attachmentType: s.attachmentType,
      ...(s.attachmentType === 'COURSE' ? { courseId: s.courseId } : {}),
      ...(s.attachmentType === 'MODULE' ? { moduleId: s.moduleId } : {}),
      ...(s.attachmentType === 'LESSON' ? { lessonId: s.lessonId } : {}),
      passMark: pass!,
      totalMarks: total!,
      ...(time !== undefined ? { timeLimit: time } : {}),
      ...(attempts !== undefined ? { maxAttempts: attempts } : {}),
    },
  };
}

interface Props {
  value: QuizSettings;
  onChange: (next: QuizSettings) => void;
  errors: Record<string, string>;
  disabled?: boolean;
}

/** Quiz settings fields, including what the quiz is attached to (course, module or lesson). */
export function QuizSettingsForm({ value, onChange, errors, disabled }: Props) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [course, setCourse] = useState<CourseWithModules | null>(null);

  useEffect(() => {
    coursesApi.getAllCourses().then(setCourses).catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    if (!value.courseId) {
      setCourse(null);
      return;
    }
    let cancelled = false;
    coursesApi
      .getCourseWithModules(value.courseId)
      .then((c) => !cancelled && setCourse(c))
      .catch(() => !cancelled && setCourse(null));
    return () => {
      cancelled = true;
    };
  }, [value.courseId]);

  const lessons = useMemo(
    () => course?.modules.find((m) => m.id === value.moduleId)?.lessons ?? [],
    [course, value.moduleId],
  );

  const set = (patch: Partial<QuizSettings>) => onChange({ ...value, ...patch });

  const text = (key: keyof QuizSettings, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`quiz-${key}`}>{label}</Label>
      <Input
        id={`quiz-${key}`}
        value={value[key]}
        onChange={(e) => set({ [key]: e.target.value } as Partial<QuizSettings>)}
        aria-invalid={!!errors[key]}
        disabled={disabled}
        {...props}
      />
      {errors[key] && <p className="text-sm text-red-600">{errors[key]}</p>}
    </div>
  );

  const select = (
    key: 'courseId' | 'moduleId' | 'lessonId',
    label: string,
    options: Array<{ id: string; title: string }>,
    onPick: (id: string) => void,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`quiz-${key}`}>{label}</Label>
      <Select value={value[key]} onValueChange={onPick} disabled={disabled || options.length === 0}>
        <SelectTrigger id={`quiz-${key}`} aria-label={label}>
          <SelectValue placeholder={options.length ? `Select…` : 'None available'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {errors[key] && <p className="text-sm text-red-600">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      {text('title', 'Title')}
      {text('description', 'Description (optional)')}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="quiz-attachmentType">Attach to</Label>
          <Select
            value={value.attachmentType}
            onValueChange={(v) => set({ attachmentType: v as QuizSettings['attachmentType'], moduleId: '', lessonId: '' })}
            disabled={disabled}
          >
            <SelectTrigger id="quiz-attachmentType" aria-label="Attach to">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="COURSE">Whole course</SelectItem>
              <SelectItem value="MODULE">A module</SelectItem>
              <SelectItem value="LESSON">A lesson</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {select('courseId', 'Course', courses.map((c) => ({ id: c.id, title: c.title })), (id) =>
          set({ courseId: id, moduleId: '', lessonId: '' }),
        )}
        {value.attachmentType !== 'COURSE' &&
          select('moduleId', 'Module', course?.modules.map((m) => ({ id: m.id, title: m.title })) ?? [], (id) =>
            set({ moduleId: id, lessonId: '' }),
          )}
        {value.attachmentType === 'LESSON' &&
          select('lessonId', 'Lesson', lessons.map((l) => ({ id: l.id, title: l.title })), (id) => set({ lessonId: id }))}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {text('totalMarks', 'Total marks', { type: 'number', min: 1, inputMode: 'numeric' })}
        {text('passMark', 'Pass mark', { type: 'number', min: 0, inputMode: 'numeric' })}
        {text('timeLimit', 'Time limit (min)', { type: 'number', min: 1, inputMode: 'numeric', placeholder: 'None' })}
        {text('maxAttempts', 'Max attempts', { type: 'number', min: 1, inputMode: 'numeric', placeholder: 'Unlimited' })}
      </div>
    </div>
  );
}
