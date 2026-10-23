import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@app/db';
import { DomainError } from '../errors.js';
import { assertCanRequestOrganizer, requestOrganizerRole } from './role-request.js';

describe('assertCanRequestOrganizer', () => {
  it('lets a player without a pending request ask', () => {
    expect(() =>
      assertCanRequestOrganizer({ currentRole: 'PLAYER', hasPendingRequest: false }),
    ).not.toThrow();
  });

  it('rejects users who already are organizers or admins', () => {
    for (const currentRole of ['MANAGER', 'ADMIN'] as const) {
      expect(() => assertCanRequestOrganizer({ currentRole, hasPendingRequest: false })).toThrow(
        DomainError,
      );
    }
  });

  it('rejects a second request while one is pending', () => {
    expect(() =>
      assertCanRequestOrganizer({ currentRole: 'PLAYER', hasPendingRequest: true }),
    ).toThrow(/under review/);
  });
});

function createPrismaMock(role: string, pending = 0) {
  const tx = {
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'user-1', role }),
      update: vi.fn(),
    },
    roleRequest: {
      count: vi.fn().mockResolvedValue(pending),
      create: vi.fn(({ data }) => Promise.resolve({ id: 'req-1', ...data })),
    },
  };
  const prisma = { $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)) };
  return { tx, prisma: prisma as unknown as PrismaClient };
}

describe('requestOrganizerRole', () => {
  it('promotes a player to MANAGER and records an approved request', async () => {
    const { tx, prisma } = createPrismaMock('PLAYER');
    const request = await requestOrganizerRole(prisma, 'user-1');

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: 'MANAGER' },
    });
    expect(request).toMatchObject({ userId: 'user-1', role: 'MANAGER', status: 'APPROVED' });
  });

  it('does not touch the role of an existing organizer', async () => {
    const { tx, prisma } = createPrismaMock('MANAGER');
    await expect(requestOrganizerRole(prisma, 'user-1')).rejects.toThrow(DomainError);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.roleRequest.create).not.toHaveBeenCalled();
  });
});
