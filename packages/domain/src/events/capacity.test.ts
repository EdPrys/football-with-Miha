import { describe, it, expect } from 'vitest';
import { eventCapacity } from './capacity.js';
import { teamNames } from './team-names.js';

describe('eventCapacity', () => {
  it('derives capacity from format (5v5 -> 10)', () => {
    expect(eventCapacity({ numberOfTeams: 2, playersPerTeam: 5 })).toBe(10);
  });
  it('handles 3 teams of 6', () => {
    expect(eventCapacity({ numberOfTeams: 3, playersPerTeam: 6 })).toBe(18);
  });
});

describe('teamNames', () => {
  it('names 2 teams A and B', () => {
    expect(teamNames(2)).toEqual(['Team A', 'Team B']);
  });
  it('names 4 teams A..D', () => {
    expect(teamNames(4)).toEqual(['Team A', 'Team B', 'Team C', 'Team D']);
  });
});
