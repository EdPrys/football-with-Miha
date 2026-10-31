import { z } from 'zod';
import { eventCapacity, DomainError, assertCityExists } from '@app/domain';
import { ParticipantStatus } from '@app/db';
import { router, publicProcedure, managerProcedure, adminProcedure } from '../trpc.js';
import { venueDetailsSchema, fieldDetailsSchema, optionalWebUrl } from './venue-inputs.js';

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
      ...venue,
      city: venue.city.name,
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
    .input(
      venueDetailsSchema.extend({
        name: z.string().trim().min(1).max(120),
        cityId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCityExists(ctx.prisma, input.cityId);
      const venue = await ctx.prisma.venue.create({ data: input });
      return { id: venue.id };
    }),

  // An organizer adds a field/hall/room to an existing venue.
  addField: managerProcedure
    .input(
      fieldDetailsSchema.extend({
        venueId: z.string().min(1),
        name: z.string().trim().min(1).max(120),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        !(await ctx.prisma.venue.findUnique({ where: { id: input.venueId }, select: { id: true } }))
      ) {
        throw new DomainError('NOT_FOUND', 'Venue not found');
      }
      const field = await ctx.prisma.field.create({ data: input });
      return { id: field.id };
    }),

  // Catalogue maintenance belongs to admins; organizers can still add new places.
  update: adminProcedure
    .input(
      venueDetailsSchema.extend({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(120).optional(),
        sourceUrl: optionalWebUrl,
        verifiedAt: z.date().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (!(await ctx.prisma.venue.findUnique({ where: { id }, select: { id: true } }))) {
        throw new DomainError('NOT_FOUND', 'Venue not found');
      }
      await ctx.prisma.venue.update({ where: { id }, data });
      return { id };
    }),

  updateField: adminProcedure
    .input(
      fieldDetailsSchema.extend({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (!(await ctx.prisma.field.findUnique({ where: { id }, select: { id: true } }))) {
        throw new DomainError('NOT_FOUND', 'Field not found');
      }
      await ctx.prisma.field.update({ where: { id }, data });
      return { id };
    }),
});
