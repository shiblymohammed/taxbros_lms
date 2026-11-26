'use client';

import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, Loader2, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/page-header';
import { getApiErrorMessage } from '@/lib/lab-validation';
import { useInstituteTimezone } from '@/lib/institute-time';
import {
  apiErrorCode,
  clockTime,
  currentLocation,
  selfAttendanceApi,
  type StudentCheckInResult,
  type StudentToday,
} from '@/lib/self-attendance';
import { cn } from '@/lib/utils';

const STATUS_STYLE: Record<string, string> = {
  PRESENT: 'bg-emerald-50 text-emerald-700',
  LATE: 'bg-amber-50 text-amber-700',
  ABSENT: 'bg-red-50 text-red-700',
};
const statusLabel = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export default function StudentCheckInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      }
    >
      <CheckIn />
    </Suspense>
  );
}

/**
 * Student class check-in: scan the teacher's QR code (opens this page with the code filled in)
 * or type the six-digit code shown under it.
 */
function CheckIn() {
  const params = useSearchParams();
  const router = useRouter();
  const timeZone = useInstituteTimezone();
  const [today, setToday] = useState<StudentToday | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<StudentCheckInResult | null>(null);
  const autoSent = useRef(false);

  const load = useCallback(async () => {
    try {
      setToday(await selfAttendanceApi.studentToday());
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const usesLocation = today?.usesLocation ?? false;
  const submit = useCallback(
    async (value: string, registerId?: string | null) => {
      setBusy(true);
      setError(null);
      try {
        let coords = usesLocation ? await currentLocation() : null;
        let result: StudentCheckInResult;
        try {
          result = await selfAttendanceApi.studentCheckIn(value, registerId, coords);
        } catch (err) {
          if (apiErrorCode(err) !== 'LOCATION_REQUIRED' || coords) throw err;
          coords = await currentLocation();
          if (!coords) throw err;
          result = await selfAttendanceApi.studentCheckIn(value, registerId, coords);
        }
        setDone(result);
        setCode('');
        await load();
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [usesLocation, load],
  );

  // Opened from the QR code: check in straight away, then tidy the address bar
  useEffect(() => {
    const c = params.get('c');
    if (!today || autoSent.current || !c) return;
    autoSent.current = true;
    submit(c, params.get('r')).finally(() => router.replace('/student/check-in'));
  }, [today, params, submit, router]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (/^\d{6}$/.test(code)) submit(code);
    else setError('The code has 6 digits.');
  };

  return (
    <PageContainer className="max-w-xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-900">Class check-in</h1>
        <p className="text-sm text-slate-500">Scan the QR code on your teacher&apos;s screen, or type the code under it.</p>
      </div>

      {done && (
        <section role="status" className="flex items-start gap-3 rounded-[1.25rem] border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" aria-hidden="true" />
          <div>
            <p className="font-semibold text-emerald-900">
              {done.alreadyMarked ? 'Already marked' : 'You are checked in'}: {statusLabel(done.status)}
            </p>
            <p className="text-sm text-emerald-800">
              {done.className} · {clockTime(done.markedAt, timeZone)}
            </p>
          </div>
        </section>
      )}

      <form onSubmit={onSubmit} className="rounded-[1.25rem] border bg-white p-5 shadow-sm">
        <label htmlFor="check-in-code" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <QrCode className="h-4 w-4 text-brand" aria-hidden="true" /> Code on the screen
        </label>
        <div className="mt-3 flex gap-2">
          <input
            id="check-in-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 px-4 text-center font-mono text-2xl tracking-[0.3em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-invalid={!!error}
          />
          <Button type="submit" className="h-12 px-5" disabled={busy || code.length !== 6}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Check in'}
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {today?.requiresPlace && (
          <p className="mt-3 text-xs text-slate-500">You need to be at the institute (on its Wi-Fi, or with location turned on).</p>
        )}
      </form>

      <section className="rounded-[1.25rem] border bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Today&apos;s classes</h2>
        {!today ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : today.classes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No class register is open for you today yet. Your teacher opens it in class.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {today.classes.map((c) => (
              <li key={c.registerId} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900">{c.className}</span>
                  <span className="block text-xs text-slate-500">
                    {c.status
                      ? `${c.selfMarked ? 'Checked in' : 'Marked by teacher'} · ${clockTime(c.markedAt, timeZone)}`
                      : c.open
                        ? 'Check-in is open now'
                        : 'Check-in not open'}
                  </span>
                </span>
                {c.status ? (
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_STYLE[c.status])}>{statusLabel(c.status)}</span>
                ) : (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
                      c.open ? 'bg-brand-soft text-brand-strong' : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    <Clock className="h-3 w-3" aria-hidden="true" /> {c.open ? 'Open' : 'Waiting'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
