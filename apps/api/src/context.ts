import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { prisma, type User } from '@app/db';
import { isIP } from 'node:net';
import { verifyToken } from './auth/jwt.js';

export async function createContext({ req }: CreateFastifyContextOptions) {
  let user: User | null = null;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const payload = verifyToken(header.slice('Bearer '.length));
    if (payload) {
      const candidate = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (candidate && candidate.sessionVersion === payload.sessionVersion) user = candidate;
    }
  }
  // Trust Railway's overwritten edge header only when explicitly configured.
  const edgeIp = req.headers['x-real-ip'];
  const clientIp =
    process.env.TRUST_RAILWAY_PROXY === 'true' && typeof edgeIp === 'string' && isIP(edgeIp)
      ? edgeIp
      : req.ip;
  return { prisma, user, clientIp };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
