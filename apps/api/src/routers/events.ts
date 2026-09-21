import { z } from 'zod';
import { createEvent, eventCapacity, DomainError } from '@app/domain';
import { ParticipantStatus } from '@app/db';
import { router, publicProcedure, managerProcedure } from '../trpc.js';

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
      const event = await createEvent(ctx.prisma, {
        organizerId: ctx.user.id,
        ...input,
      });
      return { id: event.id };
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
});
