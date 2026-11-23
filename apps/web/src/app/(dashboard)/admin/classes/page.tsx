'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Archive, ArchiveRestore, Loader2, Pencil, Plus, UserMinus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StudentPicker } from '@/components/admin/student-picker';
import { useToast } from '@/hooks/use-toast';
import { classesAdminApi, type ClassDetail, type ClassSummary } from '@/lib/admin-api';
import { getApiErrorMessage } from '@/lib/lab-validation';

/** Class management and rosters (R4). Registers freeze the roster when first opened for a day. */
export default function ClassesPage() {
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const [editor, setEditor] = useState<{ cls: ClassSummary | null } | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [rosterId, setRosterId] = useState<string | null>(null);
  const [roster, setRoster] = useState<ClassDetail | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setClasses(await classesAdminApi.list());
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not load classes', description: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const loadRoster = useCallback(
    async (id: string) => {
      setRosterLoading(true);
      try {
        setRoster(await classesAdminApi.get(id));
      } catch (err) {
        toast({ variant: 'destructive', title: 'Could not load the roster', description: getApiErrorMessage(err) });
      } finally {
        setRosterLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (rosterId) loadRoster(rosterId);
    else setRoster(null);
  }, [rosterId, loadRoster]);

  const visible = classes.filter((c) => (showArchived ? c.status === 'ARCHIVED' : c.status === 'ACTIVE'));
  const archivedCount = classes.filter((c) => c.status === 'ARCHIVED').length;
  const enrolledIds = useMemo(() => new Set(roster?.enrollments.map((e) => e.student.id) ?? []), [roster]);

  const openEditor = (cls: ClassSummary | null) => {
    setEditor({ cls });
    setName(cls?.name ?? '');
    setDescription(cls?.description ?? '');
    setFormError(null);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setFormError('Enter a class name.');
    setSaving(true);
    setFormError(null);
    try {
      const payload = { name: name.trim(), description: description.trim() || undefined };
      if (editor?.cls) await classesAdminApi.update(editor.cls.id, payload);
      else await classesAdminApi.create(payload);
      setEditor(null);
      await load();
      toast({ title: editor?.cls ? 'Class updated' : 'Class created' });
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Could not save the class'));
    } finally {
      setSaving(false);
    }
  };

  const setArchived = async (cls: ClassSummary, archived: boolean) => {
    try {
      await classesAdminApi.update(cls.id, { status: archived ? 'ARCHIVED' : 'ACTIVE' });
      setClasses((prev) => prev.map((c) => (c.id === cls.id ? { ...c, status: archived ? 'ARCHIVED' : 'ACTIVE' } : c)));
      toast({ title: archived ? 'Class archived' : 'Class restored' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Not changed', description: getApiErrorMessage(err) });
    }
  };

  const addStudent = async (studentId: string) => {
    if (!rosterId) return;
    try {
      await classesAdminApi.enroll(rosterId, studentId);
      await loadRoster(rosterId);
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Not added', description: getApiErrorMessage(err) });
    }
  };

  const removeStudent = async (studentId: string) => {
    if (!rosterId) return;
    setRemoving(studentId);
    try {
      await classesAdminApi.remove(rosterId, studentId);
      await loadRoster(rosterId);
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Not removed', description: getApiErrorMessage(err) });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-xl font-bold sm:text-2xl">Classes</CardTitle>
            <CardDescription>Group students for attendance. Removing a student keeps their past attendance.</CardDescription>
          </div>
          <Button onClick={() => openEditor(null)} className="gap-2">
            <Plus className="h-4 w-4" /> New class
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2" role="tablist" aria-label="Class status">
            <Button role="tab" aria-selected={!showArchived} variant={showArchived ? 'outline' : 'default'} size="sm" onClick={() => setShowArchived(false)}>
              Active
            </Button>
            <Button role="tab" aria-selected={showArchived} variant={showArchived ? 'default' : 'outline'} size="sm" onClick={() => setShowArchived(true)}>
              Archived ({archivedCount})
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="py-12 text-center text-gray-500">
              {showArchived ? 'No archived classes.' : 'No classes yet. Create one to start taking attendance.'}
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {visible.map((cls) => (
                <li key={cls.id} className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{cls.name}</p>
                    <p className="text-sm text-gray-500">
                      {cls._count?.enrollments ?? 0} student{cls._count?.enrollments === 1 ? '' : 's'}
                      {cls.description && ` · ${cls.description}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRosterId(cls.id)}>
                      <Users className="h-4 w-4" /> Students
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEditor(cls)}>
                      <Pencil className="h-4 w-4" /> Rename
                    </Button>
                    {cls.status === 'ACTIVE' ? (
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setArchived(cls, true)}>
                        <Archive className="h-4 w-4" /> Archive
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setArchived(cls, false)}>
                        <ArchiveRestore className="h-4 w-4" /> Restore
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editor} onOpenChange={(o) => !o && !saving && setEditor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editor?.cls ? 'Rename class' : 'New class'}</DialogTitle>
            <DialogDescription>Class names must be unique.</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} noValidate className="space-y-4">
            {formError && (
              <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="class-name">Name</Label>
              <Input id="class-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus disabled={saving} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="class-description">Description (optional)</Label>
              <Input id="class-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} disabled={saving} />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setEditor(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rosterId} onOpenChange={(o) => !o && setRosterId(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{roster?.name ?? 'Students'}</DialogTitle>
            <DialogDescription>
              Changes apply to registers opened from now on; registers already opened keep their roster.
            </DialogDescription>
          </DialogHeader>
          {rosterLoading && !roster ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : roster ? (
            <div className="space-y-6">
              {roster.enrollments.length === 0 ? (
                <p className="text-sm text-gray-500">No students in this class yet.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {roster.enrollments.map(({ student }) => (
                    <li key={student.id} className="flex items-center justify-between gap-3 p-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-900">
                          {student.firstName} {student.lastName}
                          {student.user.status !== 'ACTIVE' && (
                            <span className="ml-2 text-xs font-normal text-gray-500">(inactive account)</span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-gray-500">
                          {student.admissionId} · {student.user.email}
                        </span>
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-1.5"
                        disabled={removing === student.id}
                        onClick={() => removeStudent(student.id)}
                      >
                        {removing === student.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {roster.status === 'ACTIVE' ? (
                <StudentPicker excludeIds={enrolledIds} onPick={(id) => addStudent(id)} />
              ) : (
                <p className="text-sm text-gray-500">Restore the class to add students.</p>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setRosterId(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
