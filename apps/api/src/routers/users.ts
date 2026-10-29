import { z } from 'zod';
import { Role } from '@app/db';
import { requestOrganizerRole, setUserCity } from '@app/domain';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import {
  avatarStorageEnabled,
  deleteStoredAvatar,
  storeAvatar,
} from '../integrations/avatar-storage.js';

// An avatar is either a link or a small uploaded image. Uploads are resized
// client-side (~256px JPEG, a few dozen KB) and sent as a data URL; with avatar
// storage configured they go to the bucket, otherwise they're kept inline.
// The cap keeps a rogue client from sending huge images.
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
      const avatarUrl =
        input.avatarUrl?.startsWith('data:') && avatarStorageEnabled
          ? await storeAvatar(ctx.user.id, input.avatarUrl)
          : input.avatarUrl;
      await ctx.prisma.user.update({ where: { id: ctx.user.id }, data: { avatarUrl } });
      if (ctx.user.avatarUrl !== avatarUrl) {
        await deleteStoredAvatar(ctx.user.avatarUrl).catch(() => {});
      }
      return { ok: true };
    }),

  // Change the city you are based in (organizers invite players by city).
  updateCity: protectedProcedure
    .input(z.object({ cityId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await setUserCity(ctx.prisma, ctx.user.id, input.cityId);
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
