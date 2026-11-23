'use client';

import { useEffect } from 'react';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Suspense fallback shown while a route segment loads (Task 59). */
export function RouteLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="h-8 w-8 animate-spin text-gray-500" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Friendly error boundary UI (Task 60). Technical details stay in the console. */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Route error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center" role="alert">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold text-gray-900">Something went wrong</h2>
        <p className="mt-2 text-gray-600">
          This page hit an unexpected problem. Your saved data is safe. Try again, and if it keeps
          happening, contact the institute administrator.
        </p>
        {error.digest && <p className="mt-2 text-xs text-gray-400">Reference: {error.digest}</p>}
        <Button onClick={reset} className="mt-6">
          <RotateCcw className="h-4 w-4" /> Try again
        </Button>
      </div>
    </div>
  );
}
