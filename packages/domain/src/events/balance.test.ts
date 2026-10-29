import { describe, it, expect } from 'vitest';
import { balanceTeams, type BalancePlayer } from './balance.js';

const outfield = (id: string, rating: number): BalancePlayer => ({ id, rating, goalkeeper: false });
const keeper = (id: string, rating: number): BalancePlayer => ({ id, rating, goalkeeper: true });

function teamTotals(players: BalancePlayer[], teamCount: number, random?: () => number) {
  const slots = balanceTeams(players, teamCount, random);
  const rating = new Map(players.map((p) => [p.id, p.rating]));
  const totals = Array.from({ length: teamCount }, () => 0);
  const sizes = Array.from({ length: teamCount }, () => 0);
  for (const s of slots) {
    totals[s.team]! += rating.get(s.id)!;
    sizes[s.team]! += 1;
  }
  return { slots, totals, sizes };
}

describe('balanceTeams', () => {
  it('splits players into teams of equal strength', () => {
    const players = [5, 5, 4, 4, 3, 3, 2, 2].map((r, i) => outfield(`p${i}`, r));
    const { totals, sizes } = teamTotals(players, 2);
    expect(totals).toEqual([14, 14]);
    expect(sizes).toEqual([4, 4]);
  });

  it('does not stack the two best players together', () => {
    const players = [outfield('a', 5), outfield('b', 5), outfield('c', 1), outfield('d', 1)];
    const { slots } = teamTotals(players, 2);
    const team = (id: string) => slots.find((s) => s.id === id)!.team;
    expect(team('a')).not.toBe(team('b'));
  });

  it('keeps team sizes within one of each other', () => {
    const players = Array.from({ length: 11 }, (_, i) => outfield(`p${i}`, i === 0 ? 5 : 1));
    const { sizes } = teamTotals(players, 3);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it('gives each team at most one goalkeeper; extra keepers play outfield', () => {
    const players = [
      keeper('k1', 4),
      keeper('k2', 3),
      keeper('k3', 2),
      ...[4, 4, 3].map((r, i) => outfield(`p${i}`, r)),
    ];
    const { slots } = teamTotals(players, 2);
    const keepers = slots.filter((s) => s.goalkeeper);
    expect(keepers).toHaveLength(2);
    expect(new Set(keepers.map((s) => s.team)).size).toBe(2);
    expect(slots.find((s) => s.id === 'k3')!.goalkeeper).toBe(false);
  });

  it('places every player exactly once', () => {
    const players = Array.from({ length: 7 }, (_, i) => outfield(`p${i}`, (i % 5) + 1));
    const { slots } = teamTotals(players, 2);
    expect(slots.map((s) => s.id).sort()).toEqual(players.map((p) => p.id).sort());
  });

  it('can give a different split for equal ratings when run again', () => {
    const players = Array.from({ length: 6 }, (_, i) => outfield(`p${i}`, 3));
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const splits = new Set(
      Array.from({ length: 10 }, () =>
        balanceTeams(players, 2, random)
          .filter((s) => s.team === 0)
          .map((s) => s.id)
          .sort()
          .join(','),
      ),
    );
    expect(splits.size).toBeGreaterThan(1);
  });
});
