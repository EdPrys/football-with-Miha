import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';

export const usersRouter = router({
  // Set or clear your avatar (image URL). Upload-from-device is future work.
  updateAvatar: protectedProcedure
    .input(z.object({ avatarUrl: z.string().url().max(2000).nullable() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { avatarUrl: input.avatarUrl },
      });
      return { ok: true };
    }),
});
