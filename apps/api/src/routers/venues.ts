import { router, publicProcedure } from '../trpc.js';

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
});
