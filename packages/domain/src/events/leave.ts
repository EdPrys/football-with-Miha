import type { PrismaClient } from '@app/db';
import { DomainError } from '../errors.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

/** Leave an event before it starts. Frees the slot (status CANCELLED, team cleared). */
export async function leaveEvent(
  prisma: PrismaClient,
  input: { eventId: string; userId: string },
): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { status: true, startAt: true },
  });
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
  if (event.status !== 'UPCOMING') {
    throw new DomainError('INVALID_STATE', 'Cannot leave an event that has started or ended');
  }
  if (event.startAt.getTime() < Date.now() + ONE_HOUR_MS) {
    throw new DomainError('INVALID_STATE', "You can't leave less than 1 hour before kick-off");
  }

  const participant = await prisma.eventParticipant.findUnique({
    where: { eventId_userId: { eventId: input.eventId, userId: input.userId } },
  });
  if (!participant || participant.status !== 'JOINED') {
    throw new DomainError('NOT_FOUND', 'You are not an active participant');
  }

  await prisma.eventParticipant.update({
    where: { id: participant.id },
    data: { status: 'CANCELLED', teamId: null },
  });
}
