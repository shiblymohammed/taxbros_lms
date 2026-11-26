'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2, LogIn, LogOut, MapPin, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/lab-validation';
import { useInstituteTimezone } from '@/lib/institute-time';
import { apiErrorCode, clockTime, currentLocation, selfAttendanceApi, type StaffToday } from '@/lib/self-attendance';

const STATUS_STYLE: Record<string, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-800',
  LATE: 'bg-amber-100 text-amber-800',
  ABSENT: 'bg-red-100 text-red-800',
};

/**
 * Staff self attendance: check in when arriving and check out when leaving, on the institute
 * Wi-Fi or at its location, within the check-in hours set by an administrator.
 */
export default function StaffCheckInPage() {
  const { toast } = useToast();
  const timeZone = useInstituteTimezone();
  const [today, setToday] = useState<StaffToday | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'in' | 'out' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setToday(await selfAttendanceApi.staffToday());
      setLoadError(null);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (kind: 'in' | 'out') => {
    if (!today) return;
    setBusy(kind);
    setProblem(null);
    const send = kind === 'in' ? selfAttendanceApi.staffCheckIn : selfAttendanceApi.staffCheckOut;
    try {
      // Off the institute Wi-Fi, the location is the proof of being there
      const needLocation = today.usesLocation && !today.onInstituteNetwork;
      let coords = needLocation ? await currentLocation() : null;
      try {
        await send(coords);
      } catch (err) {
        if (apiErrorCode(err) !== 'LOCATION_REQUIRED' || coords || !today.usesLocation) throw err;
        coords = await currentLocation();
        if (!coords) throw err;
        await send(coords);
      }
      toast({ title: kind === 'in' ? 'Checked in' : 'Checked out' });
      await load();
    } catch (err) {
      setProblem(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (loadError) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-6">
        <p role="alert" className="rounded-md bg-red-50 p-4 text-red-800">
          {loadError}
        </p>
      </div>
    );
  }

  if (!today) {
    return (
      <div className="flex justify-center py-16" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="sr-only">Loading your attendance…</span>
      </div>
    );
  }

  const record = today.record;
  const checkedIn = !!record?.checkInAt;
  const checkedOut = !!record?.checkOutAt;
  const markedByAdmin = !!record && !checkedIn;
  const dateLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${today.date}T00:00:00`));

  return (
    <div className="container mx-auto max-w-xl space-y-5 px-4 py-6 sm:py-8">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">My attendance</h1>
        <p className="text-sm text-gray-600">{dateLabel}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {record ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                {checkedOut ? 'Done for today' : checkedIn ? 'You are checked in' : 'Marked by an administrator'}
              </>
            ) : (
              <>
                <Clock className="h-5 w-5 text-gray-500" aria-hidden="true" /> Not checked in yet
              </>
            )}
          </CardTitle>
          <CardDescription>
            Check-in is open {today.window.start}–{today.window.end}. After {today.lateAfter} you are marked Late.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {record && (
            <dl className="grid grid-cols-3 gap-3 rounded-lg border p-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500">Status</dt>
                <dd>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[record.status] ?? ''}`}>
                    {record.status.charAt(0) + record.status.slice(1).toLowerCase()}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Checked in</dt>
                <dd className="font-medium">{clockTime(record.checkInAt, timeZone) || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Checked out</dt>
                <dd className="font-medium">{clockTime(record.checkOutAt, timeZone) || '—'}</dd>
              </div>
            </dl>
          )}

          {!today.setUp ? (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              Self check-in is not set up yet. An administrator needs to add the institute Wi-Fi address or location in Settings.
            </p>
          ) : markedByAdmin ? (
            <p className="text-sm text-gray-600">An administrator has already marked your attendance for today.</p>
          ) : !checkedIn ? (
            <Button className="h-14 w-full gap-2 text-base" onClick={() => act('in')} disabled={busy !== null || !today.open}>
              {busy === 'in' ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
              Check in
            </Button>
          ) : !checkedOut ? (
            <Button variant="outline" className="h-14 w-full gap-2 text-base" onClick={() => act('out')} disabled={busy !== null}>
              {busy === 'out' ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
              Check out
            </Button>
          ) : null}

          {today.setUp && !checkedIn && !markedByAdmin && !today.open && (
            <p className="text-sm text-gray-600">
              Check-in is closed now. If you missed it, ask an administrator to mark your attendance.
            </p>
          )}

          {problem && (
            <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {problem}
            </p>
          )}

          {today.setUp && (
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              {today.onInstituteNetwork ? (
                <>
                  <Wifi className="h-3.5 w-3.5" aria-hidden="true" /> You are on the institute network.
                </>
              ) : today.usesLocation ? (
                <>
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Your location is checked when you tap the button.
                </>
              ) : (
                <>
                  <Wifi className="h-3.5 w-3.5" aria-hidden="true" /> Connect to the institute Wi-Fi to check in.
                </>
              )}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
