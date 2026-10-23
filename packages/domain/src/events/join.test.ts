import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@app/db';
import { assertJoinable, joinEvent } from './join.js';
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

describe('joinEvent goalkeeper slot', () => {
  function prismaWith(keepersOnTeam: number) {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValue([{ id: 'e1', status: 'UPCOMING', numberOfTeams: 2, playersPerTeam: 5 }]),
      team: { findFirst: vi.fn().mockResolvedValue({ id: 't1' }) },
      eventParticipant: {
        // 1st count: team size, 2nd: goalkeepers on the team, 3rd: event total
        count: vi
          .fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(keepersOnTeam)
          .mockResolvedValue(1),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(({ data }) => Promise.resolve({ id: 'p1', ...data })),
        update: vi.fn(),
      },
    };
    const prisma = { $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)) };
    return { tx, prisma: prisma as unknown as PrismaClient };
  }

  it('rejects a second goalkeeper on the same team', async () => {
    const { tx, prisma } = prismaWith(1);
    await expect(
      joinEvent(prisma, { eventId: 'e1', userId: 'u2', position: 'GK', teamId: 't1' }),
    ).rejects.toThrow(/goalkeeper/);
    expect(tx.eventParticipant.create).not.toHaveBeenCalled();
  });

  it('lets the first goalkeeper join', async () => {
    const { tx, prisma } = prismaWith(0);
    await joinEvent(prisma, { eventId: 'e1', userId: 'u2', position: 'GK', teamId: 't1' });
    expect(tx.eventParticipant.create).toHaveBeenCalled();
  });
});
