import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONES = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-brand-soft text-brand-strong',
  green: 'bg-emerald-50 text-emerald-600',
  violet: 'bg-violet-50 text-violet-600',
  orange: 'bg-orange-50 text-flame',
  red: 'bg-red-50 text-red-600',
} as const;

export type StatTone = keyof typeof TONES;

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: StatTone;
  hint?: string;
}

/** Headline number with an icon, for dashboards. */
export function StatCard({ label, value, icon: Icon, tone = 'slate', hint }: StatCardProps) {
  return (
    <div className="flex flex-col-reverse items-start justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:gap-4 sm:p-5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:mt-2 sm:text-3xl">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11', TONES[tone])}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
    </div>
  );
}
