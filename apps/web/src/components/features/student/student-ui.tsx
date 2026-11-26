import Link from 'next/link';
import type { ReactNode } from 'react';
import { Building2, ChevronRight, Clock, FileText, ReceiptIndianRupee, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Section title with an optional "View all" link (mobile design: "This Week's Focus · View All"). */
export function SectionHeading({ title, href, linkLabel = 'View all', icon: Icon, className }: {
  title: string;
  href?: string;
  linkLabel?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className="flex items-center gap-2.5 text-base font-bold text-slate-900 sm:text-lg">
        {Icon && <Icon className="h-5 w-5 text-brand" aria-hidden="true" />}
        {title}
      </h2>
      {href && (
        <Link href={href} className="shrink-0 text-sm font-semibold text-brand hover:underline">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

/** Large empty state: icon tile, headline, explanation and next steps. */
export function EmptyState({ icon: Icon, badge: Badge, title, children, actions, className }: {
  icon: LucideIcon;
  badge?: LucideIcon;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-3xl border bg-white px-6 py-10 text-center shadow-sm sm:py-12', className)}>
      <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-brand-soft text-brand-strong">
        <Icon className="h-9 w-9" aria-hidden="true" />
        {Badge && (
          <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-flame shadow-md">
            <Badge className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <h2 className="mt-5 text-xl font-extrabold text-slate-900">{title}</h2>
      {children && <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500 sm:text-base">{children}</p>}
      {actions && <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">{actions}</div>}
    </section>
  );
}

/** Small dashed note used inside cards when a list is empty. */
export function QuietNote({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
      <p className="text-sm text-slate-500">
        <span className="block font-semibold text-slate-800">{title}</span>
        {children}
      </p>
    </div>
  );
}

/** Amber "Lessons coming soon" pill for courses with nothing published yet. */
export function ComingSoonPill({ className, short = false }: { className?: string; short?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700', className)}>
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      {short ? 'Coming soon' : 'Lessons coming soon'}
    </span>
  );
}

const LABS = [
  { href: '/student/labs/gst', icon: ReceiptIndianRupee, title: 'GST practice lab', text: 'Register and file GSTR-3B', tone: 'bg-orange-50 text-flame' },
  { href: '/student/labs/itr', icon: FileText, title: 'Income tax lab', text: 'Prepare an ITR-1 return', tone: 'bg-brand-soft text-brand-strong' },
  { href: '/student/labs/mca', icon: Building2, title: 'MCA lab', text: 'Company incorporation forms', tone: 'bg-indigo-50 text-indigo-600' },
];

/** The three practice labs, open to every student: rows on phones, tiles from sm up. */
export function LabShortcuts({ className }: { className?: string }) {
  return (
    <ul className={cn('grid gap-3 sm:grid-cols-3', className)}>
      {LABS.map(({ href, icon: Icon, title, text, tone }) => (
        <li key={href}>
          <Link
            href={href}
            className="flex h-full items-center gap-3.5 rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:flex-col sm:items-start"
          >
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tone)}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-900">{title}</span>
              <span className="block text-xs text-slate-500 sm:text-[13px]">{text}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 sm:hidden" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Round initials avatar (the design's profile photo until students have photos). */
export function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <span
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-strong text-sm font-bold text-white ring-2 ring-white shadow',
        className,
      )}
      aria-hidden="true"
    >
      {initials || 'S'}
    </span>
  );
}

/** Circular progress (My Performance "Test Average"). Shows a dash when there is no value. */
export function ProgressRing({ value, label, size = 136 }: { value?: number; label: string; size?: number }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value === undefined ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          className="stroke-brand transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-3xl font-extrabold text-slate-900">{value === undefined ? '–' : `${value}%`}</span>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
    </div>
  );
}
