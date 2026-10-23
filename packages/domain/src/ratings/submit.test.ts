import { describe, it, expect } from 'vitest';
import { assertRatable, ratingClosesAt } from './submit.js';
import { DomainError } from '../errors.js';

const finishedAt = new Date('2026-10-23T20:00:00.000Z');
const HOUR = 60 * 60 * 1000;

const ok = {
  eventStatus: 'FINISHED' as const,
  finishedAt,
  now: new Date(finishedAt.getTime() + HOUR),
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
  it('allows rating up to exactly 24 hours after the finish', () => {
    expect(() =>
      assertRatable({ ...ok, now: new Date(finishedAt.getTime() + 24 * HOUR) }),
    ).not.toThrow();
  });
  it('closes rating after 24 hours', () => {
    expect(() =>
      assertRatable({ ...ok, now: new Date(finishedAt.getTime() + 24 * HOUR + 1) }),
    ).toThrow(/24 hours/);
  });
});

describe('ratingClosesAt', () => {
  it('is 24h after the finish, or null while not finished', () => {
    expect(ratingClosesAt(finishedAt)?.toISOString()).toBe('2026-10-24T20:00:00.000Z');
    expect(ratingClosesAt(null)).toBeNull();
  });
});
