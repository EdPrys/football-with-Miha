import { describe, it, expect } from 'vitest';
import { assertCanVoteMvp, pickMvpWinners } from './mvp.js';
import { DomainError } from '../errors.js';

const finishedAt = new Date('2026-10-24T22:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const ok = {
  eventStatus: 'FINISHED' as const,
  finishedAt,
  mvpResolved: false,
  now: new Date(finishedAt.getTime() + HOUR),
  isSelf: false,
  voterAttended: true,
  nomineeAttended: true,
  alreadyVoted: false,
};

describe('pickMvpWinners', () => {
  it('no votes → no MVP', () => {
    expect(pickMvpWinners([])).toEqual([]);
  });
  it('most votes wins', () => {
    expect(pickMvpWinners(['a', 'b', 'a', 'c', 'a'])).toEqual([{ userId: 'a', votes: 3 }]);
  });
  it('a tie makes every tied player MVP', () => {
    expect(pickMvpWinners(['a', 'b', 'b', 'a', 'c'])).toEqual([
      { userId: 'a', votes: 2 },
      { userId: 'b', votes: 2 },
    ]);
  });
});

describe('assertCanVoteMvp', () => {
  it('allows a co-player to vote within 24h', () => {
    expect(() => assertCanVoteMvp(ok)).not.toThrow();
  });
  it('forbids voting for yourself', () => {
    expect(() => assertCanVoteMvp({ ...ok, isSelf: true })).toThrow(/yourself/);
  });
  it('forbids voting twice', () => {
    expect(() => assertCanVoteMvp({ ...ok, alreadyVoted: true })).toThrow(/already/);
  });
  it('forbids voting before the finish, after 24h or once resolved', () => {
    expect(() => assertCanVoteMvp({ ...ok, eventStatus: 'IN_PROGRESS' })).toThrow(DomainError);
    expect(() =>
      assertCanVoteMvp({ ...ok, now: new Date(finishedAt.getTime() + 24 * HOUR + 1) }),
    ).toThrow(/closed/);
    expect(() => assertCanVoteMvp({ ...ok, mvpResolved: true })).toThrow(/closed/);
  });
  it('only players of the match vote and get votes', () => {
    expect(() => assertCanVoteMvp({ ...ok, voterAttended: false })).toThrow(DomainError);
    expect(() => assertCanVoteMvp({ ...ok, nomineeAttended: false })).toThrow(DomainError);
  });
});
