import { z } from 'zod';
import { submitRatings, ratingClosesAt, DomainError, MAX_STARS } from '@app/domain';
import { router, protectedProcedure } from '../trpc.js';

export const ratingsRouter = router({
  // Co-attendees of a finished event that the current user hasn't rated yet,
  // plus when rating closes (24h after the finish). Empty once closed.
  rateableTargets: protectedProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.prisma.event.findUnique({
        where: { id: input.eventId },
        select: { status: true, finishedAt: true },
      });
      if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
      const closesAt = ratingClosesAt(event.finishedAt);
      const closed = {
        closesAt,
        targets: [] as { userId: string; name: string; avatarUrl: string | null }[],
      };
      if (closesAt && new Date() > closesAt) return closed;

      const me = await ctx.prisma.eventParticipant.findUnique({
        where: { eventId_userId: { eventId: input.eventId, userId: ctx.user.id } },
        select: { status: true },
      });
      if (event.status !== 'FINISHED' || me?.status !== 'ATTENDED') return closed;

      const [attendees, rated] = await Promise.all([
        ctx.prisma.eventParticipant.findMany({
          where: { eventId: input.eventId, status: 'ATTENDED', userId: { not: ctx.user.id } },
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        }),
        ctx.prisma.rating.findMany({
          where: { eventId: input.eventId, raterId: ctx.user.id },
          select: { rateeId: true },
        }),
      ]);
      const ratedSet = new Set(rated.map((r) => r.rateeId));
      const targets = attendees
        .filter((a) => !ratedSet.has(a.userId))
        .map((a) => ({ userId: a.userId, name: a.user.name, avatarUrl: a.user.avatarUrl }));
      return { closesAt, targets };
    }),

  // Stars for the whole list at once; players left at 0 stars aren't rated.
  submit: protectedProcedure
    .input(
      z.object({
        eventId: z.string().min(1),
        ratings: z
          .array(
            z.object({
              rateeId: z.string().min(1),
              stars: z.number().int().min(0).max(MAX_STARS),
            }),
          )
          .max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const saved = await submitRatings(ctx.prisma, {
        eventId: input.eventId,
        raterId: ctx.user.id,
        ratings: input.ratings,
      });
      return { saved };
    }),
});
