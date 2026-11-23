'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, Pencil, Plus, Send, Trash2, Undo2 } from 'lucide-react';
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
import { QuestionEditor } from '@/components/admin/question-editor';
import { useToast } from '@/hooks/use-toast';
import { marksSummary, quizAdminApi, type AdminQuiz, type QuestionPayload } from '@/lib/admin-api';
import { getApiErrorMessage } from '@/lib/lab-validation';

type Details = { title: string; description: string; totalMarks: string; passMark: string; timeLimit: string; maxAttempts: string };

/** Quiz editor: details, questions, publishing (R23, R24). */
export default function QuizEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [quiz, setQuiz] = useState<AdminQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState<Details | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      setQuiz(await quizAdminApi.get(id));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not load the quiz', description: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!quiz) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-10 text-center text-gray-600">
        Quiz not found. <Link href="/admin/quizzes" className="underline">Back to quizzes</Link>
      </div>
    );
  }

  const { sum, matches } = marksSummary(quiz);
  const published = quiz.status === 'PUBLISHED';
  const questions = [...quiz.questions].sort((a, b) => a.displayOrder - b.displayOrder);

  const saveQuestion = async (payload: QuestionPayload) => {
    setSavingQuestion(true);
    try {
      if (editingId === 'new') {
        const nextOrder = questions.length ? Math.max(...questions.map((q) => q.displayOrder)) + 1 : 0;
        await quizAdminApi.addQuestion(quiz.id, { ...payload, displayOrder: nextOrder });
      } else if (editingId) {
        await quizAdminApi.updateQuestion(editingId, payload);
      }
      setEditingId(null);
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Question not saved', description: getApiErrorMessage(err) });
    } finally {
      setSavingQuestion(false);
    }
  };

  const deleteQuestion = async (questionId: string) => {
    setBusy(true);
    try {
      await quizAdminApi.removeQuestion(questionId);
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Question not deleted', description: getApiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const setPublished = async (publish: boolean) => {
    setBusy(true);
    try {
      if (publish) await quizAdminApi.publish(quiz.id);
      else await quizAdminApi.update(quiz.id, { status: 'DRAFT' });
      await load();
      toast({ title: publish ? 'Quiz published' : 'Quiz moved back to draft' });
    } catch (err) {
      toast({ variant: 'destructive', title: publish ? 'Not published' : 'Not changed', description: getApiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (!details) return;
    const total = Number(details.totalMarks);
    const pass = Number(details.passMark);
    if (!details.title.trim()) return setDetailsError('Enter a title.');
    if (!Number.isInteger(total) || total < 1) return setDetailsError('Total marks must be a whole number of at least 1.');
    if (!Number.isInteger(pass) || pass < 0 || pass > total) return setDetailsError('Pass mark must be between 0 and the total.');
    const optional = (v: string) => (v.trim() === '' ? undefined : Number(v));
    const time = optional(details.timeLimit);
    const attempts = optional(details.maxAttempts);
    if (time !== undefined && (!Number.isInteger(time) || time < 1)) return setDetailsError('Time limit must be whole minutes.');
    if (attempts !== undefined && (!Number.isInteger(attempts) || attempts < 1)) return setDetailsError('Max attempts must be at least 1.');
    setBusy(true);
    try {
      await quizAdminApi.update(quiz.id, {
        title: details.title.trim(),
        description: details.description.trim() || undefined,
        totalMarks: total,
        passMark: pass,
        ...(time !== undefined ? { timeLimit: time } : {}),
        ...(attempts !== undefined ? { maxAttempts: attempts } : {}),
      });
      setDetails(null);
      await load();
    } catch (err) {
      setDetailsError(getApiErrorMessage(err, 'Could not save'));
    } finally {
      setBusy(false);
    }
  };

  const deleteQuiz = async () => {
    setBusy(true);
    try {
      await quizAdminApi.remove(quiz.id);
      router.replace('/admin/quizzes');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Quiz not deleted', description: getApiErrorMessage(err) });
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <Link href="/admin/quizzes" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> All quizzes
      </Link>

      <Card className="mb-6">
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2 text-xl font-bold sm:text-2xl">
              {quiz.title}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {published ? 'Published' : 'Draft'}
              </span>
            </CardTitle>
            <CardDescription>
              Pass mark {quiz.passMark} of {quiz.totalMarks}
              {quiz.timeLimit ? ` · ${quiz.timeLimit} min` : ' · no time limit'}
              {quiz.maxAttempts ? ` · ${quiz.maxAttempts} attempt${quiz.maxAttempts === 1 ? '' : 's'}` : ' · unlimited attempts'}
              {` · attached to a ${quiz.attachmentType.toLowerCase()}`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={() => {
                setDetailsError(null);
                setDetails({
                  title: quiz.title,
                  description: quiz.description ?? '',
                  totalMarks: String(quiz.totalMarks),
                  passMark: String(quiz.passMark),
                  timeLimit: quiz.timeLimit ? String(quiz.timeLimit) : '',
                  maxAttempts: quiz.maxAttempts ? String(quiz.maxAttempts) : '',
                });
              }}
            >
              <Pencil className="h-4 w-4" /> Edit details
            </Button>
            {published ? (
              <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={() => setPublished(false)}>
                <Undo2 className="h-4 w-4" /> Unpublish
              </Button>
            ) : (
              <Button size="sm" className="gap-1.5" disabled={busy || !matches} onClick={() => setPublished(true)}>
                <Send className="h-4 w-4" /> Publish
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5 text-red-700" disabled={busy} onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p
            className={`flex items-center gap-2 rounded-md p-3 text-sm ${
              matches ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'
            }`}
            aria-live="polite"
          >
            {matches && <CheckCircle2 className="h-4 w-4" />}
            {questions.length === 0
              ? 'Add questions. Their marks must add up to the total before you can publish.'
              : matches
                ? `Question marks add up to the total (${sum}).`
                : `Question marks add up to ${sum}; the quiz total is ${quiz.totalMarks}. Adjust one of them before publishing.`}
          </p>
          {published && (
            <p className="mt-3 text-sm text-gray-600">
              Students can see this quiz. Changing questions now changes what future attempts are marked against.
            </p>
          )}
        </CardContent>
      </Card>

      <ol className="space-y-4">
        {questions.map((q, index) => (
          <li key={q.id}>
            {editingId === q.id ? (
              <QuestionEditor question={q} saving={savingQuestion} onSave={saveQuestion} onCancel={() => setEditingId(null)} />
            ) : (
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-medium text-gray-900">
                      {index + 1}. {q.questionText}
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        ({q.marks} mark{q.marks === 1 ? '' : 's'})
                      </span>
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={busy || editingId !== null} onClick={() => setEditingId(q.id)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Delete question ${index + 1}`}
                        disabled={busy || editingId !== null}
                        onClick={() => deleteQuestion(q.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm">
                    {q.options.map((o) => (
                      <li
                        key={o.id}
                        className={`rounded px-2 py-1 ${o.id === q.correctAnswer ? 'bg-green-50 font-medium text-green-800' : 'text-gray-700'}`}
                      >
                        {o.id === q.correctAnswer && <span className="sr-only">Correct answer: </span>}
                        {o.text}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-4">
        {editingId === 'new' ? (
          <QuestionEditor saving={savingQuestion} onSave={saveQuestion} onCancel={() => setEditingId(null)} />
        ) : (
          <Button variant="outline" className="gap-2" disabled={editingId !== null || busy} onClick={() => setEditingId('new')}>
            <Plus className="h-4 w-4" /> Add question
          </Button>
        )}
      </div>

      <Dialog open={!!details} onOpenChange={(o) => !o && !busy && setDetails(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Quiz details</DialogTitle>
            <DialogDescription>To attach the quiz somewhere else, create a new quiz.</DialogDescription>
          </DialogHeader>
          {details && (
            <form onSubmit={saveDetails} noValidate className="space-y-4">
              {detailsError && (
                <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {detailsError}
                </p>
              )}
              {(
                [
                  ['title', 'Title', 'text'],
                  ['description', 'Description (optional)', 'text'],
                  ['totalMarks', 'Total marks', 'number'],
                  ['passMark', 'Pass mark', 'number'],
                  ['timeLimit', 'Time limit in minutes (optional)', 'number'],
                  ['maxAttempts', 'Max attempts (optional)', 'number'],
                ] as Array<[keyof Details, string, string]>
              ).map(([key, label, type]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`details-${key}`}>{label}</Label>
                  <Input
                    id={`details-${key}`}
                    type={type}
                    value={details[key]}
                    onChange={(e) => setDetails({ ...details, [key]: e.target.value })}
                    disabled={busy}
                  />
                </div>
              ))}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setDetails(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={(o) => !o && !busy && setConfirmDelete(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this quiz?</DialogTitle>
            <DialogDescription>
              The quiz and all its questions are deleted permanently. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteQuiz} disabled={busy}>
              Delete quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
