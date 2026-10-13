import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@app/db';
import { leaveEvent } from './leave.js';
import { DomainError } from '../errors.js';

const NOW = new Date('2026-10-13T10:00:00.000Z');
const EVENT_ID = 'event-1';
const USER_ID = 'user-1';
const PARTICIPANT_ID = 'participant-1';

const event = {
  status: 'UPCOMING' as const,
  startAt: new Date(NOW.getTime() + 2 * 60 * 60 * 1000),
};

const participant = {
  id: PARTICIPANT_ID,
  status: 'JOINED' as const,
  teamId: 'team-1',
};

function createPrismaMock() {
  return {
    event: {
      findUnique: vi.fn(),
    },
    eventParticipant: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe('leaveEvent', () => {
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    prisma = createPrismaMock();

    prisma.event.findUnique.mockResolvedValue(event);
    prisma.eventParticipant.findUnique.mockResolvedValue(participant);
    prisma.eventParticipant.update.mockResolvedValue({
      ...participant,
      status: 'CANCELLED',
      teamId: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows leaving an upcoming event more than one hour before kick-off', async () => {
    await expect(
      leaveEvent(prisma as unknown as PrismaClient, {
        eventId: EVENT_ID,
        userId: USER_ID,
      }),
    ).resolves.toBeUndefined();

    expect(prisma.eventParticipant.update).toHaveBeenCalledWith({
      where: { id: PARTICIPANT_ID },
      data: { status: 'CANCELLED', teamId: null },
    });
  });

  it('throws NOT_FOUND when the event does not exist', async () => {
    prisma.event.findUnique.mockResolvedValue(null);

    await expect(
      leaveEvent(prisma as unknown as PrismaClient, {
        eventId: EVENT_ID,
        userId: USER_ID,
      }),
    ).rejects.toThrow(DomainError);

    expect(prisma.eventParticipant.findUnique).not.toHaveBeenCalled();
    expect(prisma.eventParticipant.update).not.toHaveBeenCalled();
  });

  it.each(['IN_PROGRESS', 'FINISHED', 'CANCELLED'] as const)(
    'rejects leaving an event with status %s',
    async (status) => {
      prisma.event.findUnique.mockResolvedValue({
        ...event,
        status,
      });

      await expect(
        leaveEvent(prisma as unknown as PrismaClient, {
          eventId: EVENT_ID,
          userId: USER_ID,
        }),
      ).rejects.toThrow(/Cannot leave an event/);

      expect(prisma.eventParticipant.update).not.toHaveBeenCalled();
    },
  );

  it('rejects leaving less than one hour before kick-off', async () => {
    prisma.event.findUnique.mockResolvedValue({
      ...event,
      startAt: new Date(NOW.getTime() + 30 * 60 * 1000),
    });

    await expect(
      leaveEvent(prisma as unknown as PrismaClient, {
        eventId: EVENT_ID,
        userId: USER_ID,
      }),
    ).rejects.toThrow(/less than 1 hour/);

    expect(prisma.eventParticipant.findUnique).not.toHaveBeenCalled();
    expect(prisma.eventParticipant.update).not.toHaveBeenCalled();
  });

  it('allows leaving exactly one hour before kick-off', async () => {
    prisma.event.findUnique.mockResolvedValue({
      ...event,
      startAt: new Date(NOW.getTime() + 60 * 60 * 1000),
    });

    await expect(
      leaveEvent(prisma as unknown as PrismaClient, {
        eventId: EVENT_ID,
        userId: USER_ID,
      }),
    ).resolves.toBeUndefined();

    expect(prisma.eventParticipant.update).toHaveBeenCalledWith({
      where: { id: PARTICIPANT_ID },
      data: { status: 'CANCELLED', teamId: null },
    });
  });

  it('throws NOT_FOUND when the user is not a participant', async () => {
    prisma.eventParticipant.findUnique.mockResolvedValue(null);

    await expect(
      leaveEvent(prisma as unknown as PrismaClient, {
        eventId: EVENT_ID,
        userId: USER_ID,
      }),
    ).rejects.toThrow(/not an active participant/);

    expect(prisma.eventParticipant.update).not.toHaveBeenCalled();
  });

  it.each(['CANCELLED', 'LEFT'] as const)(
    'rejects leaving when participant status is %s',
    async (status) => {
      prisma.eventParticipant.findUnique.mockResolvedValue({
        ...participant,
        status,
      });

      await expect(
        leaveEvent(prisma as unknown as PrismaClient, {
          eventId: EVENT_ID,
          userId: USER_ID,
        }),
      ).rejects.toThrow(/not an active participant/);

      expect(prisma.eventParticipant.update).not.toHaveBeenCalled();
    },
  );

  it('queries the event using the provided event ID', async () => {
    await leaveEvent(prisma as unknown as PrismaClient, {
      eventId: EVENT_ID,
      userId: USER_ID,
    });

    expect(prisma.event.findUnique).toHaveBeenCalledWith({
      where: { id: EVENT_ID },
      select: { status: true, startAt: true },
    });
  });

  it('queries the participant using the event and user IDs', async () => {
    await leaveEvent(prisma as unknown as PrismaClient, {
      eventId: EVENT_ID,
      userId: USER_ID,
    });

    expect(prisma.eventParticipant.findUnique).toHaveBeenCalledWith({
      where: {
        eventId_userId: {
          eventId: EVENT_ID,
          userId: USER_ID,
        },
      },
    });
  });
});
