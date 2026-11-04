import Fastify from 'fastify';
import { prisma } from '@app/db';
import { registerOutreachMetrics } from './integrations/outreach-metrics.js';
import { env } from './env.js';
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

  // The panel executes real API calls; production requires an explicit opt-in.
  const panelEnabled =
    env.API_PANEL_ENABLED === 'true' ||
    (env.API_PANEL_ENABLED === undefined && env.NODE_ENV === 'development');
  if (panelEnabled) {
    let panelHtml: string | undefined;
    app.get('/api-panel', async (_req, reply) => {
      if (!panelHtml) {
        const { renderTrpcPanel } = await import('trpc-ui');
        panelHtml = renderTrpcPanel(appRouter, {
          url: '/trpc',
          transformer: 'superjson',
          meta: {
            title: 'Kopanka API',
            description:
              'Live API explorer. Mutations change this environment. For protected procedures add an Authorization header: Bearer <token> from auth.login or auth.register. Dates use SuperJSON; see docs/API.md in the repository.',
          },
        });
      }
      return reply
        .header('Cache-Control', 'no-store')
        .type('text/html; charset=utf-8')
        .send(panelHtml);
    });
  }

  registerOutreachMetrics(app, prisma);

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
