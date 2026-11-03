import { describe, expect, it, vi } from 'vitest';
import type { Context } from '../context.js';
import { eventsRouter } from './events.js';

function setup(authenticated = true) {
  const db = {
    eventParticipant: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ status: 'JOINED', remindBeforeGame: true, reminderSentAt: null }),
    },
    eventWaitlist: { findUnique: vi.fn().mockResolvedValue(null) },
    event: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), findUnique: vi.fn() },
    rating: { findMany: vi.fn().mockResolvedValue([]) },
    eventMvp: { groupBy: vi.fn().mockResolvedValue([]) },
  };
  const caller = eventsRouter.createCaller({
    prisma: db,
    user: authenticated ? { id: 'me', role: 'PLAYER' } : null,
  } as unknown as Context);
  return { caller, db };
}

describe('player comfort API', () => {
  it('requires authentication for waitlist/reminder/private settings', async () => {
    const { caller } = setup(false);
    await expect(caller.myState({ eventId: 'e1' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.setWaitlist({ eventId: 'e1', waiting: true })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    await expect(caller.setReminder({ eventId: 'e1', enabled: true })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
  it('reads only the current player private settings', async () => {
    const { caller, db } = setup();
    await caller.myState({ eventId: 'e1' });
    expect(db.eventParticipant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId_userId: { eventId: 'e1', userId: 'me' } } }),
    );
    expect(db.eventWaitlist.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId_userId: { eventId: 'e1', userId: 'me' } } }),
    );
  });
  it('prevents a different player changing public organizer contacts', async () => {
    const { caller, db } = setup();
    await expect(
      caller.updateContacts({ eventId: 'e1', organizerTelegram: '@kopanka_game' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.event.updateMany).toHaveBeenCalledWith({
      where: { id: 'e1', organizerId: 'me' },
      data: { organizerPhone: null, organizerTelegram: 'kopanka_game' },
    });
  });
  it('never exposes private reminder flags in public game participants', async () => {
    const { caller, db } = setup(false);
    db.event.findUnique.mockResolvedValue({
      id: 'e1',
      status: 'UPCOMING',
      startAt: new Date(),
      finishedAt: null,
      numberOfTeams: 2,
      playersPerTeam: 5,
      participants: [
        {
          id: 'p1',
          eventId: 'e1',
          userId: 'u1',
          status: 'JOINED',
          preferredPosition: 'MID',
          teamId: 't1',
          joinedAt: new Date(),
          remindBeforeGame: true,
          reminderSentAt: new Date(),
          user: { id: 'u1', name: 'Player' },
        },
      ],
    });
    const result = await caller.get({ id: 'e1' });
    expect(result.participants[0]).not.toHaveProperty('remindBeforeGame');
    expect(result.participants[0]).not.toHaveProperty('reminderSentAt');
    expect(result.participants[0]).toHaveProperty('userId', 'u1');
  });
});
