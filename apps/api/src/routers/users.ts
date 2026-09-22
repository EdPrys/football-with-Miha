import { z } from 'zod';
import { Role } from '@app/db';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';

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

  // Admin: the full user directory, for role management.
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
  }),

  // Admin: promote/demote a user. PLAYER < MANAGER < ADMIN.
  setRole: adminProcedure
    .input(z.object({ userId: z.string().min(1), role: z.nativeEnum(Role) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({ where: { id: input.userId }, data: { role: input.role } });
      return { ok: true };
    }),
});
