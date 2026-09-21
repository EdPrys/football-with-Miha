export type LinePosition = 'GK' | 'DEF' | 'MID' | 'FWD';
export type Formation = Record<LinePosition, number>;

// Fixed formations per team size (slots sum to playersPerTeam, GK always 1).
// 6-a-side is the classic 1-2-2 (GK + 1 DEF + 2 MID + 2 FWD).
const MAP: Record<number, Formation> = {
  1: { GK: 1, DEF: 0, MID: 0, FWD: 0 },
  2: { GK: 1, DEF: 0, MID: 1, FWD: 0 },
  3: { GK: 1, DEF: 1, MID: 0, FWD: 1 },
  4: { GK: 1, DEF: 1, MID: 1, FWD: 1 },
  5: { GK: 1, DEF: 2, MID: 1, FWD: 1 },
  6: { GK: 1, DEF: 1, MID: 2, FWD: 2 }, // 1-2-2
  7: { GK: 1, DEF: 2, MID: 2, FWD: 2 },
};

/** Slot counts per line for one team, always summing to playersPerTeam. */
export function formationFor(playersPerTeam: number): Formation {
  const known = MAP[playersPerTeam];
  if (known) return known;
  // Fallback: 1 GK + spread the outfielders across DEF/MID/FWD.
  const out = Math.max(0, playersPerTeam - 1);
  const def = Math.ceil(out / 3);
  const mid = Math.ceil((out - def) / 2);
  const fwd = out - def - mid;
  return { GK: 1, DEF: def, MID: mid, FWD: fwd };
}
