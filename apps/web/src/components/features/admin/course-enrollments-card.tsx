'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StudentPicker } from '@/components/features/admin/student-picker';
import { useToast } from '@/hooks/use-toast';
import { courseEnrollmentsApi, type CourseEnrollmentRow } from '@/lib/admin-api';
import { getApiErrorMessage } from '@/lib/lab-validation';

interface Props {
  courseId: string;
  published: boolean;
}

/** Enrol students in a course and see their progress (R5). */
export function CourseEnrollmentsCard({ courseId, published }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<CourseEnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Dropped enrolments keep their history but aren't shown; adding the student again reactivates it (R5.5)
      setRows((await courseEnrollmentsApi.list(courseId)).filter((r) => r.status !== 'DROPPED'));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not load enrolments', description: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [courseId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const enrolledIds = useMemo(() => new Set(rows.map((r) => r.studentId)), [rows]);

  const enroll = async (studentId: string) => {
    try {
      await courseEnrollmentsApi.enroll(courseId, studentId);
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Not enrolled', description: getApiErrorMessage(err) });
    }
  };

  const remove = async (row: CourseEnrollmentRow) => {
    setRemoving(row.id);
    try {
      await courseEnrollmentsApi.remove(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Not removed', description: getApiErrorMessage(err) });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Card className="mt-6 p-6">
      <h2 className="text-xl font-semibold">Enrolled students</h2>
      <p className="mb-4 text-sm text-gray-600">
        Enrolled students see every published lesson in this course. Removing a student keeps their progress.
      </p>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : rows.length === 0 ? (
        <p className="mb-4 text-sm text-gray-500">No students enrolled yet.</p>
      ) : (
        <ul className="mb-6 divide-y rounded-lg border">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <span className="min-w-0">
                <span className="block font-medium text-gray-900">
                  {row.student.firstName} {row.student.lastName}
                </span>
                <span className="block text-xs text-gray-500">
                  {row.student.admissionId} · {row.status.charAt(0) + row.status.slice(1).toLowerCase()} · {row.progressPercentage}% complete
                </span>
              </span>
              {row.status === 'ACTIVE' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={removing === row.id}
                  onClick={() => remove(row)}
                >
                  {removing === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {published ? (
        <StudentPicker excludeIds={enrolledIds} onPick={(id) => enroll(id)} label="Enrol students" />
      ) : (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Publish the course before enrolling students.</p>
      )}
    </Card>
  );
}
