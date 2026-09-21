import type { Event, PrismaClient } from '@app/db';
import { DomainError } from '../errors.js';
import { teamNames } from './team-names.js';

export interface CreateEventInput {
  organizerId: string;
  fieldId: string;
  startAt: Date;
  endAt: Date;
  numberOfTeams: number;
  playersPerTeam: number;
}

export const MIN_TEAMS = 2;
export const MIN_PLAYERS_PER_TEAM = 1;

/**
 * Creates an Event and its teams in one transaction. Enforces the invariants
 * that must hold regardless of the client (a UI can't be trusted to check them).
 */
export async function createEvent(prisma: PrismaClient, input: CreateEventInput): Promise<Event> {
  if (input.numberOfTeams < MIN_TEAMS) {
    throw new DomainError('VALIDATION', `An event needs at least ${MIN_TEAMS} teams`);
  }
  if (input.playersPerTeam < MIN_PLAYERS_PER_TEAM) {
    throw new DomainError('VALIDATION', 'playersPerTeam must be at least 1');
  }
  if (input.endAt <= input.startAt) {
    throw new DomainError('VALIDATION', 'endAt must be after startAt');
  }
  if (input.startAt.getTime() < Date.now()) {
    throw new DomainError('VALIDATION', 'startAt must be in the future');
  }

  const field = await prisma.field.findUnique({ where: { id: input.fieldId } });
  if (!field) throw new DomainError('NOT_FOUND', 'Field not found');
  if (!field.isActive) throw new DomainError('INVALID_STATE', 'Field is not active');

  return prisma.event.create({
    data: {
      organizerId: input.organizerId,
      fieldId: input.fieldId,
      startAt: input.startAt,
      endAt: input.endAt,
      numberOfTeams: input.numberOfTeams,
      playersPerTeam: input.playersPerTeam,
      teams: { create: teamNames(input.numberOfTeams).map((name) => ({ name })) },
    },
  });
}
