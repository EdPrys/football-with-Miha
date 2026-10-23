import type { Event, EventStatus, ParticipantStatus, PrismaClient } from '@app/db';
import { DomainError } from '../errors.js';
import { assertTransition } from './lifecycle.js';
import { notifyMany } from '../notifications/create.js';

const ACTIVE_STATUSES: ParticipantStatus[] = ['JOINED', 'ATTENDED'];

async function loadOwnedEvent(prisma: PrismaClient, eventId: string, organizerId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, status: true, organizerId: true },
  });
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
  if (event.organizerId !== organizerId) {
    throw new DomainError('FORBIDDEN', 'Only the organizer can manage this event');
  }
  return event;
}

export interface ManageInput {
  eventId: string;
  organizerId: string;
}

export async function startEvent(prisma: PrismaClient, input: ManageInput): Promise<Event> {
  const event = await loadOwnedEvent(prisma, input.eventId, input.organizerId);
  assertTransition(event.status, 'IN_PROGRESS');
  return prisma.event.update({ where: { id: event.id }, data: { status: 'IN_PROGRESS' } });
}

/**
 * Moves an event to FINISHED: active participants become ATTENDED (rating-
 * eligible), `finishedAt` opens the 24h star window, players are notified.
 * The status update only applies while the event is still in `from`, so a
 * concurrent finish (button vs. auto-finish job) completes it exactly once.
 * Returns null when someone else already finished/cancelled it.
 */
async function completeEvent(
  prisma: PrismaClient,
  eventId: string,
  from: EventStatus[],
): Promise<Event | null> {
  const finishedAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.event.updateMany({
      where: { id: eventId, status: { in: from } },
      data: { status: 'FINISHED', finishedAt },
    });
    if (claimed.count === 0) return null;
    await tx.eventParticipant.updateMany({
      where: { eventId, status: 'JOINED' },
      data: { status: 'ATTENDED' },
    });
    return tx.event.findUniqueOrThrow({ where: { id: eventId } });
  });
  if (!updated) return null;

  const participants = await prisma.eventParticipant.findMany({
    where: { eventId, status: 'ATTENDED' },
    select: { userId: true },
  });
  await notifyMany(
    prisma,
    participants.map((p) => ({
      userId: p.userId,
      type: 'RATING_AVAILABLE' as const,
      payload: { eventId: updated.id, eventStartAt: updated.startAt.toISOString() },
    })),
  );
  return updated;
}

/** The organizer finishes the game (from IN_PROGRESS). */
export async function finishEvent(prisma: PrismaClient, input: ManageInput): Promise<Event> {
  const event = await loadOwnedEvent(prisma, input.eventId, input.organizerId);
  assertTransition(event.status, 'FINISHED');
  const updated = await completeEvent(prisma, event.id, ['IN_PROGRESS']);
  if (!updated)
    throw new DomainError('INVALID_STATE', 'Cannot change event from FINISHED to FINISHED');
  return updated;
}

/** How long after `endAt` an unfinished game is closed automatically. */
export const AUTO_FINISH_GRACE_MINUTES = 60;

export interface AutoFinishResult {
  finished: string[];
  cancelled: string[];
}

/**
 * Closes games the organizer forgot about: anything still UPCOMING or
 * IN_PROGRESS an hour after its end. Games with players are finished exactly
 * like the button does (so star rating opens); games nobody joined are
 * cancelled instead. Safe to run repeatedly or from several instances.
 */
export async function finishOverdueEvents(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<AutoFinishResult> {
  const cutoff = new Date(now.getTime() - AUTO_FINISH_GRACE_MINUTES * 60 * 1000);
  const overdue = await prisma.event.findMany({
    where: { status: { in: ['UPCOMING', 'IN_PROGRESS'] }, endAt: { lt: cutoff } },
    select: {
      id: true,
      _count: { select: { participants: { where: { status: { in: ACTIVE_STATUSES } } } } },
    },
  });

  const result: AutoFinishResult = { finished: [], cancelled: [] };
  for (const e of overdue) {
    if (e._count.participants === 0) {
      const { count } = await prisma.event.updateMany({
        where: { id: e.id, status: { in: ['UPCOMING', 'IN_PROGRESS'] } },
        data: { status: 'CANCELLED' },
      });
      if (count > 0) result.cancelled.push(e.id);
    } else if (await completeEvent(prisma, e.id, ['UPCOMING', 'IN_PROGRESS'])) {
      result.finished.push(e.id);
    }
  }
  return result;
}

export async function cancelEvent(prisma: PrismaClient, input: ManageInput): Promise<Event> {
  const event = await loadOwnedEvent(prisma, input.eventId, input.organizerId);
  assertTransition(event.status, 'CANCELLED');
  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { status: 'CANCELLED' },
  });

  const participants = await prisma.eventParticipant.findMany({
    where: { eventId: event.id, status: { in: ACTIVE_STATUSES } },
    select: { userId: true },
  });
  await notifyMany(
    prisma,
    participants.map((p) => ({
      userId: p.userId,
      type: 'EVENT_CANCELLED' as const,
      payload: { eventId: updated.id, eventStartAt: updated.startAt.toISOString() },
    })),
  );

  return updated;
}
