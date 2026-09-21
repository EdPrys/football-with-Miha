import { z } from 'zod';
import { submitRating, DomainError } from '@app/domain';
import { router, protectedProcedure } from '../trpc.js';

const score = z.number().int().min(1).max(5);
const scores = z.object({
  pace: score,
  dribbling: score,
  passing: score,
  shooting: score,
  defending: score,
  physical: score,
});

export const ratingsRouter = router({
  // Co-attendees of a finished event that the current user hasn't rated yet.
  rateableTargets: protectedProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.prisma.event.findUnique({
        where: { id: input.eventId },
        select: { status: true },
      });
      if (!event) throw new DomainError('NOT_FOUND', 'Event not found');

      const me = await ctx.prisma.eventParticipant.findUnique({
        where: { eventId_userId: { eventId: input.eventId, userId: ctx.user.id } },
        select: { status: true },
      });
      if (event.status !== 'FINISHED' || me?.status !== 'ATTENDED') return [];

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
      return attendees
        .filter((a) => !ratedSet.has(a.userId))
        .map((a) => ({ userId: a.userId, name: a.user.name, avatarUrl: a.user.avatarUrl }));
    }),

  submit: protectedProcedure
    .input(z.object({ eventId: z.string().min(1), rateeId: z.string().min(1), scores }))
    .mutation(async ({ ctx, input }) => {
      const rating = await submitRating(ctx.prisma, {
        eventId: input.eventId,
        raterId: ctx.user.id,
        rateeId: input.rateeId,
        scores: input.scores,
      });
      return { id: rating.id };
    }),
});
