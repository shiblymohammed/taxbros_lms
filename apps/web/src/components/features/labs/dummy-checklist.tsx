'use client';

import { ClipboardCheck } from 'lucide-react';

interface DummyChecklistProps {
  items: string[];
  checked: Record<string, boolean>;
  onChange: (item: string, value: boolean) => void;
  error?: string;
}

/**
 * Dummy document checklist (SRS R09 simulation workflows).
 * Learners confirm they have "reviewed" each fictional document. No files are
 * uploaded and nothing is verified against any real system.
 */
export function DummyChecklist({ items, checked, onChange, error }: DummyChecklistProps) {
  return (
    <fieldset className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-gray-900">
        <ClipboardCheck className="h-4 w-4 text-gray-700" />
        Dummy document checklist
      </legend>
      <p className="mb-3 text-xs text-gray-600">
        Tick each item to confirm you reviewed the fictional document. Do not upload real documents.
      </p>
      <ul className="space-y-1">
        {items.map((item) => {
          const id = `doc-${item.replace(/\W+/g, '-').toLowerCase()}`;
          return (
            <li key={item}>
              <label
                htmlFor={id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-white"
              >
                <input
                  id={id}
                  type="checkbox"
                  className="h-5 w-5 shrink-0 accent-brand"
                  checked={!!checked[item]}
                  onChange={(e) => onChange(item, e.target.checked)}
                />
                <span className="text-sm text-gray-800">{item}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function allChecked(items: string[], checked: Record<string, boolean>): boolean {
  return items.every((i) => checked[i]);
}
