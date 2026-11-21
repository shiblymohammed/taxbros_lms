'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js (Task 63). Production builds only, so development never serves stale assets.
 * Set NEXT_PUBLIC_ENABLE_SW=true to test registration with `next dev`.
 */
export function PwaRegister() {
  useEffect(() => {
    const enabled = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_SW === 'true';
    if (!enabled || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.warn('Service worker registration failed', err);
    });
  }, []);
  return null;
}
