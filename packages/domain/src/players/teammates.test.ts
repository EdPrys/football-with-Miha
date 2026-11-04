import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@app/db';
import { teammatesFor } from './teammates.js';

function setup(groups: { userId: string; _count: { _all: number } }[] = []) {
  const db = {
    eventParticipant: { groupBy: vi.fn().mockResolvedValue(groups) },
    user: {
      findMany: vi.fn().mockResolvedValue(
        groups.map((g) => ({
          id: g.userId,
          name: g.userId,
          avatarUrl: null,
          city: { name: 'Київ' },
        })),
      ),
    },
    rating: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { db, prisma: db as unknown as PrismaClient };
}

describe('co-players', () => {
  it('requires both players to have attended a finished game and excludes self, regardless of team', async () => {
    const { db, prisma } = setup();
    expect(await teammatesFor(prisma, 'me', 0)).toEqual({ items: [], hasMore: false });
    expect(db.eventParticipant.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: { not: 'me' },
          status: 'ATTENDED',
          event: {
            status: 'FINISHED',
            participants: { some: { userId: 'me', status: 'ATTENDED' } },
          },
        },
      }),
    );
  });
  it('returns each player once with shared count and only public identity data', async () => {
    const { prisma } = setup([{ userId: 'a', _count: { _all: 3 } }]);
    const result = await teammatesFor(prisma, 'me', 0);
    expect(result.items).toEqual([
      {
        id: 'a',
        name: 'a',
        avatarUrl: null,
        city: { name: 'Київ' },
        sharedMatches: 3,
        stars: { average: null, count: 0 },
      },
    ]);
  });
  it('bounds pages and excludes the lookahead player from returned identities', async () => {
    const { db, prisma } = setup(
      Array.from({ length: 25 }, (_, i) => ({ userId: `p${i}`, _count: { _all: 25 - i } })),
    );
    const result = await teammatesFor(prisma, 'me', 1);
    expect(result.items).toHaveLength(24);
    expect(result.hasMore).toBe(true);
    expect(db.eventParticipant.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 24,
        take: 25,
        orderBy: [{ _count: { userId: 'desc' } }, { userId: 'asc' }],
      }),
    );
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: Array.from({ length: 24 }, (_, i) => `p${i}`) } },
      }),
    );
  });
});
