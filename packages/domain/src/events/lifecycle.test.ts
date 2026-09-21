import { describe, it, expect } from 'vitest';
import { canTransition, assertTransition } from './lifecycle.js';
import { DomainError } from '../errors.js';

describe('event lifecycle', () => {
  it('allows the happy path UPCOMING -> IN_PROGRESS -> FINISHED', () => {
    expect(canTransition('UPCOMING', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'FINISHED')).toBe(true);
  });
  it('allows cancelling from UPCOMING or IN_PROGRESS', () => {
    expect(canTransition('UPCOMING', 'CANCELLED')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'CANCELLED')).toBe(true);
  });
  it('forbids skipping states and reviving terminals', () => {
    expect(canTransition('UPCOMING', 'FINISHED')).toBe(false);
    expect(canTransition('FINISHED', 'IN_PROGRESS')).toBe(false);
    expect(canTransition('CANCELLED', 'UPCOMING')).toBe(false);
  });
  it('assertTransition throws on an illegal move', () => {
    expect(() => assertTransition('UPCOMING', 'FINISHED')).toThrow(DomainError);
  });
});
