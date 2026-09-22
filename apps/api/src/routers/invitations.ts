import { z } from 'zod';
import { inviteToEvent, respondToInvitation } from '@app/domain';
import { router, protectedProcedure } from '../trpc.js';

export const invitationsRouter = router({
  send: protectedProcedure
    .input(z.object({ eventId: z.string().min(1), invitedUserId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await inviteToEvent(ctx.prisma, {
        eventId: input.eventId,
        inviterId: ctx.user.id,
        invitedUserId: input.invitedUserId,
      });
      return { id: invitation.id, status: invitation.status };
    }),

  // Invitations sent to the current user, newest first.
  received: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.invitation.findMany({
      where: { invitedUserId: ctx.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        event: { include: { field: { include: { venue: true } } } },
        inviter: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }),

  respond: protectedProcedure
    .input(z.object({ invitationId: z.string().min(1), accept: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await respondToInvitation(ctx.prisma, {
        invitationId: input.invitationId,
        invitedUserId: ctx.user.id,
        accept: input.accept,
      });
      return { id: invitation.id, status: invitation.status };
    }),
});
