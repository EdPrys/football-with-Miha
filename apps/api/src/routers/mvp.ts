import { z } from 'zod';
import { castMvpVote, ratingClosesAt, DomainError } from '@app/domain';
import { router, publicProcedure, protectedProcedure } from '../trpc.js';

export const mvpRouter = router({
  // MVP state of a game: winners once decided; for a player of the match also
  // who they can vote for and their own vote.
  status: publicProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.prisma.event.findUnique({
        where: { id: input.eventId },
        select: {
          status: true,
          finishedAt: true,
          mvpResolvedAt: true,
          mvps: {
            orderBy: { votes: 'desc' },
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
      });
      if (!event) throw new DomainError('NOT_FOUND', 'Event not found');

      const closesAt = ratingClosesAt(event.finishedAt);
      const open =
        event.status === 'FINISHED' && !event.mvpResolvedAt && !!closesAt && new Date() <= closesAt;
      const winners = event.mvps.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        votes: m.votes,
      }));

      const userId = ctx.user?.id;
      const me = userId
        ? await ctx.prisma.eventParticipant.findUnique({
            where: { eventId_userId: { eventId: input.eventId, userId } },
            select: { status: true },
          })
        : null;
      if (!userId || me?.status !== 'ATTENDED') {
        return {
          open,
          closesAt,
          resolved: !!event.mvpResolvedAt,
          winners,
          canVote: false,
          myVote: null,
          candidates: [],
        };
      }

      const [myVote, players] = await Promise.all([
        ctx.prisma.mvpVote.findUnique({
          where: { eventId_voterId: { eventId: input.eventId, voterId: userId } },
          select: { nomineeId: true },
        }),
        ctx.prisma.eventParticipant.findMany({
          where: { eventId: input.eventId, status: 'ATTENDED', userId: { not: userId } },
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { joinedAt: 'asc' },
        }),
      ]);
      return {
        open,
        closesAt,
        resolved: !!event.mvpResolvedAt,
        winners,
        canVote: open && !myVote,
        myVote: myVote?.nomineeId ?? null,
        candidates: players.map((p) => ({
          userId: p.userId,
          name: p.user.name,
          avatarUrl: p.user.avatarUrl,
        })),
      };
    }),

  vote: protectedProcedure
    .input(z.object({ eventId: z.string().min(1), nomineeId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await castMvpVote(ctx.prisma, { ...input, voterId: ctx.user.id });
      return { ok: true };
    }),
});
