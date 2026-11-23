'use client';

import { Check } from 'lucide-react';
import { AttendanceStatus } from '@/lib/api';

/** Shared Present/Absent/Late controls for the class register and staff attendance screens (R7, R8, R34). */
export const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string; short: string; active: string }> = [
  { value: AttendanceStatus.PRESENT, label: 'Present', short: 'P', active: 'bg-green-600 text-white border-green-600' },
  { value: AttendanceStatus.ABSENT, label: 'Absent', short: 'A', active: 'bg-red-600 text-white border-red-600' },
  { value: AttendanceStatus.LATE, label: 'Late', short: 'L', active: 'bg-amber-500 text-white border-amber-500' },
];

export interface AttendanceEntry {
  status: AttendanceStatus | null;
  remarks: string;
}

export function sameEntry(a?: AttendanceEntry, b?: AttendanceEntry) {
  return (a?.status ?? null) === (b?.status ?? null) && (a?.remarks ?? '') === (b?.remarks ?? '');
}

interface StatusPickerProps {
  label: string;
  value: AttendanceStatus | null;
  onChange: (status: AttendanceStatus) => void;
  disabled?: boolean;
}

/** Three 44px radio buttons; full labels from the sm breakpoint, P/A/L on phones. */
export function StatusPicker({ label, value, onChange, disabled }: StatusPickerProps) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
      {STATUS_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.label}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`h-11 min-w-11 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50 ${
              selected ? opt.active : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span className="sm:hidden" aria-hidden="true">{opt.short}</span>
            <span className="hidden sm:inline" aria-hidden="true">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function RemarksInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      aria-label={label}
      value={value}
      maxLength={500}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Optional remarks"
      className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
    />
  );
}

export function AttendanceLegend() {
  const swatches = [
    ['bg-amber-50 border-amber-200', 'Unmarked'],
    ['bg-green-600 border-green-600', 'Present'],
    ['bg-red-600 border-red-600', 'Absent'],
    ['bg-amber-500 border-amber-500', 'Late'],
  ];
  return (
    <div className="mt-6 flex flex-wrap gap-4 text-sm">
      {swatches.map(([swatch, label]) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`h-4 w-4 rounded border ${swatch}`} />
          <span className="text-gray-600">{label}</span>
        </div>
      ))}
      <span className="flex items-center gap-1 text-gray-600">
        <Check className="h-4 w-4 text-green-600" /> Saved
      </span>
    </div>
  );
}
