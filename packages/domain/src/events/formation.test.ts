import { describe, it, expect } from 'vitest';
import { formationFor, type LinePosition } from './formation.js';

const sum = (f: Record<LinePosition, number>) => f.GK + f.DEF + f.MID + f.FWD;

describe('formationFor', () => {
  it('always keeps exactly one keeper', () => {
    for (let n = 1; n <= 10; n++) expect(formationFor(n).GK).toBe(1);
  });
  it('slots sum to playersPerTeam', () => {
    for (let n = 1; n <= 10; n++) expect(sum(formationFor(n))).toBe(n);
  });
  it('6-a-side is 1-2-2', () => {
    expect(formationFor(6)).toEqual({ GK: 1, DEF: 1, MID: 2, FWD: 2 });
  });
});
