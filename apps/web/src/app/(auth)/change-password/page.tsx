'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, KeyRound, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';
import {
  getAccessToken,
  getStoredUser,
  loginRedirectUrl,
  logout,
  safeRedirectPath,
  setSession,
} from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/lab-validation';
import { PASSWORD_RULES, meetsPasswordPolicy } from '@/lib/password-policy';

function ChangePasswordForm() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [ready, setReady] = useState(false);
  const [forced, setForced] = useState(false);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!getAccessToken() || !user) {
      router.replace(loginRedirectUrl('/change-password'));
      return;
    }
    setForced(!!user.mustChangePassword);
    setReady(true);
  }, [router]);

  const policyOk = meetsPasswordPolicy(password);
  const matches = password.length > 0 && password === confirm;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!current) return setError('Enter your current password.');
    if (!policyOk) return setError('The new password does not meet all the rules below.');
    if (!matches) return setError('The new passwords do not match.');
    if (password === current) return setError('Choose a password different from the current one.');

    setSubmitting(true);
    try {
      const { data } = await apiClient.post<{ accessToken: string }>('/auth/change-password', {
        currentPassword: current,
        newPassword: password,
      });
      const user = getStoredUser();
      if (user) setSession(data.accessToken, { ...user, mustChangePassword: false });
      router.replace(safeRedirectPath(next, user?.role));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not change the password. Please try again.'));
      setSubmitting(false);
    }
  };

  const onSignOut = async () => {
    await logout();
    router.replace('/login');
  };

  if (!ready) {
    return <Loader2 className="h-8 w-8 animate-spin text-gray-400" aria-label="Loading" />;
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center text-center">
        <Image src="/logo.webp" alt="TAXBROS" width={64} height={58} priority className="mb-2 h-14 w-auto" />
        <CardTitle className="text-2xl">Change password</CardTitle>
        <CardDescription>
          {forced
            ? 'For security, set a new password before you continue.'
            : 'Your other devices will be signed out.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {error && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="current-password">{forced ? 'Current (temporary) password' : 'Current password'}</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              aria-describedby="password-rules"
            />
            <ul id="password-rules" className="space-y-1 pt-1 text-sm" aria-live="polite">
              {PASSWORD_RULES.map((rule) => {
                const ok = rule.test(password);
                return (
                  <li key={rule.id} className={`flex items-center gap-2 ${ok ? 'text-green-700' : 'text-gray-500'}`}>
                    {ok ? <Check className="h-4 w-4" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}
                    <span>
                      {rule.label}
                      <span className="sr-only">{ok ? ' (done)' : ' (not yet)'}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={submitting}
            />
            {confirm && !matches && <p className="text-sm text-red-600">Passwords do not match.</p>}
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Change password
          </Button>
          <div className="flex justify-center gap-4 text-sm">
            {!forced && (
              <button type="button" className="min-h-11 text-gray-600 underline-offset-4 hover:underline" onClick={() => router.back()}>
                Cancel
              </button>
            )}
            <button type="button" className="min-h-11 text-gray-600 underline-offset-4 hover:underline" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ChangePasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-gray-400" />}>
        <ChangePasswordForm />
      </Suspense>
    </div>
  );
}
