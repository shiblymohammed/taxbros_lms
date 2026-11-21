'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { studentsListApi, type StudentListItem } from '@/lib/admin-api';
import { getApiErrorMessage } from '@/lib/lab-validation';

interface StudentPickerProps {
  /** Student profile IDs already added (shown as added, can't be picked again). */
  excludeIds: Set<string>;
  onPick: (studentProfileId: string) => Promise<void>;
  label?: string;
}

/** Search active students by name or email and add one (used for class rosters and course enrolments). */
export function StudentPicker({ excludeIds, onPick, label = 'Add students' }: StudentPickerProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        // GET /students is open to staff who manage students, classes or courses
        const page = await studentsListApi.list({ search: search.trim() || undefined, activeOnly: true, limit: 20 });
        if (!cancelled) setResults(page.data);
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, 'Could not search students'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search]);

  const pick = async (student: StudentListItem) => {
    const id = student.id;
    setAdding(id);
    try {
      await onPick(id);
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="space-y-2">
      <label className="relative block">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <Search className="pointer-events-none absolute bottom-3.5 left-3 h-4 w-4 text-gray-400 sm:bottom-3" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search active students by name, email or admission ID"
          className="mt-1.5 pl-9"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="max-h-64 divide-y overflow-y-auto rounded-md border" aria-busy={loading}>
        {loading && results.length === 0 ? (
          <li className="flex justify-center p-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </li>
        ) : results.length === 0 ? (
          <li className="p-4 text-center text-sm text-gray-500">No active students found.</li>
        ) : (
          results.map((s) => {
            const already = excludeIds.has(s.id);
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 p-2 pl-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {s.firstName} {s.lastName}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {s.admissionId} · {s.user.email}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant={already ? 'ghost' : 'outline'}
                  disabled={already || adding !== null}
                  onClick={() => pick(s)}
                  className="shrink-0 gap-1"
                  aria-label={already ? `${s.firstName} ${s.lastName} already added` : `Add ${s.firstName} ${s.lastName}`}
                >
                  {adding === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : already ? null : <Plus className="h-4 w-4" />}
                  {already ? 'Added' : 'Add'}
                </Button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
