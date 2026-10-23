import { describe, it, expect } from 'vitest';
import { assertValidSkills, type SkillValues } from './self.js';

const valid: SkillValues = {
  PACE: 3,
  DRIBBLING: 4,
  PASSING: 5,
  SHOOTING: 1,
  DEFENDING: 2,
  PHYSICAL: 3,
};

describe('assertValidSkills', () => {
  it('accepts whole numbers 1–5 for every skill', () => {
    expect(() => assertValidSkills(valid)).not.toThrow();
  });
  it.each([0, 6, 2.5])('rejects %s', (v) => {
    expect(() => assertValidSkills({ ...valid, PACE: v })).toThrow(/1 to 5/);
  });
});
