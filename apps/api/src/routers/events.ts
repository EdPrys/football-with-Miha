import { z } from 'zod';
import {
  createEvent,
  eventCapacity,
  invitePlayers,
  joinEvent,
  leaveEvent,
  startEvent,
  finishEvent,
  cancelEvent,
  deleteEvent,
  rebalanceEventTeams,
  canAddTeam,
  DomainError,
  MIN_PLAYERS_PER_TEAM,
  MAX_PLAYERS_PER_TEAM,
  ratingClosesAt,
  starSummariesFor,
  mvpCountsFor,
} from '@app/domain';
import { ParticipantStatus, Position, type Prisma, type PrismaClient } from '@app/db';
import { router, publicProcedure, protectedProcedure, managerProcedure } from '../trpc.js';
import { deleteTelegramMessage, postToTelegram } from '../integrations/telegram.js';
import { eventAnnouncementText } from '../integrations/event-announcement.js';

// Participants that count toward a filled slot.
const ACTIVE_STATUSES: ParticipantStatus[] = [ParticipantStatus.JOINED, ParticipantStatus.ATTENDED];

export const eventsRouter = router({
  create: managerProcedure
    .input(
      z.object({
        fieldId: z.string().min(1),
        startAt: z.date(),
        endAt: z.date(),
        numberOfTeams: z.number().int().min(2),
        playersPerTeam: z.number().int().min(MIN_PLAYERS_PER_TEAM).max(MAX_PLAYERS_PER_TEAM),
        // Players to invite right away (picked from the game's city).
        invitedUserIds: z.array(z.string().min(1)).max(200).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { invitedUserIds, ...data } = input;
      const event = await createEvent(ctx.prisma, { organizerId: ctx.user.id, ...data });
      const invited = await invitePlayers(ctx.prisma, {
        eventId: event.id,
        inviterId: ctx.user.id,
        invitedUserIds,
      });

      const field = await ctx.prisma.field.findUnique({
        where: { id: input.fieldId },
        include: { venue: { include: { city: true } } },
      });
      if (field) void announce(ctx.prisma, event.id, eventAnnouncementText(event, field));

      return { id: event.id, invited };
    }),

  // Discovery feed: upcoming events with free-slot info and simple filters.
  list: publicProcedure
    .input(
      z
        .object({
          dateFrom: z.date().optional(),
          dateTo: z.date().optional(),
          playersPerTeam: z.number().int().min(1).optional(),
          onlyAvailable: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.EventWhereInput = {
        status: 'UPCOMING',
        startAt: {
          gte: input?.dateFrom ?? new Date(),
          ...(input?.dateTo ? { lte: input.dateTo } : {}),
        },
        ...(input?.playersPerTeam ? { playersPerTeam: input.playersPerTeam } : {}),
      };

      const events = await ctx.prisma.event.findMany({
        where,
        orderBy: { startAt: 'asc' },
        include: {
          field: { include: { venue: { include: { city: true } } } },
          _count: { select: { participants: { where: { status: { in: ACTIVE_STATUSES } } } } },
        },
      });

      const mapped = events.map((e) => {
        const capacity = eventCapacity(e);
        return {
          id: e.id,
          startAt: e.startAt,
          endAt: e.endAt,
          numberOfTeams: e.numberOfTeams,
          playersPerTeam: e.playersPerTeam,
          venueId: e.field.venue.id,
          venue: e.field.venue.name,
          city: e.field.venue.city.name,
          field: e.field.name,
          capacity,
          joinedCount: e._count.participants,
          availableSlots: Math.max(0, capacity - e._count.participants),
          canAddTeam: canAddTeam(e, e._count.participants),
        };
      });

      return input?.onlyAvailable ? mapped.filter((e) => e.availableSlots > 0) : mapped;
    }),

  // Events the current user organizes or actively participates in.
  mine: protectedProcedure.query(async ({ ctx }) => {
    const events = await ctx.prisma.event.findMany({
      where: {
        OR: [
          { organizerId: ctx.user.id },
          { participants: { some: { userId: ctx.user.id, status: { in: ACTIVE_STATUSES } } } },
        ],
      },
      orderBy: { startAt: 'desc' },
      include: {
        field: { include: { venue: true } },
        _count: { select: { participants: { where: { status: { in: ACTIVE_STATUSES } } } } },
      },
    });
    return events.map((e) => {
      const capacity = eventCapacity(e);
      return {
        id: e.id,
        startAt: e.startAt,
        endAt: e.endAt,
        status: e.status,
        playersPerTeam: e.playersPerTeam,
        venue: e.field.venue.name,
        field: e.field.name,
        isOrganizer: e.organizerId === ctx.user.id,
        joinedCount: e._count.participants,
        capacity,
        availableSlots: Math.max(0, capacity - e._count.participants),
      };
    });
  }),

  // Full event detail for the Event page.
  get: publicProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    const event = await ctx.prisma.event.findUnique({
      where: { id: input.id },
      include: {
        field: { include: { venue: { include: { city: true } } } },
        organizer: { select: { id: true, name: true, avatarUrl: true } },
        teams: { orderBy: { name: 'asc' } },
        participants: {
          where: { status: { in: ACTIVE_STATUSES } },
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!event) throw new DomainError('NOT_FOUND', 'Event not found');

    const capacity = eventCapacity(event);
    const userIds = event.participants.map((p) => p.userId);
    const [stars, mvps] = await Promise.all([
      starSummariesFor(ctx.prisma, userIds),
      mvpCountsFor(ctx.prisma, userIds),
    ]);
    return {
      ...event,
      participants: event.participants.map((p) => ({
        ...p,
        user: { ...p.user, stars: stars.get(p.userId)!, mvpCount: mvps.get(p.userId) ?? 0 },
      })),
      ratingClosesAt: ratingClosesAt(event.finishedAt),
      capacity,
      joinedCount: event.participants.length,
      availableSlots: Math.max(0, capacity - event.participants.length),
      canAddTeam: canAddTeam(event, event.participants.length),
    };
  }),

  join: protectedProcedure
    .input(
      z.object({
        eventId: z.string().min(1),
        position: z.nativeEnum(Position),
        teamId: z.string().min(1).nullable().optional(),
        // All slots taken: open the next team and join it.
        newTeam: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const p = await joinEvent(ctx.prisma, {
        eventId: input.eventId,
        userId: ctx.user.id,
        position: input.position,
        teamId: input.teamId,
        newTeam: input.newTeam,
      });
      return { participantId: p.id, status: p.status, position: p.preferredPosition };
    }),

  leave: protectedProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await leaveEvent(ctx.prisma, { eventId: input.eventId, userId: ctx.user.id });
      return { ok: true };
    }),

  // --- Organizer management (organizer identity enforced in the domain layer) ---
  start: protectedProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const e = await startEvent(ctx.prisma, { eventId: input.eventId, organizerId: ctx.user.id });
      return { id: e.id, status: e.status };
    }),

  finish: protectedProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const e = await finishEvent(ctx.prisma, { eventId: input.eventId, organizerId: ctx.user.id });
      return { id: e.id, status: e.status };
    }),

  cancel: protectedProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const e = await cancelEvent(ctx.prisma, { eventId: input.eventId, organizerId: ctx.user.id });
      return { id: e.id, status: e.status };
    }),

  // Only while nobody has joined; also removes the channel post.
  delete: protectedProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { telegramMessageId } = await deleteEvent(ctx.prisma, {
        eventId: input.eventId,
        organizerId: ctx.user.id,
      });
      if (telegramMessageId !== null) void deleteTelegramMessage(telegramMessageId);
      return { ok: true };
    }),

  // Reshuffle players into teams of equal strength by stars.
  balanceTeams: protectedProcedure
    .input(z.object({ eventId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const moved = await rebalanceEventTeams(ctx.prisma, {
        eventId: input.eventId,
        organizerId: ctx.user.id,
      });
      return { moved };
    }),
});

/** Posts the game to the channel and remembers the post so deleting the game can remove it. */
async function announce(prisma: PrismaClient, eventId: string, text: string) {
  const messageId = await postToTelegram(text);
  if (messageId === null) return;
  await prisma.event
    .update({ where: { id: eventId }, data: { telegramMessageId: messageId } })
    .catch((err: unknown) => console.error('Saving Telegram post id failed:', err));
}
