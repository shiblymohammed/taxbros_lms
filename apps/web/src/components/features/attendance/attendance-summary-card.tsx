import { Card } from '@/components/ui/card';

export interface AttendanceCounts {
  total: number;
  marked: number;
  present: number;
  absent: number;
  late: number;
  unmarked: number;
}

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** Today's attendance for one group (students or staff): marked share, then the status breakdown. */
export function AttendanceSummaryCard({ title, totalLabel, counts }: { title: string; totalLabel: string; counts: AttendanceCounts }) {
  const markedPct = percent(counts.marked, counts.total);
  const segments = [
    { key: 'present', label: 'Present', value: counts.present, bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
    { key: 'late', label: 'Late', value: counts.late, bar: 'bg-amber-400', dot: 'bg-amber-400' },
    { key: 'absent', label: 'Absent', value: counts.absent, bar: 'bg-red-500', dot: 'bg-red-500' },
    { key: 'unmarked', label: 'Unmarked', value: counts.unmarked, bar: 'bg-slate-200', dot: 'bg-slate-300' },
  ];

  return (
    <Card className="p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {totalLabel}: <span className="font-medium text-slate-700">{counts.total}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums text-slate-900">{markedPct}%</p>
          <p className="text-xs text-slate-500">
            {counts.marked} of {counts.total} marked
          </p>
        </div>
      </div>

      <div
        className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={`${counts.present} present, ${counts.late} late, ${counts.absent} absent, ${counts.unmarked} unmarked`}
      >
        {counts.total > 0 &&
          segments.map((s) =>
            s.value > 0 ? <div key={s.key} className={s.bar} style={{ width: `${percent(s.value, counts.total)}%` }} /> : null,
          )}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {segments.map((s) => (
          <div key={s.key} className="rounded-lg bg-slate-50 px-3 py-2.5">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden="true" />
              {s.label}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{s.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
