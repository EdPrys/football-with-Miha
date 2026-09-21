import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter } from './routers/index.js';
import { createContext } from './context.js';

export function buildServer() {
  const app = Fastify({ logger: { level: 'info' } });

  app.register(cors, { origin: true });

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: { router: appRouter, createContext },
  });

  return app;
}
