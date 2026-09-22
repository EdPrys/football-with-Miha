import type { Invitation, PrismaClient } from '@app/db';
import { DomainError } from '../errors.js';
import { notify } from '../notifications/create.js';

export interface RespondInput {
  invitationId: string;
  invitedUserId: string;
  accept: boolean;
}

/** Accept or decline an invitation. Accepting does not auto-join — the
 * invitee still picks a position/team on the pitch, same as anyone else. */
export async function respondToInvitation(
  prisma: PrismaClient,
  input: RespondInput,
): Promise<Invitation> {
  const invitation = await prisma.invitation.findUnique({
    where: { id: input.invitationId },
    include: { event: { select: { id: true, startAt: true } } },
  });
  if (!invitation) throw new DomainError('NOT_FOUND', 'Invitation not found');
  if (invitation.invitedUserId !== input.invitedUserId) {
    throw new DomainError('FORBIDDEN', 'This invitation is not yours');
  }
  if (invitation.status !== 'PENDING') {
    throw new DomainError('INVALID_STATE', 'This invitation was already answered');
  }

  const updated = await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: input.accept ? 'ACCEPTED' : 'DECLINED' },
  });

  if (input.accept) {
    const invitedUser = await prisma.user.findUnique({
      where: { id: input.invitedUserId },
      select: { name: true },
    });
    await notify(prisma, {
      userId: invitation.inviterId,
      type: 'INVITATION_ACCEPTED',
      payload: {
        invitationId: invitation.id,
        eventId: invitation.event.id,
        eventStartAt: invitation.event.startAt.toISOString(),
        invitedUserName: invitedUser?.name ?? '',
      },
    });
  }

  return updated;
}
