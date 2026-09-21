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
}

/**
 * Join an event atomically: the capacity check and the write happen in one
 * transaction so two people racing for the last slot can't both get in. A user
 * who previously left (CANCELLED/NO_SHOW) re-activates their existing row.
 */
export async function joinEvent(prisma: PrismaClient, input: JoinInput): Promise<EventParticipant> {
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: input.eventId },
      select: { status: true, numberOfTeams: true, playersPerTeam: true },
    });
    if (!event) throw new DomainError('NOT_FOUND', 'Event not found');

    const existing = await tx.eventParticipant.findUnique({
      where: { eventId_userId: { eventId: input.eventId, userId: input.userId } },
    });
    const alreadyActive = !!existing && ACTIVE_STATUSES.includes(existing.status);

    const activeCount = await tx.eventParticipant.count({
      where: {
        eventId: input.eventId,
        status: { in: ['JOINED', 'ATTENDED'] },
        userId: { not: input.userId },
      },
    });

    assertJoinable({
      status: event.status,
      capacity: eventCapacity(event),
      activeCount,
      alreadyActive,
    });

    if (existing) {
      return tx.eventParticipant.update({
        where: { id: existing.id },
        data: { status: 'JOINED', preferredPosition: input.position, teamId: null },
      });
    }
    return tx.eventParticipant.create({
      data: {
        eventId: input.eventId,
        userId: input.userId,
        status: 'JOINED',
        preferredPosition: input.position,
      },
    });
  });
}
