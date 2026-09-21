import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { prisma, type User } from '@app/db';
import { verifyToken } from './auth/jwt.js';

export async function createContext({ req }: CreateFastifyContextOptions) {
  let user: User | null = null;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const payload = verifyToken(header.slice('Bearer '.length));
    if (payload) {
      user = await prisma.user.findUnique({ where: { id: payload.sub } });
    }
  }
  return { prisma, user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
