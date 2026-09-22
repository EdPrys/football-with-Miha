import type { Invitation, PrismaClient } from '@app/db';
import { DomainError } from '../errors.js';
import { notify } from '../notifications/create.js';

const ACTIVE_STATUSES = ['JOINED', 'ATTENDED'];

export interface InviteInput {
  eventId: string;
  inviterId: string;
  invitedUserId: string;
}

/**
 * Invite a user to an event. Only the organizer or someone already active in
 * the event can invite — invitations are for bringing friends in, not a
 * public spam channel. Re-inviting someone who previously declined resets
 * their invitation to PENDING instead of failing on the unique constraint.
 */
export async function inviteToEvent(prisma: PrismaClient, input: InviteInput): Promise<Invitation> {
  if (input.inviterId === input.invitedUserId) {
    throw new DomainError('VALIDATION', 'You cannot invite yourself');
  }

  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { id: true, status: true, organizerId: true, startAt: true },
  });
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
  if (event.status !== 'UPCOMING') {
    throw new DomainError('INVALID_STATE', 'Can only invite to an upcoming event');
  }

  if (event.organizerId !== input.inviterId) {
    const inviterParticipant = await prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId: input.eventId, userId: input.inviterId } },
    });
    if (!inviterParticipant || !ACTIVE_STATUSES.includes(inviterParticipant.status)) {
      throw new DomainError('FORBIDDEN', 'Only the organizer or a participant can invite others');
    }
  }

  const invitedUser = await prisma.user.findUnique({
    where: { id: input.invitedUserId },
    select: { id: true, name: true },
  });
  if (!invitedUser) throw new DomainError('NOT_FOUND', 'User not found');

  const alreadyParticipant = await prisma.eventParticipant.findUnique({
    where: { eventId_userId: { eventId: input.eventId, userId: input.invitedUserId } },
  });
  if (alreadyParticipant && ACTIVE_STATUSES.includes(alreadyParticipant.status)) {
    throw new DomainError('CONFLICT', 'This person already joined the event');
  }

  const existing = await prisma.invitation.findUnique({
    where: {
      eventId_invitedUserId: { eventId: input.eventId, invitedUserId: input.invitedUserId },
    },
  });
  if (existing?.status === 'PENDING') {
    throw new DomainError('CONFLICT', 'Already invited');
  }

  const invitation = existing
    ? await prisma.invitation.update({
        where: { id: existing.id },
        data: { status: 'PENDING', inviterId: input.inviterId },
      })
    : await prisma.invitation.create({
        data: {
          eventId: input.eventId,
          inviterId: input.inviterId,
          invitedUserId: input.invitedUserId,
        },
      });

  const inviter = await prisma.user.findUnique({
    where: { id: input.inviterId },
    select: { name: true },
  });
  await notify(prisma, {
    userId: input.invitedUserId,
    type: 'INVITATION_RECEIVED',
    payload: {
      invitationId: invitation.id,
      eventId: event.id,
      eventStartAt: event.startAt.toISOString(),
      inviterName: inviter?.name ?? '',
    },
  });

  return invitation;
}
