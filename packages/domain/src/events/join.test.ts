import { describe, it, expect } from 'vitest';
import { assertJoinable } from './join.js';
import { DomainError } from '../errors.js';

const base = { status: 'UPCOMING' as const, capacity: 10, activeCount: 4, alreadyActive: false };

describe('assertJoinable', () => {
  it('allows joining an open event with free slots', () => {
    expect(() => assertJoinable(base)).not.toThrow();
  });
  it('rejects when already an active participant', () => {
    expect(() => assertJoinable({ ...base, alreadyActive: true })).toThrow(DomainError);
  });
  it('rejects a full event', () => {
    expect(() => assertJoinable({ ...base, activeCount: 10 })).toThrow(/full/);
  });
  it('rejects a non-upcoming event', () => {
    expect(() => assertJoinable({ ...base, status: 'FINISHED' })).toThrow(/not open/);
    expect(() => assertJoinable({ ...base, status: 'CANCELLED' })).toThrow(/not open/);
    expect(() => assertJoinable({ ...base, status: 'IN_PROGRESS' })).toThrow(/not open/);
  });
});
