export type LinePosition = 'GK' | 'DEF' | 'MID' | 'FWD';
export type Formation = Record<LinePosition, number>;

export interface FormationOption {
  /** "DEF-MID-FWD" (GK omitted, always 1). Unique within one playersPerTeam size. */
  key: string;
  slots: Formation;
}

const slots = (def: number, mid: number, fwd: number): Formation => ({
  GK: 1,
  DEF: def,
  MID: mid,
  FWD: fwd,
});
const option = (def: number, mid: number, fwd: number): FormationOption => ({
  key: `${def}-${mid}-${fwd}`,
  slots: slots(def, mid, fwd),
});

// Curated formation choices per team size. First entry is the default
// (matches the formation this app used before selection existed).
const CATALOG: Record<number, FormationOption[]> = {
  1: [option(0, 0, 0)],
  2: [option(0, 1, 0)],
  3: [option(1, 0, 1), option(1, 1, 0), option(0, 1, 1)],
  4: [option(1, 1, 1), option(2, 0, 1), option(1, 0, 2)],
  5: [option(2, 1, 1), option(1, 2, 1), option(1, 1, 2)],
  6: [option(1, 2, 2), option(2, 2, 1), option(2, 1, 2)], // 1-2-2 is the classic 6-a-side default
  7: [option(2, 2, 2), option(3, 2, 1), option(2, 3, 1)],
};

/** Fallback for sizes outside the curated catalog: 1 GK + outfielders spread across DEF/MID/FWD. */
function generatedOption(playersPerTeam: number): FormationOption {
  const out = Math.max(0, playersPerTeam - 1);
  const def = Math.ceil(out / 3);
  const mid = Math.ceil((out - def) / 2);
  const fwd = out - def - mid;
  return option(def, mid, fwd);
}

/** All selectable formations for a team size; first is the default. */
export function formationOptionsFor(playersPerTeam: number): FormationOption[] {
  return CATALOG[playersPerTeam] ?? [generatedOption(playersPerTeam)];
}

export function defaultFormationKey(playersPerTeam: number): string {
  return formationOptionsFor(playersPerTeam)[0]!.key;
}

export function isValidFormationKey(playersPerTeam: number, key: string): boolean {
  return formationOptionsFor(playersPerTeam).some((o) => o.key === key);
}

/** Slot counts per line for one team. Falls back to the default formation if key is missing/invalid. */
export function formationFor(playersPerTeam: number, formationKey?: string | null): Formation {
  const options = formationOptionsFor(playersPerTeam);
  const match = formationKey ? options.find((o) => o.key === formationKey) : undefined;
  return (match ?? options[0]!).slots;
}
