import { describe, it, expect } from 'vitest';
import { assertRatable } from './submit.js';
import { DomainError } from '../errors.js';

const ok = {
  eventStatus: 'FINISHED' as const,
  isSelf: false,
  raterAttended: true,
  rateeAttended: true,
  alreadyRated: false,
};

describe('assertRatable', () => {
  it('allows rating a co-attendee after the match', () => {
    expect(() => assertRatable(ok)).not.toThrow();
  });
  it('forbids rating yourself', () => {
    expect(() => assertRatable({ ...ok, isSelf: true })).toThrow(/yourself/);
  });
  it('forbids rating before the event is finished', () => {
    expect(() => assertRatable({ ...ok, eventStatus: 'IN_PROGRESS' })).toThrow(/finished/);
  });
  it('forbids rating someone who did not attend', () => {
    expect(() => assertRatable({ ...ok, rateeAttended: false })).toThrow(DomainError);
    expect(() => assertRatable({ ...ok, raterAttended: false })).toThrow(DomainError);
  });
  it('forbids rating the same player twice', () => {
    expect(() => assertRatable({ ...ok, alreadyRated: true })).toThrow(/already/);
  });
});
