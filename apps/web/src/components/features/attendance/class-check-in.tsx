'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Loader2, QrCode, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { AttendanceRegister } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/lab-validation';
import { checkInLink, selfAttendanceApi, type ClassCheckInState } from '@/lib/self-attendance';

const POLL_MS = 3000;

/**
 * Student self check-in for today's register: the teacher shows a QR code (and its six-digit code)
 * that changes every 30 seconds; students scan it or type the code. Closing check-in marks everyone
 * without a mark Absent. The register below stays editable for corrections.
 */
export function ClassCheckIn({
  register,
  isToday,
  onRegisterChanged,
}: {
  register: AttendanceRegister;
  isToday: boolean;
  /** Called with the fresh register after check-in closes, or when the dialog is hidden */
  onRegisterChanged: (updated?: AttendanceRegister) => void;
}) {
  const { toast } = useToast();
  const [state, setState] = useState<ClassCheckInState | null>(null);
  const [showing, setShowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const codeRef = useRef<string | null>(null);

  // Is check-in already running on this register (e.g. started on another device)?
  useEffect(() => {
    if (!isToday) return;
    let cancelled = false;
    selfAttendanceApi
      .classState(register.id)
      .then((s) => !cancelled && setState(s))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [register.id, isToday]);

  const refresh = useCallback(async () => {
    try {
      setState(await selfAttendanceApi.classState(register.id));
    } catch {
      // Keep the last code on screen; the next poll retries
    }
  }, [register.id]);

  // While check-in is open: poll for the next code and the live count (slower when the code is hidden)
  const running = !!state?.open;
  useEffect(() => {
    if (!running && !showing) return;
    const timer = setInterval(refresh, showing ? POLL_MS : POLL_MS * 2);
    return () => clearInterval(timer);
  }, [running, showing, refresh]);

  // A student checked in: show their mark in the register below straight away
  const markedCount = state?.marked;
  const lastMarked = useRef<number | undefined>(undefined);
  const onChangedRef = useRef(onRegisterChanged);
  useEffect(() => {
    onChangedRef.current = onRegisterChanged;
  });
  useEffect(() => {
    if (markedCount === undefined) return;
    if (lastMarked.current !== undefined && markedCount !== lastMarked.current) onChangedRef.current();
    lastMarked.current = markedCount;
  }, [markedCount]);

  // Draw the QR code whenever the code changes
  useEffect(() => {
    if (!state?.open || !state.code || codeRef.current === state.code) return;
    codeRef.current = state.code;
    QRCode.toDataURL(checkInLink(window.location.origin, state.registerId, state.code), { width: 360, margin: 1 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [state]);

  // Countdown to the next code
  useEffect(() => {
    if (!state?.open || state.expiresInMs === null) return;
    const until = Date.now() + state.expiresInMs;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [state]);

  if (!isToday) return null;

  const start = async () => {
    setBusy(true);
    try {
      setState(await selfAttendanceApi.startClass(register.id));
      setShowing(true);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not start check-in', description: getApiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    setBusy(true);
    try {
      const updated = await selfAttendanceApi.closeClass(register.id);
      setConfirmClose(false);
      setShowing(false);
      setState((s) => (s ? { ...s, open: false, code: null, closedAt: new Date().toISOString() } : s));
      onRegisterChanged(updated);
      toast({ title: 'Check-in closed', description: 'Students who did not check in are marked Absent. You can still correct any mark.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not close check-in', description: getApiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const hide = () => {
    setShowing(false);
    // Pick up the marks students made while the code was shown
    onRegisterChanged();
  };

  const unmarked = state ? state.total - state.marked : 0;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-brand/30 bg-brand-soft/40 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-700">
          <span className="font-semibold text-gray-900">Student self check-in.</span>{' '}
          {running
            ? `Open · ${state!.checkedIn} of ${state!.total} checked in`
            : 'Show a QR code students scan with their phone; anyone who does not check in is marked Absent when you close it.'}
        </p>
        <div className="flex shrink-0 gap-2">
          {running ? (
            <>
              <Button onClick={() => setShowing(true)} className="gap-2">
                <QrCode className="h-4 w-4" /> Show code
              </Button>
              <Button variant="outline" onClick={() => setConfirmClose(true)} disabled={busy}>
                Close check-in
              </Button>
            </>
          ) : (
            <Button onClick={start} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              {state?.closedAt ? 'Reopen check-in' : 'Start self check-in'}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={showing} onOpenChange={(open) => (open ? setShowing(true) : hide())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Check in to {register.className}</DialogTitle>
            <DialogDescription>
              Scan with your phone camera, or open TAXBROS → Attendance and type the code. The code changes every 30 seconds.
            </DialogDescription>
          </DialogHeader>
          {running && state?.code ? (
            <div className="flex flex-col items-center gap-3">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt={`QR code for checking in to ${register.className}`} className="h-72 w-72 rounded-lg border" />
              ) : (
                <div className="flex h-72 w-72 items-center justify-center rounded-lg border">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              )}
              <p className="font-mono text-4xl font-bold tracking-[0.3em] text-gray-900" aria-label={`Code ${state.code.split('').join(' ')}`}>
                {state.code}
              </p>
              <p className="text-xs text-gray-500">{secondsLeft !== null ? `New code in ${secondsLeft}s` : ''}</p>
              <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700" aria-live="polite">
                <Users className="h-4 w-4" aria-hidden="true" /> {state.checkedIn} of {state.total} checked in
              </p>
              <p className="text-center text-xs text-gray-500">
                After {state.lateAfterMinutes} minutes students are marked Late.
              </p>
              <div className="flex w-full gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={hide}>
                  Hide code
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => setConfirmClose(true)} disabled={busy}>
                  Close check-in
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmClose}
        title="Close check-in?"
        description={
          unmarked > 0
            ? `${unmarked} student(s) have no mark yet and will be marked Absent. You can still correct any mark afterwards.`
            : 'Everyone has a mark. Students can no longer check in themselves.'
        }
        confirmLabel="Close check-in"
        destructive
        busy={busy}
        onConfirm={close}
        onCancel={() => setConfirmClose(false)}
      />
    </>
  );
}
