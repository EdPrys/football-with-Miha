import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@app/db';
import { outreachMetrics } from './metrics.js';

describe('outreach cohort measurement', () => {
  it('counts real games, unique non-organizer players, new players and repeat outcomes without PII', async () => {
    const tx = {
      user: {
        findMany: vi.fn(async () => [
          { id: 'o', role: 'MANAGER' },
          { id: 'n', role: 'PLAYER' },
        ]),
      },
      event: {
        findMany: vi.fn(async () => [
          {
            organizerId: 'o',
            status: 'FINISHED',
            participants: [
              { userId: 'o', status: 'ATTENDED' },
              { userId: 'n', status: 'ATTENDED' },
              { userId: 'old', status: 'ATTENDED' },
            ],
          },
          {
            organizerId: 'o',
            status: 'UPCOMING',
            participants: [
              { userId: 'n', status: 'JOINED' },
              { userId: 'old', status: 'JOINED' },
            ],
          },
        ]),
      },
    };
    const transaction = vi.fn(async (fn: (db: typeof tx) => unknown) => fn(tx));
    const result = await outreachMetrics(
      { $transaction: transaction } as unknown as PrismaClient,
      'pilot__0123456789abcdef',
    );
    expect(result).toEqual({
      registeredUsers: 2,
      organizers: 1,
      gamesCreated: 2,
      gamesFinished: 1,
      playersJoined: 2,
      newPlayersJoined: 1,
      playersAttended: 2,
      organizersWithRepeatGames: 1,
      organizersWithRepeatFinishedGames: 0,
    });
    expect(tx.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          signupSource: 'telegram',
          signupMedium: 'outreach',
          signupCampaign: 'pilot__0123456789abcdef',
        },
      }),
    );
    expect(tx.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizerId: { in: ['o', 'n'] }, status: { not: 'CANCELLED' } },
      }),
    );
    expect(JSON.stringify(result)).not.toContain('old');
  });
  it('does not query unrelated events for an empty cohort', async () => {
    const tx = { user: { findMany: vi.fn(async () => []) }, event: { findMany: vi.fn() } };
    const result = await outreachMetrics(
      { $transaction: async (fn: (db: typeof tx) => unknown) => fn(tx) } as unknown as PrismaClient,
      'unknown',
    );
    expect(result.registeredUsers).toBe(0);
    expect(tx.event.findMany).not.toHaveBeenCalled();
  });
});
