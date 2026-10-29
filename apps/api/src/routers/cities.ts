import { sortCities } from '@app/domain';
import { router, publicProcedure } from '../trpc.js';

export const citiesRouter = router({
  // All cities for pickers (profile, venues), Kyiv first.
  list: publicProcedure.query(async ({ ctx }) => {
    return sortCities(await ctx.prisma.city.findMany());
  }),
});
