import type { Event, EventParticipant, PrismaClient } from '@app/db';
import { DomainError } from '../errors.js';
import { assertTransition } from './lifecycle.js';

const ACTIVE_STATUSES = ['JOINED', 'ATTENDED'];

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
  return prisma.$transaction(async (tx) => {
    await tx.eventParticipant.updateMany({
      where: { eventId: event.id, status: 'JOINED' },
      data: { status: 'ATTENDED' },
    });
    return tx.event.update({ where: { id: event.id }, data: { status: 'FINISHED' } });
  });
}

export async function cancelEvent(prisma: PrismaClient, input: ManageInput): Promise<Event> {
  const event = await loadOwnedEvent(prisma, input.eventId, input.organizerId);
  assertTransition(event.status, 'CANCELLED');
  return prisma.event.update({ where: { id: event.id }, data: { status: 'CANCELLED' } });
}

export interface AssignTeamInput extends ManageInput {
  userId: string;
  teamId: string | null;
}

export async function assignTeam(
  prisma: PrismaClient,
  input: AssignTeamInput,
): Promise<EventParticipant> {
  await loadOwnedEvent(prisma, input.eventId, input.organizerId);

  if (input.teamId !== null) {
    const team = await prisma.team.findFirst({
      where: { id: input.teamId, eventId: input.eventId },
    });
    if (!team) throw new DomainError('VALIDATION', 'Team does not belong to this event');
  }

  const participant = await prisma.eventParticipant.findUnique({
    where: { eventId_userId: { eventId: input.eventId, userId: input.userId } },
  });
  if (!participant || !ACTIVE_STATUSES.includes(participant.status)) {
    throw new DomainError('NOT_FOUND', 'User is not an active participant of this event');
  }

  return prisma.eventParticipant.update({
    where: { id: participant.id },
    data: { teamId: input.teamId },
  });
}
