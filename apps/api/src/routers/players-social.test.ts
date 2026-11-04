import { describe, expect, it, vi } from 'vitest';
import type { Context } from '../context.js';
import { playersRouter } from './players.js';

function setup(authenticated = true) {
  const db = {
    eventParticipant: {
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    rating: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return {
    db,
    caller: playersRouter.createCaller({
      prisma: db,
      user: authenticated ? { id: 'me', role: 'PLAYER' } : null,
    } as unknown as Context),
  };
}

describe('player social API', () => {
  it('requires login for the personal co-player list', async () => {
    await expect(setup(false).caller.teammates({ page: 0 })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
  it('uses the authenticated identity even when a caller supplies another user id', async () => {
    const { caller, db } = setup();
    await caller.teammates({ page: 0, userId: 'someone-else' } as { page: number });
    expect(db.eventParticipant.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: { not: 'me' } }) }),
    );
  });
  it('rejects invalid pages before querying', async () => {
    const { caller, db } = setup();
    for (const page of [-1, 0.5, 10001])
      await expect(caller.teammates({ page })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.eventParticipant.groupBy).not.toHaveBeenCalled();
  });
  it('public match history only returns attended finished matches', async () => {
    const { caller, db } = setup(false);
    await caller.matchHistory({ userId: 'player' });
    expect(db.eventParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'player', status: 'ATTENDED', event: { status: 'FINISHED' } },
      }),
    );
  });
});
