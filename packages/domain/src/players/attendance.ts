/**
 * Attendance % across finished events the player was part of.
 * Considers only settled participations (ATTENDED vs NO_SHOW).
 * Returns null when there is nothing to measure yet.
 */
export function attendancePercent(input: { attended: number; noShow: number }): number | null {
  const total = input.attended + input.noShow;
  if (total === 0) return null;
  return Math.round((input.attended / total) * 100);
}
