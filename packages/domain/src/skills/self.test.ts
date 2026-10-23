import { describe, it, expect } from 'vitest';
import { assertValidSkills, type SkillValues } from './self.js';

const valid: SkillValues = {
  PACE: 72,
  DRIBBLING: 1,
  PASSING: 100,
  SHOOTING: 55,
  DEFENDING: 40,
  PHYSICAL: 63,
};

describe('assertValidSkills', () => {
  it('accepts whole numbers 1–100 for every skill', () => {
    expect(() => assertValidSkills(valid)).not.toThrow();
  });
  it.each([0, 101, 72.5])('rejects %s', (v) => {
    expect(() => assertValidSkills({ ...valid, PACE: v })).toThrow(/1 to 100/);
  });
});
