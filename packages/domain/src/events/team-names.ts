const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Default team names for an event: "Team A", "Team B", ... */
export function teamNames(count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const letter = i < LETTERS.length ? LETTERS[i] : `${i + 1}`;
    return `Team ${letter}`;
  });
}
