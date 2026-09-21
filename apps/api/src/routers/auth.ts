import { z } from 'zod';
import { assertValidPassword, createUserWithProfile, DomainError } from '@app/domain';
import type { User } from '@app/db';
import { router, publicProcedure, protectedProcedure } from '../trpc.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { signToken } from '../auth/jwt.js';

/** Strip secrets before returning a user to a client. */
function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

export const authRouter = router({
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80),
        email: z.string().email(),
        password: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertValidPassword(input.password);
      const passwordHash = await hashPassword(input.password);
      const user = await createUserWithProfile(ctx.prisma, {
        name: input.name,
        email: input.email,
        passwordHash,
      });
      return { token: signToken(user.id), user: publicUser(user) };
    }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
        throw new DomainError('VALIDATION', 'Invalid email or password');
      }
      return { token: signToken(user.id), user: publicUser(user) };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ctx.prisma.playerProfile.findUnique({
      where: { userId: ctx.user.id },
      include: { skills: true },
    });
    return { user: publicUser(ctx.user), profile };
  }),
});
