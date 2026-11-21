/** Average of the students' attendance percentages; students with no marked days are left out. */
export function averageAttendance(rows: Array<{ percentage?: number | null }>): string {
  const values = rows.map((r) => r.percentage).filter((p): p is number => typeof p === 'number' && Number.isFinite(p));
  if (values.length === 0) return 'N/A';
  return `${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)}%`;
}
