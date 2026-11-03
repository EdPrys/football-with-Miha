import type { PrismaClient } from '@app/db';
import { DomainError } from '../errors.js';

export async function setGameReminder(
  prisma: PrismaClient,
  eventId: string,
  userId: string,
  enabled: boolean,
) {
  return prisma.$transaction(async (tx) => {
    const [event] = await tx.$queryRaw<{ status: string; startAt: Date }[]>`
      SELECT status, "startAt" FROM "Event" WHERE id = ${eventId} FOR UPDATE
    `;
    if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
    if (enabled && (event.status !== 'UPCOMING' || event.startAt <= new Date()))
      throw new DomainError('INVALID_STATE', 'Reminder is not available for this game');
    const participant = await tx.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!participant || participant.status !== 'JOINED')
      throw new DomainError('FORBIDDEN', 'Join the game before enabling a reminder');
    await tx.eventParticipant.update({
      where: { id: participant.id },
      data: { remindBeforeGame: enabled },
    });
    return { enabled };
  });
}

/** Explicit opt-in, in-app only. Claim and notification are atomic across replicas. */
export async function sendGameReminders(prisma: PrismaClient, now = new Date()) {
  const until = new Date(+now + 60 * 60_000);
  const events = await prisma.event.findMany({
    where: {
      status: 'UPCOMING',
      startAt: { gt: now, lte: until },
      participants: { some: { status: 'JOINED', remindBeforeGame: true, reminderSentAt: null } },
    },
    select: { id: true },
  });
  let sent = 0;
  for (const { id } of events) {
    sent += await prisma.$transaction(async (tx) => {
      const [event] = await tx.$queryRaw<{ status: string; startAt: Date }[]>`
        SELECT status, "startAt" FROM "Event" WHERE id = ${id} FOR UPDATE
      `;
      if (!event || event.status !== 'UPCOMING' || event.startAt <= now || event.startAt > until)
        return 0;
      const players = await tx.eventParticipant.findMany({
        where: { eventId: id, status: 'JOINED', remindBeforeGame: true, reminderSentAt: null },
        select: { id: true, userId: true },
      });
      if (!players.length) return 0;
      await tx.eventParticipant.updateMany({
        where: { id: { in: players.map((p) => p.id) } },
        data: { reminderSentAt: now },
      });
      await tx.notification.createMany({
        data: players.map((p) => ({
          userId: p.userId,
          type: 'EVENT_APPROACHING' as const,
          payload: { eventId: id, eventStartAt: event.startAt.toISOString() },
        })),
      });
      return players.length;
    });
  }
  return sent;
}
