import type {
  EventParticipant,
  EventStatus,
  ParticipantStatus,
  Position,
  PrismaClient,
} from '@app/db';
import { DomainError } from '../errors.js';
import { eventCapacity } from './capacity.js';

const ACTIVE_STATUSES: ParticipantStatus[] = ['JOINED', 'ATTENDED'];

export interface JoinGuardContext {
  status: EventStatus;
  capacity: number;
  activeCount: number; // active participants NOT counting this user
  alreadyActive: boolean; // this user already holds an active slot
}

/** Pure invariant check for joining an event. Throws on violation. */
export function assertJoinable(ctx: JoinGuardContext): void {
  if (ctx.alreadyActive) {
    throw new DomainError('CONFLICT', 'You have already joined this event');
  }
  if (ctx.status !== 'UPCOMING') {
    throw new DomainError('INVALID_STATE', 'Event is not open for joining');
  }
  if (ctx.activeCount >= ctx.capacity) {
    throw new DomainError('INVALID_STATE', 'Event is full');
  }
}

export interface JoinInput {
  eventId: string;
  userId: string;
  position: Position;
  teamId?: string | null; // pick a specific team's slot on the pitch
}

/**
 * Join an event atomically. When a teamId is given (picking a slot on the pitch)
 * we also validate the team belongs to the event and isn't already full.
 * A user who previously left re-activates their existing row.
 */
export async function joinEvent(prisma: PrismaClient, input: JoinInput): Promise<EventParticipant> {
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: input.eventId },
      select: { status: true, numberOfTeams: true, playersPerTeam: true },
    });
    if (!event) throw new DomainError('NOT_FOUND', 'Event not found');

    if (input.teamId != null) {
      const team = await tx.team.findFirst({
        where: { id: input.teamId, eventId: input.eventId },
        select: { id: true },
      });
      if (!team) throw new DomainError('VALIDATION', 'Team does not belong to this event');

      const teamCount = await tx.eventParticipant.count({
        where: {
          eventId: input.eventId,
          teamId: input.teamId,
          status: { in: ACTIVE_STATUSES },
          userId: { not: input.userId },
        },
      });
      if (teamCount >= event.playersPerTeam) {
        throw new DomainError('INVALID_STATE', 'This team is full');
      }
    }

    const existing = await tx.eventParticipant.findUnique({
      where: { eventId_userId: { eventId: input.eventId, userId: input.userId } },
    });
    const alreadyActive = !!existing && ACTIVE_STATUSES.includes(existing.status);

    const activeCount = await tx.eventParticipant.count({
      where: {
        eventId: input.eventId,
        status: { in: ACTIVE_STATUSES },
        userId: { not: input.userId },
      },
    });

    assertJoinable({
      status: event.status,
      capacity: eventCapacity(event),
      activeCount,
      alreadyActive,
    });

    const data = {
      status: 'JOINED' as const,
      preferredPosition: input.position,
      teamId: input.teamId ?? null,
    };

    if (existing) {
      return tx.eventParticipant.update({ where: { id: existing.id }, data });
    }
    return tx.eventParticipant.create({
      data: { eventId: input.eventId, userId: input.userId, ...data },
    });
  });
}
