'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { studentProfileApi, type StudentProfileDetail } from '@/lib/admin-api';
import { quizzesApi, type AttemptDetail } from '@/lib/api';
import { formatCalendarDate, formatDateTime, useInstituteTimezone } from '@/lib/institute-time';
import { getApiErrorMessage } from '@/lib/lab-validation';

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** Student profile for administrators: courses with progress (R5.4), classes, quiz attempts (R26.5). */
export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const tz = useInstituteTimezone();

  const [student, setStudent] = useState<StudentProfileDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [attemptError, setAttemptError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    studentProfileApi
      .get(id)
      .then((s) => alive && setStudent(s))
      .catch((err) => alive && setError(getApiErrorMessage(err)));
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!attemptId) return;
    let alive = true;
    setAttempt(null);
    setAttemptError(null);
    quizzesApi
      .getAttemptDetail(attemptId)
      .then((a) => alive && setAttempt(a))
      .catch((err) => alive && setAttemptError(getApiErrorMessage(err)));
    return () => {
      alive = false;
    };
  }, [attemptId]);

  const back = (
    <Button asChild variant="ghost" size="sm" className="mb-4 gap-1.5">
      <Link href="/admin/users">
        <ArrowLeft className="h-4 w-4" /> Users
      </Link>
    </Button>
  );

  if (error) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-6">
        {back}
        <p role="alert" className="rounded-md bg-red-50 p-4 text-red-800">
          {error}
        </p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex justify-center py-16" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const activeClasses = student.classEnrollments.filter((c) => c.status === 'ACTIVE');
  const pastClasses = student.classEnrollments.filter((c) => c.status !== 'ACTIVE');
  const passedCount = student.quizAttempts.filter((a) => a.passed).length;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 sm:py-8">
      {back}

      <Card className="mb-6">
        <CardHeader>
          <h1 className="text-xl font-bold leading-none tracking-tight sm:text-2xl">
            {student.firstName} {student.lastName}
          </h1>
          <dl className="grid gap-x-6 gap-y-2 pt-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-gray-500">Admission ID</dt>
              <dd className="font-medium">{student.admissionId}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Email</dt>
              <dd className="break-all font-medium">{student.user.email}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Account</dt>
              <dd className="font-medium">{titleCase(student.user.status)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Admitted</dt>
              <dd className="font-medium">{formatCalendarDate(student.admissionDate)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Phone</dt>
              <dd className="font-medium">{student.phoneNumber || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Last sign-in</dt>
              <dd className="font-medium">{formatDateTime(student.user.lastLoginAt, tz)}</dd>
            </div>
          </dl>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Courses</CardTitle>
          </CardHeader>
          <CardContent>
            {student.courseEnrollments.length === 0 ? (
              <p className="text-sm text-gray-500">Not enrolled in any course.</p>
            ) : (
              <ul className="space-y-4">
                {student.courseEnrollments.map((e) => (
                  <li key={e.id}>
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <Link href={`/admin/courses/${e.course.id}`} className="font-medium text-blue-700 hover:underline">
                        {e.course.title}
                      </Link>
                      <span className="text-gray-500">
                        {titleCase(e.status)} · {e.progressPercentage}%
                      </span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-gray-100"
                      role="progressbar"
                      aria-label={`${e.course.title} progress`}
                      aria-valuenow={e.progressPercentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${e.progressPercentage}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Classes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {activeClasses.length === 0 ? (
              <p className="text-gray-500">Not in any class.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {activeClasses.map((c) => (
                  <li key={c.id} className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-800">
                    {c.class.name}
                  </li>
                ))}
              </ul>
            )}
            {pastClasses.length > 0 && (
              <p className="mt-3 text-gray-500">Previously in: {pastClasses.map((c) => c.class.name).join(', ')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Quiz attempts</CardTitle>
          {student.quizAttempts.length > 0 && (
            <p className="text-sm text-gray-500">
              {student.quizAttempts.length} attempt{student.quizAttempts.length === 1 ? '' : 's'}, {passedCount} passed
            </p>
          )}
        </CardHeader>
        <CardContent>
          {student.quizAttempts.length === 0 ? (
            <p className="text-sm text-gray-500">No quiz attempts yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {student.quizAttempts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium text-gray-900">{a.quiz.title}</span>
                    <span className="block text-gray-500">{formatDateTime(a.submittedAt, tz)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium">
                      {a.score}/{a.quiz.totalMarks}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        a.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {a.passed ? 'Passed' : 'Not passed'}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setAttemptId(a.id)}>
                      Answers
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!attemptId} onOpenChange={(o) => !o && setAttemptId(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{attempt?.quizTitle ?? 'Quiz attempt'}</DialogTitle>
            {attempt && (
              <DialogDescription>
                Score {attempt.score}/{attempt.totalMarks} (pass mark {attempt.passMark}) ·{' '}
                {attempt.passed ? 'Passed' : 'Not passed'} · {formatDateTime(attempt.submittedAt, tz)}
              </DialogDescription>
            )}
          </DialogHeader>
          {attemptError ? (
            <p role="alert" className="text-sm text-red-700">
              {attemptError}
            </p>
          ) : !attempt ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <ol className="space-y-4">
              {attempt.questions.map((q, i) => {
                const text = (optionId: string | null) => q.options.find((o) => o.id === optionId)?.text ?? 'No answer';
                return (
                  <li key={q.id} className="rounded-lg border p-3 text-sm">
                    <p className="mb-2 flex items-start gap-2 font-medium">
                      {q.isCorrect ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-label="Correct" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-label="Incorrect" />
                      )}
                      <span>
                        {i + 1}. {q.questionText}
                      </span>
                    </p>
                    <p className="text-gray-700">Answered: {text(q.selectedAnswer)}</p>
                    {!q.isCorrect && <p className="text-gray-700">Correct: {text(q.correctAnswer)}</p>}
                    <p className="text-gray-500">
                      {q.marksAwarded}/{q.marks} mark{q.marks === 1 ? '' : 's'}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
