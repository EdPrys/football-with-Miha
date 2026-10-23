import { z } from 'zod';
import { Role } from '@app/db';
import { requestOrganizerRole } from '@app/domain';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';

// An avatar is either a link or a small inline image. Uploads are resized
// client-side (~256px JPEG, a few dozen KB) and stored as a data URL, so no
// file storage is needed yet; the cap keeps a rogue client from bloating rows.
const AVATAR_DATA_URL_MAX = 300_000;
const avatarInput = z.union([
  z.string().url().max(2000).startsWith('https://'),
  z
    .string()
    .max(AVATAR_DATA_URL_MAX)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/),
]);

export const usersRouter = router({
  // Set or clear your avatar: an https image link or an uploaded image (data URL).
  updateAvatar: protectedProcedure
    .input(z.object({ avatarUrl: avatarInput.nullable() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { avatarUrl: input.avatarUrl },
      });
      return { ok: true };
    }),

  // A player asks to become an organizer (auto-approved for now, see domain).
  requestOrganizer: protectedProcedure.mutation(async ({ ctx }) => {
    const request = await requestOrganizerRole(ctx.prisma, ctx.user.id);
    return { status: request.status };
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
