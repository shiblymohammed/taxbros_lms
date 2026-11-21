'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
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
import {
  QuizSettingsForm,
  emptyQuizSettings,
  toQuizPayload,
  type QuizSettings,
} from '@/components/admin/quiz-settings-form';
import { useToast } from '@/hooks/use-toast';
import { marksSummary, quizAdminApi, type AdminQuiz } from '@/lib/admin-api';
import { getApiErrorMessage } from '@/lib/lab-validation';

/** Quiz list and creation (R23). */
export default function QuizzesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<AdminQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [settings, setSettings] = useState<QuizSettings>(emptyQuizSettings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setQuizzes(await quizAdminApi.list());
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not load quizzes', description: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const { payload, errors: found } = toQuizPayload(settings);
    setErrors(found);
    setServerError(null);
    if (!payload) return;
    setSaving(true);
    try {
      const quiz = await quizAdminApi.create(payload);
      router.push(`/admin/quizzes/${quiz.id}`);
    } catch (err) {
      setServerError(getApiErrorMessage(err, 'Could not create the quiz'));
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-xl font-bold sm:text-2xl">Quizzes</CardTitle>
            <CardDescription>Students only see published quizzes. Question marks must add up to the total before publishing.</CardDescription>
          </div>
          <Button
            className="gap-2"
            onClick={() => {
              setSettings(emptyQuizSettings);
              setErrors({});
              setServerError(null);
              setCreating(true);
            }}
          >
            <Plus className="h-4 w-4" /> New quiz
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : quizzes.length === 0 ? (
            <p className="py-12 text-center text-gray-500">No quizzes yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {quizzes.map((quiz) => {
                const { sum, matches } = marksSummary(quiz);
                return (
                  <li key={quiz.id}>
                    <Link
                      href={`/admin/quizzes/${quiz.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-gray-50 sm:p-4"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-gray-900">{quiz.title}</span>
                        <span className="block text-sm text-gray-500">
                          {quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'} · pass {quiz.passMark}/
                          {quiz.totalMarks}
                          {quiz.status === 'DRAFT' && !matches && (
                            <span className="ml-1 text-amber-700">· marks add up to {sum}</span>
                          )}
                        </span>
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          quiz.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {quiz.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={creating} onOpenChange={(o) => !o && !saving && setCreating(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New quiz</DialogTitle>
            <DialogDescription>You&apos;ll add questions on the next screen. New quizzes start as drafts.</DialogDescription>
          </DialogHeader>
          <form onSubmit={create} noValidate className="space-y-4">
            {serverError && (
              <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {serverError}
              </div>
            )}
            <QuizSettingsForm value={settings} onChange={setSettings} errors={errors} disabled={saving} />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setCreating(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Create quiz
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
