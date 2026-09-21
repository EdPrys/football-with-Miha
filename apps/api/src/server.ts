import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter } from './routers/index.js';
import { createContext } from './context.js';

export function buildServer() {
  const app = Fastify({ logger: { level: 'info' } });

  // In production set WEB_ORIGIN to the web app's URL; defaults to reflecting any
  // origin for local dev. Auth is via bearer token, so credentials stay off.
  const origin = process.env.WEB_ORIGIN ? process.env.WEB_ORIGIN.split(',') : true;
  app.register(cors, { origin, credentials: false });

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: { router: appRouter, createContext },
  });

  return app;
}
