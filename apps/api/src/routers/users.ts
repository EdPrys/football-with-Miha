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

  // Look a teammate up by email to invite them to an event.
  findByEmail: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true, name: true, avatarUrl: true },
      });
    }),
});
