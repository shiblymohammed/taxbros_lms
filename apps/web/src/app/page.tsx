'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getAccessToken, getStoredUser, homePathForRole } from '@/lib/auth';

/** Entry point: send signed-in users to their area, everyone else to /login. */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = getStoredUser();
    router.replace(getAccessToken() && user ? homePathForRole(user.role) : '/login');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center" aria-busy="true">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
