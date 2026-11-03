import { describe, expect, it, vi } from 'vitest';
import type { Context } from '../context.js';
import { eventsRouter } from './events.js';
import { notificationsRouter } from './notifications.js';

function setup(role: 'PLAYER' | 'MANAGER' | 'ADMIN' | null) {
  const prisma = {
    city: { findUnique: vi.fn().mockResolvedValue({ id: 'kyiv' }) },
    cityGameSubscription: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    event: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() },
  };
  const ctx = { prisma, user: role ? { id: 'caller', role } : null } as unknown as Context;
  return {
    prisma,
    events: eventsRouter.createCaller(ctx),
    notifications: notificationsRouter.createCaller(ctx),
  };
}

describe('discovery API access and scope', () => {
  it('requires authentication for subscriptions', async () => {
    const { notifications, prisma } = setup(null);
    await expect(
      notifications.subscribeCity({ cityId: 'kyiv', subscribed: true }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(notifications.gameSubscriptions()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(prisma.cityGameSubscription.upsert).not.toHaveBeenCalled();
  });
  it('reads and changes subscriptions only for the authenticated user', async () => {
    const { notifications, prisma } = setup('PLAYER');
    await notifications.subscribeCity({ cityId: 'kyiv', subscribed: true });
    expect(prisma.cityGameSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { userId: 'caller', cityId: 'kyiv' } }),
    );
    await notifications.gameSubscriptions();
    expect(prisma.cityGameSubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'caller' } }),
    );
  });
  it('scopes public discovery to the selected city without hiding the other filters', async () => {
    const { events, prisma } = setup(null);
    await events.list({ cityId: 'kyiv', playersPerTeam: 5 });
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'UPCOMING',
          field: { venue: { cityId: 'kyiv' } },
          playersPerTeam: 5,
        }),
      }),
    );
  });
  it('requires manager privileges before reading a repeat template', async () => {
    const { events, prisma } = setup('PLAYER');
    await expect(events.repeatTemplate({ eventId: 'e1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prisma.event.findUnique).not.toHaveBeenCalled();
  });
  it('rejects invalid organizer detail inputs at the API boundary', async () => {
    const { events } = setup('MANAGER');
    const input = {
      fieldId: 'f1',
      startAt: new Date('2035-01-01'),
      endAt: new Date('2035-01-02'),
      numberOfTeams: 2,
      playersPerTeam: 5,
    };
    for (const details of [
      { priceMinor: -1 },
      { priceMinor: 0.5 },
      { newcomerInfo: 'x'.repeat(2001) },
      { level: 'ELITE' },
    ]) {
      await expect(
        events.create({ ...input, ...details } as Parameters<typeof events.create>[0]),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    }
  });
});
