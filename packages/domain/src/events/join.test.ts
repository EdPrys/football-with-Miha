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

describe('joinEvent opening a new team', () => {
  function prismaWith(event: { numberOfTeams: number; status?: string }, activeCount: number) {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValue([{ id: 'e1', status: 'UPCOMING', playersPerTeam: 5, ...event }]),
      team: { create: vi.fn(({ data }) => Promise.resolve({ id: 'new-team', ...data })) },
      event: { update: vi.fn().mockResolvedValue({}) },
      eventParticipant: {
        count: vi.fn().mockResolvedValue(activeCount),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(({ data }) => Promise.resolve({ id: 'p1', ...data })),
        update: vi.fn(),
      },
    };
    const prisma = { $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)) };
    return { tx, prisma: prisma as unknown as PrismaClient };
  }
  const join = { eventId: 'e1', userId: 'u9', position: 'MID' as const, newTeam: true };

  it('adds Team C to a full 2-team game and puts the player in it', async () => {
    const { tx, prisma } = prismaWith({ numberOfTeams: 2 }, 10);
    const p = await joinEvent(prisma, join);
    expect(tx.team.create).toHaveBeenCalledWith({ data: { eventId: 'e1', name: 'Team C' } });
    expect(tx.event.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { numberOfTeams: 3 },
    });
    expect(p.teamId).toBe('new-team');
  });

  it('refuses while the current teams still have free places', async () => {
    const { tx, prisma } = prismaWith({ numberOfTeams: 2 }, 9);
    await expect(joinEvent(prisma, join)).rejects.toThrow(/free places/);
    expect(tx.team.create).not.toHaveBeenCalled();
  });

  it('stops at the maximum number of teams', async () => {
    const { tx, prisma } = prismaWith({ numberOfTeams: 4 }, 20);
    await expect(joinEvent(prisma, join)).rejects.toThrow(/maximum number of teams/);
    expect(tx.team.create).not.toHaveBeenCalled();
  });

  it('refuses for a game that is no longer upcoming', async () => {
    const { prisma } = prismaWith({ numberOfTeams: 2, status: 'IN_PROGRESS' }, 10);
    await expect(joinEvent(prisma, join)).rejects.toThrow(/not open/);
  });
});
