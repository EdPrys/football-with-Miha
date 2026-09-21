import { describe, it, expect } from 'vitest';
import { roleAtLeast } from './roles.js';

describe('roleAtLeast', () => {
  it('admin satisfies every requirement', () => {
    expect(roleAtLeast('ADMIN', 'PLAYER')).toBe(true);
    expect(roleAtLeast('ADMIN', 'MANAGER')).toBe(true);
    expect(roleAtLeast('ADMIN', 'ADMIN')).toBe(true);
  });
  it('manager can play and create events but is not admin', () => {
    expect(roleAtLeast('MANAGER', 'PLAYER')).toBe(true);
    expect(roleAtLeast('MANAGER', 'MANAGER')).toBe(true);
    expect(roleAtLeast('MANAGER', 'ADMIN')).toBe(false);
  });
  it('player cannot manage or administer', () => {
    expect(roleAtLeast('PLAYER', 'PLAYER')).toBe(true);
    expect(roleAtLeast('PLAYER', 'MANAGER')).toBe(false);
    expect(roleAtLeast('PLAYER', 'ADMIN')).toBe(false);
  });
});
