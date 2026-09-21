import { z } from 'zod';
import { router, publicProcedure, adminProcedure } from '../trpc.js';

export const venuesRouter = router({
  // Venues with their active fields — used by the Create Event form.
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.venue.findMany({
      orderBy: { name: 'asc' },
      include: {
        fields: { where: { isActive: true }, orderBy: { name: 'asc' } },
      },
    });
  }),

  // Only admins create places, so the catalogue isn't spammed with empty venues.
  create: adminProcedure
    .input(z.object({ name: z.string().min(1).max(120), city: z.string().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const venue = await ctx.prisma.venue.create({ data: input });
      return { id: venue.id };
    }),

  // Admin adds a field/hall/room to an existing venue.
  addField: adminProcedure
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
