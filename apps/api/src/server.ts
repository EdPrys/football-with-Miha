import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter } from './routers/index.js';
import { createContext } from './context.js';
import { signedAvatarUrl } from './integrations/avatar-storage.js';

export function buildServer() {
  const app = Fastify({ logger: { level: 'info' } });

  // In production set WEB_ORIGIN to the web app's URL; defaults to reflecting any
  // origin for local dev. Auth is via bearer token, so credentials stay off.
  const origin = process.env.WEB_ORIGIN ? process.env.WEB_ORIGIN.split(',') : true;
  app.register(cors, { origin, credentials: false });

  app.get('/health', async () => ({ status: 'ok' }));

  // Avatars sit in a private bucket: send the browser to a presigned URL so the
  // image itself is served by the bucket, not by this API.
  app.get<{ Params: { file: string } }>('/avatars/:file', async (req, reply) => {
    const url = await signedAvatarUrl(req.params.file);
    if (!url) return reply.code(404).send();
    return reply.header('Cache-Control', 'public, max-age=3600').redirect(url, 302);
  });

  app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: { router: appRouter, createContext },
  });

  return app;
}
