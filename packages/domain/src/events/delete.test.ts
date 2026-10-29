import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@app/db';
import { deleteEvent } from './manage.js';

function prismaWith(opts: { status?: string; players?: number; organizerId?: string }) {
  const tx = {
    $queryRaw: vi
      .fn()
      .mockResolvedValue([{ status: opts.status ?? 'UPCOMING', telegramMessageId: 42 }]),
    eventParticipant: { count: vi.fn().mockResolvedValue(opts.players ?? 0) },
    notification: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    event: { delete: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    event: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'e1',
        status: opts.status ?? 'UPCOMING',
        organizerId: opts.organizerId ?? 'org',
      }),
    },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { tx, prisma: prisma as unknown as PrismaClient };
}

describe('deleteEvent', () => {
  it('deletes an empty game and returns its Telegram post id', async () => {
    const { tx, prisma } = prismaWith({});
    await expect(deleteEvent(prisma, { eventId: 'e1', organizerId: 'org' })).resolves.toEqual({
      telegramMessageId: 42,
    });
    expect(tx.event.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
  });

  it('refuses once someone has joined', async () => {
    const { tx, prisma } = prismaWith({ players: 1 });
    await expect(deleteEvent(prisma, { eventId: 'e1', organizerId: 'org' })).rejects.toThrow(
      /nobody has joined/,
    );
    expect(tx.event.delete).not.toHaveBeenCalled();
  });

  it('refuses a finished game', async () => {
    const { prisma } = prismaWith({ status: 'FINISHED' });
    await expect(deleteEvent(prisma, { eventId: 'e1', organizerId: 'org' })).rejects.toThrow(
      /finished/,
    );
  });

  it('only lets the organizer delete', async () => {
    const { tx, prisma } = prismaWith({});
    await expect(deleteEvent(prisma, { eventId: 'e1', organizerId: 'someone' })).rejects.toThrow(
      /Only the organizer/,
    );
    expect(tx.event.delete).not.toHaveBeenCalled();
  });
});
