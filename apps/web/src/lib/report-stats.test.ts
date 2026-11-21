import { describe, expect, it } from 'vitest';
import { averageAttendance } from './report-stats';

describe('averageAttendance', () => {
  it('averages only students with a percentage', () => {
    expect(averageAttendance([{ percentage: 80 }, { percentage: 90 }, { percentage: null }])).toBe('85.00%');
  });
  it('shows N/A instead of NaN when nobody has marked days', () => {
    expect(averageAttendance([{ percentage: null }, {}])).toBe('N/A');
    expect(averageAttendance([])).toBe('N/A');
  });
});
