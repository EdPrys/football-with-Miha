import type { PrismaClient, Prisma } from '@app/db';
import { DomainError } from '../errors.js';
import { eventCapacity } from './capacity.js';

type Tx = Prisma.TransactionClient;

export async function setEventWaitlist(
  prisma: PrismaClient,
  eventId: string,
  userId: string,
  waiting: boolean,
) {
  if (!waiting) {
    await prisma.eventWaitlist.deleteMany({ where: { eventId, userId } });
    return { waiting: false };
  }
  return prisma.$transaction(async (tx) => {
    const [event] = await tx.$queryRaw<
      { status: string; startAt: Date; numberOfTeams: number; playersPerTeam: number }[]
    >`
      SELECT status, "startAt", "numberOfTeams", "playersPerTeam" FROM "Event" WHERE id = ${eventId} FOR UPDATE
    `;
    if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
    if (event.status !== 'UPCOMING' || event.startAt <= new Date())
      throw new DomainError('INVALID_STATE', 'Waitlist is closed');
    const active = await tx.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (active && ['JOINED', 'ATTENDED'].includes(active.status))
      throw new DomainError('CONFLICT', 'You have already joined this event');
    const count = await tx.eventParticipant.count({
      where: { eventId, status: { in: ['JOINED', 'ATTENDED'] } },
    });
    if (count < eventCapacity(event))
      throw new DomainError('INVALID_STATE', 'There are still free places in the current teams');
    await tx.eventWaitlist.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId },
      update: {},
    });
    return { waiting: true };
  });
}

/** Notify all opted-in waiting players; no place is reserved. Caller holds the event lock. */
export async function notifyWaitingPlayers(tx: Tx, eventId: string, startAt: Date) {
  const waiting = await tx.eventWaitlist.findMany({
    where: {
      eventId,
      user: { participations: { none: { eventId, status: { in: ['JOINED', 'ATTENDED'] } } } },
    },
    select: { userId: true },
  });
  if (waiting.length)
    await tx.notification.createMany({
      data: waiting.map(({ userId }) => ({
        userId,
        type: 'SLOT_AVAILABLE' as const,
        payload: { eventId, eventStartAt: startAt.toISOString() },
      })),
    });
}
