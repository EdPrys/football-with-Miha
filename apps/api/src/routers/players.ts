import { z } from 'zod';
import { attendancePercent, DomainError } from '@app/domain';
import { router, publicProcedure } from '../trpc.js';

export const playersRouter = router({
  // Aggregated football profile: skills, ratings, matches, attendance.
  profile: publicProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
          profile: {
            select: {
              bio: true,
              skills: {
                orderBy: { skill: 'asc' },
                select: { skill: true, value: true, ratingsCount: true },
              },
            },
          },
        },
      });
      if (!user) throw new DomainError('NOT_FOUND', 'Player not found');

      const [totalRatings, attended, noShow] = await Promise.all([
        ctx.prisma.rating.count({ where: { rateeId: input.userId } }),
        ctx.prisma.eventParticipant.count({ where: { userId: input.userId, status: 'ATTENDED' } }),
        ctx.prisma.eventParticipant.count({ where: { userId: input.userId, status: 'NO_SHOW' } }),
      ]);

      return {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        bio: user.profile?.bio ?? null,
        skills: user.profile?.skills ?? [],
        totalRatings,
        matchesPlayed: attended,
        attendance: attendancePercent({ attended, noShow }),
      };
    }),

  // Past (finished) matches for a player.
  matchHistory: publicProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const parts = await ctx.prisma.eventParticipant.findMany({
        where: { userId: input.userId, event: { status: 'FINISHED' } },
        include: {
          event: { include: { field: { include: { venue: true } } } },
          team: { select: { name: true } },
        },
        orderBy: { event: { startAt: 'desc' } },
      });
      return parts.map((p) => ({
        eventId: p.eventId,
        date: p.event.startAt,
        venue: p.event.field.venue.name,
        field: p.event.field.name,
        format: `${p.event.numberOfTeams}x${p.event.playersPerTeam}`,
        team: p.team?.name ?? null,
        position: p.preferredPosition,
        attendance: p.status,
      }));
    }),
});
