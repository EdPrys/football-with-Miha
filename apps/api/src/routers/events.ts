import { z } from 'zod';
import {
  createEvent,
  eventCapacity,
  joinEvent,
  leaveEvent,
  startEvent,
  finishEvent,
  cancelEvent,
  assignTeam,
  DomainError,
} from '@app/domain';
import { ParticipantStatus, Position, type Prisma } from '@app/db';
import { router, publicProcedure, protectedProcedure, managerProcedure } from '../trpc.js';

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
        playersPerTeam: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const event = await createEvent(ctx.prisma, { organizerId: ctx.user.id, ...input });
      return { id: event.id };
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
          field: { include: { venue: true } },
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
          venue: e.field.venue.name,
          city: e.field.venue.city,
          field: e.field.name,
          capacity,
          joinedCount: e._count.participants,
          availableSlots: Math.max(0, capacity - e._count.participants),
        };
      });

      return input?.onlyAvailable ? mapped.filter((e) => e.availableSlots > 0) : mapped;
    }),

  // Full event detail for the Event page.
  get: publicProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    const event = await ctx.prisma.event.findUnique({
      where: { id: input.id },
      include: {
        field: { include: { venue: true } },
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
    return {
      ...event,
      capacity,
      joinedCount: event.participants.length,
      availableSlots: Math.max(0, capacity - event.participants.length),
    };
  }),

  join: protectedProcedure
    .input(z.object({ eventId: z.string().min(1), position: z.nativeEnum(Position) }))
    .mutation(async ({ ctx, input }) => {
      const p = await joinEvent(ctx.prisma, {
        eventId: input.eventId,
        userId: ctx.user.id,
        position: input.position,
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

  assignTeam: protectedProcedure
    .input(
      z.object({
        eventId: z.string().min(1),
        userId: z.string().min(1),
        teamId: z.string().min(1).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const p = await assignTeam(ctx.prisma, {
        eventId: input.eventId,
        organizerId: ctx.user.id,
        userId: input.userId,
        teamId: input.teamId,
      });
      return { participantId: p.id, teamId: p.teamId };
    }),
});
