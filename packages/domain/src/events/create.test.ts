import { describe, it, expect } from 'vitest';
import type { PrismaClient } from '@app/db';
import { createEvent } from './create.js';

const base = {
  organizerId: 'u1',
  fieldId: 'f1',
  startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  endAt: new Date(Date.now() + 26 * 60 * 60 * 1000),
  numberOfTeams: 2,
};
// Size validation runs before any DB access.
const prisma = {} as PrismaClient;

describe('createEvent team size', () => {
  it.each([1, 12])('rejects %i players per team', async (playersPerTeam) => {
    await expect(createEvent(prisma, { ...base, playersPerTeam })).rejects.toThrow(
      /between 2 and 11/,
    );
  });
});
