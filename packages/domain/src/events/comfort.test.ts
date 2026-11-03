import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@app/db';
import { organizerContacts, updateOrganizerContacts } from './contact.js';
import { setEventWaitlist, notifyWaitingPlayers } from './waitlist.js';
import { setGameReminder, sendGameReminders } from './reminders.js';

const startAt = new Date(Date.now() + 7 * 86400_000);
function fixture() {
  const tx = {
    $queryRaw: vi
      .fn()
      .mockResolvedValue([{ status: 'UPCOMING', startAt, numberOfTeams: 2, playersPerTeam: 2 }]),
    eventParticipant: {
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(4),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue([{ id: 'p1', userId: 'u1' }]),
      updateMany: vi.fn(),
    },
    eventWaitlist: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn().mockResolvedValue([{ userId: 'u2' }]),
    },
    notification: { createMany: vi.fn() },
    event: {
      findMany: vi.fn().mockResolvedValue([{ id: 'e1' }]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn((callback: (value: typeof tx) => unknown) => callback(tx)),
  } as unknown as PrismaClient;
  return { tx, prisma };
}

describe('public organizer contacts', () => {
  it('normalizes explicit contacts and permits clearing', () => {
    expect(organizerContacts(' +380 (67) 123-45-67 ', ' @kopanka_game ')).toEqual({
      organizerPhone: '+380 (67) 123-45-67',
      organizerTelegram: 'kopanka_game',
    });
    expect(organizerContacts('', '')).toEqual({ organizerPhone: null, organizerTelegram: null });
  });
  it.each(['javascript:alert(1)', '123', '9'.repeat(16)])('rejects phone %s', (phone) =>
    expect(() => organizerContacts(phone)).toThrow('Invalid organizer phone'),
  );
  it.each(['https://t.me/person', 'a', 'name?x=1'])('rejects Telegram %s', (telegram) =>
    expect(() => organizerContacts(null, telegram)).toThrow('Invalid organizer Telegram'),
  );
  it('writes only to an event owned by the caller', async () => {
    const { tx, prisma } = fixture();
    await updateOrganizerContacts(prisma, 'e1', 'owner', null, '@kopanka_game');
    expect(tx.event.updateMany).toHaveBeenCalledWith({
      where: { id: 'e1', organizerId: 'owner' },
      data: { organizerPhone: null, organizerTelegram: 'kopanka_game' },
    });
    tx.event.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(updateOrganizerContacts(prisma, 'e1', 'other')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('waitlist guards and delivery', () => {
  it('uses a unique event/user key without reserving or joining', async () => {
    const { tx, prisma } = fixture();
    await setEventWaitlist(prisma, 'e1', 'u1', true);
    expect(tx.eventWaitlist.upsert).toHaveBeenCalledWith({
      where: { eventId_userId: { eventId: 'e1', userId: 'u1' } },
      create: { eventId: 'e1', userId: 'u1' },
      update: {},
    });
    expect(tx.eventParticipant.update).not.toHaveBeenCalled();
  });
  it('rejects when places are already available', async () => {
    const { tx, prisma } = fixture();
    tx.eventParticipant.count.mockResolvedValueOnce(3);
    await expect(setEventWaitlist(prisma, 'e1', 'u1', true)).rejects.toThrow('free places');
    expect(tx.eventWaitlist.upsert).not.toHaveBeenCalled();
  });
  it.each(['IN_PROGRESS', 'FINISHED', 'CANCELLED'])('rejects %s games', async (status) => {
    const { tx, prisma } = fixture();
    tx.$queryRaw.mockResolvedValueOnce([{ status, startAt, numberOfTeams: 2, playersPerTeam: 2 }]);
    await expect(setEventWaitlist(prisma, 'e1', 'u1', true)).rejects.toThrow('Waitlist is closed');
  });
  it('rejects past kickoffs even if status is still upcoming', async () => {
    const { tx, prisma } = fixture();
    tx.$queryRaw.mockResolvedValueOnce([
      { status: 'UPCOMING', startAt: new Date(0), numberOfTeams: 2, playersPerTeam: 2 },
    ]);
    await expect(setEventWaitlist(prisma, 'e1', 'u1', true)).rejects.toThrow('Waitlist is closed');
  });
  it('does not allow a joined player onto the waitlist', async () => {
    const { tx, prisma } = fixture();
    tx.eventParticipant.findUnique.mockResolvedValueOnce({ status: 'JOINED' } as never);
    await expect(setEventWaitlist(prisma, 'e1', 'u1', true)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
  it('can unsubscribe without changing other players', async () => {
    const { tx, prisma } = fixture();
    await setEventWaitlist(prisma, 'e1', 'u1', false);
    expect(tx.eventWaitlist.deleteMany).toHaveBeenCalledWith({
      where: { eventId: 'e1', userId: 'u1' },
    });
  });
  it('sends explicit slot alerts only to opted-in nonparticipants', async () => {
    const { tx } = fixture();
    await notifyWaitingPlayers(tx as never, 'e1', startAt);
    expect(tx.eventWaitlist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventId: 'e1',
          user: {
            participations: { none: { eventId: 'e1', status: { in: ['JOINED', 'ATTENDED'] } } },
          },
        }),
      }),
    );
    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'u2',
          type: 'SLOT_AVAILABLE',
          payload: { eventId: 'e1', eventStartAt: startAt.toISOString() },
        },
      ],
    });
  });
});

describe('opt-in game reminders', () => {
  it('requires an active participant', async () => {
    const { prisma } = fixture();
    await expect(setGameReminder(prisma, 'e1', 'stranger', true)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
  it('toggles only the caller enrollment and keeps already sent markers', async () => {
    const { tx, prisma } = fixture();
    tx.eventParticipant.findUnique.mockResolvedValue({ id: 'p1', status: 'JOINED' } as never);
    await setGameReminder(prisma, 'e1', 'u1', false);
    expect(tx.eventParticipant.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { remindBeforeGame: false },
    });
  });
  it('writes the marker and notification inside one transaction and skips a claimed reminder', async () => {
    const { tx, prisma } = fixture();
    const now = new Date();
    tx.$queryRaw.mockResolvedValue([{ status: 'UPCOMING', startAt: new Date(+now + 30 * 60_000) }]);
    expect(await sendGameReminders(prisma, now)).toBe(1);
    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'u1',
          type: 'EVENT_APPROACHING',
          payload: { eventId: 'e1', eventStartAt: new Date(+now + 30 * 60_000).toISOString() },
        },
      ],
    });
    tx.eventParticipant.findMany.mockResolvedValueOnce([]);
    expect(await sendGameReminders(prisma, now)).toBe(0);
    expect(tx.notification.createMany).toHaveBeenCalledTimes(1);
  });
  it('rechecks cancelled games after obtaining the lock', async () => {
    const { tx, prisma } = fixture();
    tx.$queryRaw.mockResolvedValue([{ status: 'CANCELLED', startAt }]);
    expect(await sendGameReminders(prisma)).toBe(0);
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });
});
