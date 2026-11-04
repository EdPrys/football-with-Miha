import { z } from 'zod';
import {
  ALL_SKILLS,
  teammatesFor,
  attendancePercent,
  DomainError,
  MAX_SKILL,
  MIN_SKILL,
  setOwnSkills,
  starSummariesFor,
  mvpCountsFor,
} from '@app/domain';
import { router, publicProcedure, protectedProcedure, managerProcedure } from '../trpc.js';

const skillValue = z.number().int().min(MIN_SKILL).max(MAX_SKILL);
const skillValues = z.object(
  Object.fromEntries(ALL_SKILLS.map((s) => [s, skillValue])) as Record<
    (typeof ALL_SKILLS)[number],
    typeof skillValue
  >,
);

export const playersRouter = router({
  teammates: protectedProcedure
    .meta({
      description:
        'Bearer token required. Current player’s co-players from finished games where both attended. Paginated, most shared matches first. No private contact data.',
    })
    .input(z.object({ page: z.number().int().min(0).max(10000).default(0) }))
    .query(({ ctx, input }) => teammatesFor(ctx.prisma, ctx.user.id, input.page)),

  // Football profile: self-assessed skills, received stars, matches, attendance.
  profile: publicProcedure
    .meta({
      description:
        'Public. Public football profile: skills, stars, MVP count, matches and attendance.',
    })
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
          city: { select: { id: true, name: true } },
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

      const [stars, mvps, attended, noShow] = await Promise.all([
        starSummariesFor(ctx.prisma, [input.userId]),
        mvpCountsFor(ctx.prisma, [input.userId]),
        ctx.prisma.eventParticipant.count({ where: { userId: input.userId, status: 'ATTENDED' } }),
        ctx.prisma.eventParticipant.count({ where: { userId: input.userId, status: 'NO_SHOW' } }),
      ]);

      return {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        city: user.city,
        bio: user.profile?.bio ?? null,
        skills: user.profile?.skills ?? [],
        stars: stars.get(input.userId)!,
        mvpCount: mvps.get(input.userId) ?? 0,
        matchesPlayed: attended,
        attendance: attendancePercent({ attended, noShow }),
      };
    }),

  // Players based in a city, for an organizer to invite to a game there.
  inCity: managerProcedure
    .meta({ description: 'MANAGER or ADMIN required. Find players in a city for invitations.' })
    .input(z.object({ cityId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const users = await ctx.prisma.user.findMany({
        where: { cityId: input.cityId, id: { not: ctx.user.id } },
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

  // The current player sets their own skills (1–100 each).
  updateMySkills: protectedProcedure
    .meta({
      description:
        'Bearer token required. Set all six self-assessed skills to integers 1\u2013100; does not change peer stars.',
    })
    .input(skillValues)
    .mutation(async ({ ctx, input }) => {
      await setOwnSkills(ctx.prisma, ctx.user.id, input);
      return { ok: true };
    }),

  // Past (finished) matches for a player.
  matchHistory: publicProcedure
    .meta({ description: 'Public. Finished-game history for a player.' })
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const parts = await ctx.prisma.eventParticipant.findMany({
        where: { userId: input.userId, status: 'ATTENDED', event: { status: 'FINISHED' } },
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
