import type { Event, GameLevel, PrismaClient } from '@app/db';
import { DomainError } from '../errors.js';
import { teamNames } from './team-names.js';

export interface CreateEventInput {
  organizerId: string;
  fieldId: string;
  startAt: Date;
  endAt: Date;
  numberOfTeams: number;
  playersPerTeam: number;
  priceMinor?: number | null;
  level?: GameLevel | null;
  newcomerInfo?: string | null;
}

export const MIN_TEAMS = 2;
// Game formats run from "2 на 2" to "11 на 11".
export const MIN_PLAYERS_PER_TEAM = 2;
export const MAX_PLAYERS_PER_TEAM = 11;

/**
 * Creates an Event and its teams in one transaction. Enforces the invariants
 * that must hold regardless of the client (a UI can't be trusted to check them).
 */
export async function createEvent(prisma: PrismaClient, input: CreateEventInput): Promise<Event> {
  if (input.numberOfTeams < MIN_TEAMS) {
    throw new DomainError('VALIDATION', `An event needs at least ${MIN_TEAMS} teams`);
  }
  if (input.playersPerTeam < MIN_PLAYERS_PER_TEAM || input.playersPerTeam > MAX_PLAYERS_PER_TEAM) {
    throw new DomainError(
      'VALIDATION',
      `playersPerTeam must be between ${MIN_PLAYERS_PER_TEAM} and ${MAX_PLAYERS_PER_TEAM}`,
    );
  }
  if (input.endAt <= input.startAt) {
    throw new DomainError('VALIDATION', 'endAt must be after startAt');
  }
  if (input.startAt.getTime() < Date.now()) {
    throw new DomainError('VALIDATION', 'startAt must be in the future');
  }

  if (
    input.priceMinor != null &&
    (!Number.isSafeInteger(input.priceMinor) ||
      input.priceMinor < 0 ||
      input.priceMinor > 100_000_000)
  ) {
    throw new DomainError('VALIDATION', 'Invalid participation price');
  }
  if (input.newcomerInfo && input.newcomerInfo.length > 2000) {
    throw new DomainError('VALIDATION', 'Newcomer instructions are too long');
  }

  // Persist the game and subscriber notifications together: a rollback never
  // leaves a notification pointing to a game that was not created.
  return prisma.$transaction(async (tx) => {
    const field = await tx.field.findUnique({
      where: { id: input.fieldId },
      include: { venue: { include: { city: true } } },
    });
    if (!field) throw new DomainError('NOT_FOUND', 'Field not found');
    if (!field.isActive) throw new DomainError('INVALID_STATE', 'Field is not active');
    const event = await tx.event.create({
      data: {
        organizerId: input.organizerId,
        fieldId: input.fieldId,
        startAt: input.startAt,
        endAt: input.endAt,
        numberOfTeams: input.numberOfTeams,
        playersPerTeam: input.playersPerTeam,
        priceMinor: input.priceMinor ?? null,
        level: input.level ?? null,
        newcomerInfo: input.newcomerInfo?.trim() || null,
        teams: { create: teamNames(input.numberOfTeams).map((name) => ({ name })) },
      },
    });
    const subscriptions = await tx.cityGameSubscription.findMany({
      where: { cityId: field.venue.cityId, userId: { not: input.organizerId } },
      select: { userId: true },
    });
    if (subscriptions.length)
      await tx.notification.createMany({
        data: subscriptions.map(({ userId }) => ({
          userId,
          type: 'EVENT_CREATED' as const,
          payload: {
            eventId: event.id,
            eventStartAt: event.startAt.toISOString(),
            cityName: field.venue.city.name,
            venueName: field.venue.name,
          },
        })),
      });
    return event;
  });
}
