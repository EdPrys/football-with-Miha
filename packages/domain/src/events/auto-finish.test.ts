import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@app/db';
import { finishOverdueEvents, AUTO_FINISH_GRACE_MINUTES } from './manage.js';

const NOW = new Date('2026-10-24T20:00:00.000Z');

function prismaWith(overdue: { id: string; players: number }[], claimable = true) {
  const tx = {
    event: {
      updateMany: vi.fn().mockResolvedValue({ count: claimable ? 1 : 0 }),
      findUniqueOrThrow: vi.fn(({ where }) =>
        Promise.resolve({ id: where.id, startAt: new Date('2026-10-24T16:00:00.000Z') }),
      ),
    },
    eventParticipant: { updateMany: vi.fn() },
  };
  const prisma = {
    event: {
      findMany: vi
        .fn()
        .mockResolvedValue(overdue.map((e) => ({ id: e.id, _count: { participants: e.players } }))),
      updateMany: vi.fn().mockResolvedValue({ count: claimable ? 1 : 0 }),
    },
    eventParticipant: {
      findMany: vi.fn().mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]),
    },
    notification: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { tx, prisma, client: prisma as unknown as PrismaClient };
}

describe('finishOverdueEvents', () => {
  it('only looks at open games that ended more than the grace period ago', async () => {
    const { prisma, client } = prismaWith([]);
    await finishOverdueEvents(client, NOW);
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { in: ['UPCOMING', 'IN_PROGRESS'] },
          endAt: { lt: new Date(NOW.getTime() - AUTO_FINISH_GRACE_MINUTES * 60 * 1000) },
        },
      }),
    );
  });

  it('finishes games with players: ATTENDED, finishedAt set, players notified', async () => {
    const { tx, prisma, client } = prismaWith([{ id: 'e1', players: 2 }]);
    const result = await finishOverdueEvents(client, NOW);

    expect(result).toEqual({ finished: ['e1'], cancelled: [] });
    expect(tx.event.updateMany).toHaveBeenCalledWith({
      where: { id: 'e1', status: { in: ['UPCOMING', 'IN_PROGRESS'] } },
      data: { status: 'FINISHED', finishedAt: expect.any(Date) },
    });
    expect(tx.eventParticipant.updateMany).toHaveBeenCalledWith({
      where: { eventId: 'e1', status: 'JOINED' },
      data: { status: 'ATTENDED' },
    });
    expect(prisma.notification.createMany).toHaveBeenCalled();
  });

  it('cancels games nobody joined', async () => {
    const { tx, prisma, client } = prismaWith([{ id: 'e2', players: 0 }]);
    const result = await finishOverdueEvents(client, NOW);

    expect(result).toEqual({ finished: [], cancelled: ['e2'] });
    expect(prisma.event.updateMany).toHaveBeenCalledWith({
      where: { id: 'e2', status: { in: ['UPCOMING', 'IN_PROGRESS'] } },
      data: { status: 'CANCELLED' },
    });
    expect(tx.eventParticipant.updateMany).not.toHaveBeenCalled();
  });

  it('does nothing when the game was finished in the meantime', async () => {
    const { tx, prisma, client } = prismaWith([{ id: 'e3', players: 4 }], false);
    const result = await finishOverdueEvents(client, NOW);

    expect(result).toEqual({ finished: [], cancelled: [] });
    expect(tx.eventParticipant.updateMany).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});
