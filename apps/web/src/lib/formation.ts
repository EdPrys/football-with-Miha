// Mirror of packages/domain/src/events/formation.ts (the tested source of truth).
// Kept local so the browser bundle doesn't pull the domain barrel.
export type LinePosition = 'GK' | 'DEF' | 'MID' | 'FWD';
export type Formation = Record<LinePosition, number>;

export interface FormationOption {
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

const CATALOG: Record<number, FormationOption[]> = {
  1: [option(0, 0, 0)],
  2: [option(0, 1, 0)],
  3: [option(1, 0, 1), option(1, 1, 0), option(0, 1, 1)],
  4: [option(1, 1, 1), option(2, 0, 1), option(1, 0, 2)],
  5: [option(2, 1, 1), option(1, 2, 1), option(1, 1, 2)],
  6: [option(1, 2, 2), option(2, 2, 1), option(2, 1, 2)],
  7: [option(2, 2, 2), option(3, 2, 1), option(2, 3, 1)],
};

function generatedOption(playersPerTeam: number): FormationOption {
  const out = Math.max(0, playersPerTeam - 1);
  const def = Math.ceil(out / 3);
  const mid = Math.ceil((out - def) / 2);
  const fwd = out - def - mid;
  return option(def, mid, fwd);
}

export function formationOptionsFor(playersPerTeam: number): FormationOption[] {
  return CATALOG[playersPerTeam] ?? [generatedOption(playersPerTeam)];
}

export function defaultFormationKey(playersPerTeam: number): string {
  return formationOptionsFor(playersPerTeam)[0].key;
}

export function formationFor(playersPerTeam: number, formationKey?: string | null): Formation {
  const options = formationOptionsFor(playersPerTeam);
  const match = formationKey ? options.find((o) => o.key === formationKey) : undefined;
  return (match ?? options[0]).slots;
}
