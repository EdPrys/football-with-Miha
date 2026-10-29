import { z } from 'zod';
import {
  inviteToEvent,
  invitePlayers,
  respondToInvitation,
  starSummariesFor,
  DomainError,
} from '@app/domain';
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

  // Invite several players to an existing game at once.
  sendMany: protectedProcedure
    .input(
      z.object({
        eventId: z.string().min(1),
        invitedUserIds: z.array(z.string().min(1)).min(1).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const invited = await invitePlayers(ctx.prisma, {
        eventId: input.eventId,
        inviterId: ctx.user.id,
        invitedUserIds: input.invitedUserIds,
      });
      return { invited };
    }),

  // Players based in the game's city who can still be invited: not the
  // organizer, not already in the game and without a pending invitation.
  candidates: protectedProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.prisma.event.findUnique({
        where: { id: input.eventId },
        select: { organizerId: true, field: { select: { venue: { select: { cityId: true } } } } },
      });
      if (!event) throw new DomainError('NOT_FOUND', 'Event not found');

      const users = await ctx.prisma.user.findMany({
        where: {
          cityId: event.field.venue.cityId,
          id: { notIn: [ctx.user.id, event.organizerId] },
          participations: {
            none: { eventId: input.eventId, status: { in: ['JOINED', 'ATTENDED'] } },
          },
          invitationsReceived: { none: { eventId: input.eventId, status: 'PENDING' } },
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, avatarUrl: true },
        take: 500,
      });
      const stars = await starSummariesFor(
        ctx.prisma,
        users.map((u) => u.id),
      );
      return users.map((u) => ({ ...u, stars: stars.get(u.id)! }));
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
