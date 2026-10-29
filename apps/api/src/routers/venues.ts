import { z } from 'zod';
import { eventCapacity, DomainError, assertCityExists } from '@app/domain';
import { ParticipantStatus } from '@app/db';
import { router, publicProcedure, managerProcedure } from '../trpc.js';

const ACTIVE: ParticipantStatus[] = [ParticipantStatus.JOINED, ParticipantStatus.ATTENDED];

export const venuesRouter = router({
  // Venues with their active fields — used by the Create Event form.
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.venue.findMany({
      orderBy: { name: 'asc' },
      include: {
        city: true,
        fields: { where: { isActive: true }, orderBy: { name: 'asc' } },
      },
    });
  }),

  // Venue / stadium profile: fields + upcoming games here.
  get: publicProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    const venue = await ctx.prisma.venue.findUnique({
      where: { id: input.id },
      include: { city: true, fields: { orderBy: { name: 'asc' } } },
    });
    if (!venue) throw new DomainError('NOT_FOUND', 'Venue not found');

    const events = await ctx.prisma.event.findMany({
      where: { field: { venueId: input.id }, status: 'UPCOMING', startAt: { gte: new Date() } },
      orderBy: { startAt: 'asc' },
      include: {
        field: true,
        _count: { select: { participants: { where: { status: { in: ACTIVE } } } } },
      },
    });

    return {
      id: venue.id,
      name: venue.name,
      city: venue.city.name,
      fields: venue.fields,
      events: events.map((e) => {
        const capacity = eventCapacity(e);
        return {
          id: e.id,
          startAt: e.startAt,
          endAt: e.endAt,
          field: e.field.name,
          playersPerTeam: e.playersPerTeam,
          availableSlots: Math.max(0, capacity - e._count.participants),
        };
      }),
    };
  }),

  // Organizers (manager+) create places; players can't, so the catalogue
  // isn't spammed with empty venues.
  create: managerProcedure
    .input(z.object({ name: z.string().min(1).max(120), cityId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertCityExists(ctx.prisma, input.cityId);
      const venue = await ctx.prisma.venue.create({ data: input });
      return { id: venue.id };
    }),

  // An organizer adds a field/hall/room to an existing venue.
  addField: managerProcedure
    .input(
      z.object({
        venueId: z.string().min(1),
        name: z.string().min(1).max(120),
        capacity: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const field = await ctx.prisma.field.create({ data: input });
      return { id: field.id };
    }),
});
