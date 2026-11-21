'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';
import {
  getAccessToken,
  getStoredUser,
  safeRedirectPath,
  setSession,
  type SessionUser,
} from '@/lib/auth';

function loginErrorMessage(err: any): string {
  const status = err?.response?.status;
  const message = err?.response?.data?.message;
  const text = Array.isArray(message) ? message.join('; ') : message;

  if (status === 401) return 'Incorrect email or password.';
  if (status === 429) {
    // Account lockout (AuthService) explains itself; the IP rate limit returns a generic message
    if (text && /locked/i.test(text)) return text;
    const retryAfter = Number(err?.response?.headers?.['retry-after']);
    const minutes = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter / 60) : 15;
    return `Too many sign-in attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  }
  if (status === 403) return text || 'This account is not allowed to sign in.';
  if (status === 400) return text || 'Please enter a valid email and password.';
  if (!err?.response) return 'Cannot reach the server. Check your connection and try again.';
  return 'Sign-in failed. Please try again.';
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in: go straight to the right area
  useEffect(() => {
    const user = getStoredUser();
    if (getAccessToken() && user) {
      router.replace(safeRedirectPath(next, user.role));
    }
  }, [next, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await apiClient.post<{ accessToken: string; user: SessionUser }>('/auth/login', {
        email: email.trim(),
        password,
      });
      setSession(data.accessToken, data.user);
      const destination = safeRedirectPath(next, data.user.role);
      // R36.3: new accounts and admin resets must set a new password first
      router.replace(
        data.user.mustChangePassword
          ? `/change-password?next=${encodeURIComponent(destination)}`
          : destination,
      );
    } catch (err) {
      setError(loginErrorMessage(err));
      setPassword('');
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <Image src="/logo.webp" alt="TAXBROS" width={64} height={58} priority className="mb-2 h-14 w-auto" />
        <CardTitle className="text-2xl">Sign in</CardTitle>
        <CardDescription>TAXBROS Learning Management System</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {error && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" /> Sign in
              </>
            )}
          </Button>

          <p className="text-center text-xs text-gray-500">
            Forgotten your password? Ask the institute administrator to reset it.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-gray-400" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
