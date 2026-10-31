import { describe, expect, it, vi } from 'vitest';
import type { Context } from '../context.js';
import { venuesRouter } from './venues.js';

function setup(role: 'PLAYER' | 'MANAGER' | 'ADMIN' | null) {
  const prisma = {
    venue: {
      findUnique: vi.fn().mockResolvedValue({ id: 'v1' }),
      update: vi.fn().mockResolvedValue({ id: 'v1' }),
    },
    field: {
      findUnique: vi.fn().mockResolvedValue({ id: 'f1' }),
      update: vi.fn().mockResolvedValue({ id: 'f1' }),
      create: vi.fn().mockResolvedValue({ id: 'f1' }),
    },
  };
  const caller = venuesRouter.createCaller({
    prisma,
    user: role ? { id: 'user1', role } : null,
  } as unknown as Context);
  return { caller, prisma };
}

describe('venue catalogue access and partial updates', () => {
  it('restricts editing existing catalogue entries to admins', async () => {
    for (const role of ['PLAYER', 'MANAGER'] as const) {
      const { caller, prisma } = setup(role);
      await expect(caller.update({ id: 'v1', address: 'New address' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(caller.updateField({ id: 'f1', capacity: null })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      expect(prisma.venue.update).not.toHaveBeenCalled();
      expect(prisma.field.update).not.toHaveBeenCalled();
    }
  });

  it('lets an organizer add a field without a published capacity', async () => {
    const { caller, prisma } = setup('MANAGER');
    await caller.addField({ venueId: 'v1', name: 'Pitch', hasLighting: false });
    expect(prisma.field.create).toHaveBeenCalledWith({
      data: { venueId: 'v1', name: 'Pitch', hasLighting: false },
    });
  });

  it('preserves omitted values while allowing an admin to clear known metadata', async () => {
    const { caller, prisma } = setup('ADMIN');
    await caller.update({ id: 'v1', address: null, hasShowers: false });
    expect(prisma.venue.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { address: null, hasShowers: false },
    });
    await caller.updateField({ id: 'f1', capacity: null, environment: 'INDOOR' });
    expect(prisma.field.update).toHaveBeenCalledWith({
      where: { id: 'f1' },
      data: { capacity: null, environment: 'INDOOR' },
    });
  });

  it('reports a missing field instead of attempting to update it', async () => {
    const { caller, prisma } = setup('ADMIN');
    prisma.field.findUnique.mockResolvedValueOnce(null);
    await expect(caller.updateField({ id: 'missing', hasLighting: true })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(prisma.field.update).not.toHaveBeenCalled();
  });
});
