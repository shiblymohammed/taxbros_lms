import { sameEntry, type AttendanceEntry } from '@/components/attendance/status-picker';
import type { AttendanceRegister, AttendanceStatus, RegisterMark } from './api';

export type EntryMap = Record<string, AttendanceEntry>;

/** Entries as stored on the server for this register. */
export function entriesFromRegister(register: AttendanceRegister): EntryMap {
  return Object.fromEntries(
    register.students.map((s) => [s.studentId, { status: s.status ?? null, remarks: s.remarks ?? '' }]),
  );
}

/** Marks that are new or changed since the last save. Unmarked rows are never sent. */
export function changedMarks(entries: EntryMap, saved: EntryMap): RegisterMark[] {
  return Object.entries(entries)
    .filter(([id, e]) => e.status !== null && !sameEntry(e, saved[id]))
    .map(([studentId, e]) => ({
      studentId,
      status: e.status as AttendanceStatus,
      ...(e.remarks.trim() ? { remarks: e.remarks.trim() } : {}),
    }));
}
