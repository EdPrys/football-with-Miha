import { describe, it, expect } from 'vitest';
import { attendancePercent } from './attendance.js';

describe('attendancePercent', () => {
  it('is null with no settled matches', () => {
    expect(attendancePercent({ attended: 0, noShow: 0 })).toBeNull();
  });
  it('is 100 when never a no-show', () => {
    expect(attendancePercent({ attended: 5, noShow: 0 })).toBe(100);
  });
  it('rounds the ratio (11/12 -> 92)', () => {
    expect(attendancePercent({ attended: 11, noShow: 1 })).toBe(92);
  });
  it('is 0 when always a no-show', () => {
    expect(attendancePercent({ attended: 0, noShow: 3 })).toBe(0);
  });
});
