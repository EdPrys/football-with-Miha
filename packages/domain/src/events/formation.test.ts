import { describe, it, expect } from 'vitest';
import {
  formationFor,
  formationOptionsFor,
  defaultFormationKey,
  isValidFormationKey,
  type LinePosition,
} from './formation.js';

const sum = (f: Record<LinePosition, number>) => f.GK + f.DEF + f.MID + f.FWD;

describe('formationFor', () => {
  it('always keeps exactly one keeper', () => {
    for (let n = 1; n <= 10; n++) expect(formationFor(n).GK).toBe(1);
  });
  it('slots sum to playersPerTeam', () => {
    for (let n = 1; n <= 10; n++) expect(sum(formationFor(n))).toBe(n);
  });
  it('6-a-side is 1-2-2 by default', () => {
    expect(formationFor(6)).toEqual({ GK: 1, DEF: 1, MID: 2, FWD: 2 });
  });
  it('picks the formation matching a given key', () => {
    const key = formationOptionsFor(6)[1]!.key; // 2-2-1
    expect(formationFor(6, key)).toEqual({ GK: 1, DEF: 2, MID: 2, FWD: 1 });
  });
  it('falls back to the default for an unknown key', () => {
    expect(formationFor(6, 'bogus')).toEqual(formationFor(6));
  });
});

describe('formationOptionsFor', () => {
  it('offers multiple curated options for common sizes', () => {
    expect(formationOptionsFor(6).length).toBeGreaterThan(1);
  });
  it('every option sums to playersPerTeam and has unique keys', () => {
    for (let n = 1; n <= 9; n++) {
      const opts = formationOptionsFor(n);
      const keys = new Set(opts.map((o) => o.key));
      expect(keys.size).toBe(opts.length);
      for (const o of opts) expect(sum(o.slots)).toBe(n);
    }
  });
});

describe('defaultFormationKey / isValidFormationKey', () => {
  it('default key is valid and matches the first option', () => {
    expect(defaultFormationKey(6)).toBe(formationOptionsFor(6)[0]!.key);
    expect(isValidFormationKey(6, defaultFormationKey(6))).toBe(true);
  });
  it('rejects a key that does not belong to that size', () => {
    expect(isValidFormationKey(6, 'not-a-key')).toBe(false);
  });
});
