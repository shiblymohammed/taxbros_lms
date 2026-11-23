'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, KeyRound, Loader2, LogOut } from 'lucide-react';
import type { SessionUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

const ROLE_NAMES: Record<string, string> = {
  SUPER_ADMIN: 'Super administrator',
  ADMINISTRATOR: 'Administrator',
  STAFF: 'Staff',
  STUDENT: 'Student',
};

function initials(email: string) {
  const name = email.split('@')[0].replace(/[^a-z0-9]+/gi, ' ').trim();
  const parts = name.split(' ').filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase() || '?';
}

interface UserMenuProps {
  user: SessionUser;
  signingOut: boolean;
  onSignOut: () => void;
}

/** Account menu in the top bar: who is signed in, change password, sign out. */
export function UserMenu({ user, signingOut, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const roleName = ROLE_NAMES[user.role] ?? user.role;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex min-h-10 items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:pr-2.5"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong ring-1 ring-brand/20">
          {initials(user.email)}
        </span>
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block max-w-[11rem] truncate text-sm font-medium text-slate-900">{user.email}</span>
          <span className="block text-xs text-slate-500">{roleName}</span>
        </span>
        <ChevronDown className={cn('hidden h-4 w-4 text-slate-400 transition-transform sm:block', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border bg-white py-1 shadow-lg">
          <div className="border-b px-4 py-3">
            <p className="truncate text-sm font-medium text-slate-900" title={user.email}>{user.email}</p>
            <p className="text-xs text-slate-500">{roleName}</p>
          </div>
          <Link
            href="/change-password"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex min-h-10 items-center gap-2.5 px-4 text-sm text-slate-700 hover:bg-slate-50"
          >
            <KeyRound className="h-4 w-4 text-slate-400" /> Change password
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={onSignOut}
            disabled={signingOut}
            className="flex min-h-10 w-full items-center gap-2.5 px-4 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Sign out
          </button>
        </div>
      )}
    </div>
  );
}
