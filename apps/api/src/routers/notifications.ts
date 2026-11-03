import { setCityGameSubscription } from '@app/domain';
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';

function invitationIdOf(payload: unknown): string | undefined {
  if (payload && typeof payload === 'object' && 'invitationId' in payload) {
    const id = (payload as { invitationId: unknown }).invitationId;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}

export const notificationsRouter = router({
  gameSubscriptions: protectedProcedure
    .meta({
      description:
        'Bearer token required. List your city subscriptions for in-app notifications about newly created games.',
    })
    .query(({ ctx }) =>
      ctx.prisma.cityGameSubscription.findMany({
        where: { userId: ctx.user.id },
        include: { city: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ),
  subscribeCity: protectedProcedure
    .meta({
      description:
        'Bearer token required. Subscribe/unsubscribe yourself to new games in one city. In-app only, all future dates; no email or push.',
    })
    .input(z.object({ cityId: z.string().min(1), subscribed: z.boolean() }))
    .mutation(({ ctx, input }) =>
      setCityGameSubscription(ctx.prisma, ctx.user.id, input.cityId, input.subscribed),
    ),

  mine: protectedProcedure
    .meta({ description: 'Bearer token required. Current user notifications and activity.' })
    .query(async ({ ctx }) => {
      const [notifications, unreadCount] = await Promise.all([
        ctx.prisma.notification.findMany({
          where: { userId: ctx.user.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        ctx.prisma.notification.count({ where: { userId: ctx.user.id, readAt: null } }),
      ]);

      // INVITATION_RECEIVED cards need the invitation's *current* status (not
      // what it was when the notification was created) to know whether to
      // still show Accept/Decline.
      const invitationIds = notifications
        .map((n) => (n.type === 'INVITATION_RECEIVED' ? invitationIdOf(n.payload) : undefined))
        .filter((id): id is string => !!id);
      const invitations = invitationIds.length
        ? await ctx.prisma.invitation.findMany({
            where: { id: { in: invitationIds } },
            select: { id: true, status: true },
          })
        : [];
      const statusById = new Map(invitations.map((i) => [i.id, i.status]));

      const enriched = notifications.map((n) => ({
        ...n,
        invitationStatus: statusById.get(invitationIdOf(n.payload) ?? '') ?? null,
      }));

      return { notifications: enriched, unreadCount };
    }),

  markAllRead: protectedProcedure
    .meta({ description: 'Bearer token required. Mark all current user notifications as read.' })
    .mutation(async ({ ctx }) => {
      await ctx.prisma.notification.updateMany({
        where: { userId: ctx.user.id, readAt: null },
        data: { readAt: new Date() },
      });
      return { ok: true };
    }),

  markRead: protectedProcedure
    .meta({ description: 'Bearer token required. Mark one current user notification as read.' })
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.notification.updateMany({
        where: { id: input.id, userId: ctx.user.id },
        data: { readAt: new Date() },
      });
      return { ok: true };
    }),
});
