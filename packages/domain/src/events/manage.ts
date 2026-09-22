import type { Event, ParticipantStatus, PrismaClient } from '@app/db';
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

/** Finishing an event marks its active participants ATTENDED (rating-eligible). */
export async function finishEvent(prisma: PrismaClient, input: ManageInput): Promise<Event> {
  const event = await loadOwnedEvent(prisma, input.eventId, input.organizerId);
  assertTransition(event.status, 'FINISHED');
  const updated = await prisma.$transaction(async (tx) => {
    await tx.eventParticipant.updateMany({
      where: { eventId: event.id, status: 'JOINED' },
      data: { status: 'ATTENDED' },
    });
    return tx.event.update({ where: { id: event.id }, data: { status: 'FINISHED' } });
  });

  const participants = await prisma.eventParticipant.findMany({
    where: { eventId: event.id, status: 'ATTENDED' },
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
