import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@app/db';
import { createEvent } from './create.js';
import { repeatEventTemplate } from './repeat.js';
import { setCityGameSubscription } from '../notifications/subscriptions.js';

function setup() {
  const tx = {
    field: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'f1',
        isActive: true,
        venue: { cityId: 'kyiv', name: 'Поле', city: { name: 'Київ' } },
      }),
    },
    event: { create: vi.fn(({ data }) => Promise.resolve({ id: 'e2', ...data })) },
    cityGameSubscription: { findMany: vi.fn().mockResolvedValue([{ userId: 'u2' }]) },
    notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  } as unknown as PrismaClient;
  return { prisma, tx };
}
const input = {
  organizerId: 'u1',
  fieldId: 'f1',
  startAt: new Date('2035-06-01T15:00:00Z'),
  endAt: new Date('2035-06-01T16:00:00Z'),
  numberOfTeams: 2,
  playersPerTeam: 5,
};

describe('game discovery creation', () => {
  it('keeps unknown details null, creates empty teams, and notifies only subscribers in the field city', async () => {
    const { prisma, tx } = setup();
    const event = await createEvent(prisma, input);
    expect(event).toMatchObject({ priceMinor: null, level: null, newcomerInfo: null });
    expect(tx.event.create.mock.calls[0]?.[0].data).toMatchObject({
      teams: { create: [{ name: 'Team A' }, { name: 'Team B' }] },
    });
    expect(tx.cityGameSubscription.findMany).toHaveBeenCalledWith({
      where: { cityId: 'kyiv', userId: { not: 'u1' } },
      select: { userId: true },
    });
    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'u2',
          type: 'EVENT_CREATED',
          payload: {
            eventId: 'e2',
            eventStartAt: input.startAt.toISOString(),
            cityName: 'Київ',
            venueName: 'Поле',
          },
        },
      ],
    });
  });
  it('preserves a free game and explicit organizer details', async () => {
    const { prisma } = setup();
    await expect(
      createEvent(prisma, {
        ...input,
        priceMinor: 0,
        level: 'BEGINNER',
        newcomerInfo: '  Вхід зліва  ',
      }),
    ).resolves.toMatchObject({ priceMinor: 0, level: 'BEGINNER', newcomerInfo: 'Вхід зліва' });
  });
  it.each([-1, 0.5, NaN, Infinity, 100_000_001])(
    'rejects invalid kopeck amount %s before writing',
    async (priceMinor) => {
      const { prisma, tx } = setup();
      await expect(createEvent(prisma, { ...input, priceMinor })).rejects.toThrow(
        'Invalid participation price',
      );
      expect(tx.event.create).not.toHaveBeenCalled();
    },
  );
  it('does not publish subscriber notifications for an inactive field', async () => {
    const { prisma, tx } = setup();
    tx.field.findUnique.mockResolvedValueOnce({
      id: 'f1',
      isActive: false,
      venue: { cityId: 'kyiv', name: 'Поле', city: { name: 'Київ' } },
    });
    await expect(createEvent(prisma, input)).rejects.toThrow('Field is not active');
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });
  it('propagates notification failures so the transaction can roll back', async () => {
    const { prisma, tx } = setup();
    tx.notification.createMany.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(createEvent(prisma, input)).rejects.toThrow('database unavailable');
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });
});

describe('repeat template ownership', () => {
  const template = {
    ...input,
    organizerId: 'u1',
    priceMinor: 15000,
    level: 'CASUAL',
    newcomerInfo: 'Манішки є',
    field: { venueId: 'v1', venue: { cityId: 'kyiv' } },
  };
  function client(value: unknown = template) {
    return { event: { findUnique: vi.fn().mockResolvedValue(value) } } as unknown as PrismaClient;
  }
  it('returns a settings-only template without changing the source', async () => {
    const result = await repeatEventTemplate(client(), 'e1', 'u1');
    expect(result).toEqual({
      fieldId: 'f1',
      startAt: input.startAt,
      endAt: input.endAt,
      numberOfTeams: 2,
      playersPerTeam: 5,
      priceMinor: 15000,
      level: 'CASUAL',
      newcomerInfo: 'Манішки є',
      venueId: 'v1',
      cityId: 'kyiv',
    });
  });
  it('rejects a different organizer', async () => {
    await expect(repeatEventTemplate(client(), 'e1', 'u2')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
  it('reports a missing source', async () => {
    await expect(repeatEventTemplate(client(null), 'missing', 'u1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('city subscriptions', () => {
  function setup() {
    const db = {
      city: { findUnique: vi.fn().mockResolvedValue({ id: 'kyiv' }) },
      cityGameSubscription: { upsert: vi.fn(), deleteMany: vi.fn() },
    };
    return { db, prisma: db as unknown as PrismaClient };
  }
  it('uses a unique user/city key for idempotent opt-in', async () => {
    const { db, prisma } = setup();
    await setCityGameSubscription(prisma, 'u1', 'kyiv', true);
    expect(db.cityGameSubscription.upsert).toHaveBeenCalledWith({
      where: { userId_cityId: { userId: 'u1', cityId: 'kyiv' } },
      create: { userId: 'u1', cityId: 'kyiv' },
      update: {},
    });
  });
  it('rejects a nonexistent city', async () => {
    const { db, prisma } = setup();
    db.city.findUnique.mockResolvedValueOnce(null as never);
    await expect(setCityGameSubscription(prisma, 'u1', 'missing', true)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(db.cityGameSubscription.upsert).not.toHaveBeenCalled();
  });
  it('unsubscribes only the caller in the requested city', async () => {
    const { db, prisma } = setup();
    await setCityGameSubscription(prisma, 'u1', 'kyiv', false);
    expect(db.cityGameSubscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', cityId: 'kyiv' },
    });
  });
});
