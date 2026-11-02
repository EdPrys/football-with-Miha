import type { AnyTRPCRouter, AnyTRPCProcedure } from '@trpc/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({
  NODE_ENV: 'development',
  API_PANEL_ENABLED: undefined as string | undefined,
}));
vi.mock('./env.js', () => ({ env: config }));
vi.mock('./context.js', () => ({
  createContext: async () => ({
    user: null,
    prisma: { city: { findMany: async () => [{ id: 'city1', name: 'Київ' }] } },
  }),
}));

import { buildServer } from './server.js';
import { appRouter } from './routers/index.js';
import { parseRouterWithOptions, type TRPCPanelMeta } from 'trpc-ui';

const servers: ReturnType<typeof buildServer>[] = [];
function server() {
  const app = buildServer();
  servers.push(app);
  return app;
}
afterEach(async () => {
  await Promise.all(servers.splice(0).map((app) => app.close()));
  config.NODE_ENV = 'development';
  config.API_PANEL_ENABLED = undefined;
});

describe('API panel and transport', () => {
  it('renders the real router with same-origin transport and SuperJSON', async () => {
    const response = await server().inject({ method: 'GET', url: '/api-panel' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toContain('Kopanka API');
    expect(response.body).toContain('"url":"/trpc"');
    expect(response.body).toContain('"transformer":"superjson"');
    expect(response.body).toContain('balanceTeams');
    expect(response.body).toContain('Bearer token required');
  });

  it.each([
    ['production', undefined, 404],
    ['test', undefined, 404],
    ['development', 'false', 404],
    ['production', 'true', 200],
  ])('applies environment policy: %s / %s', async (mode, flag, status) => {
    config.NODE_ENV = mode as string;
    config.API_PANEL_ENABLED = flag as string | undefined;
    const response = await server().inject({ method: 'GET', url: '/api-panel' });
    expect(response.statusCode).toBe(status);
  });

  it('includes every procedure and its documentation in the parsed panel', () => {
    const parsed = parseRouterWithOptions(appRouter, { transformer: 'superjson' });
    const procedures = (appRouter as AnyTRPCRouter)._def.procedures as Record<
      string,
      AnyTRPCProcedure
    >;
    for (const [path, procedure] of Object.entries(procedures)) {
      expect((procedure._def.meta as TRPCPanelMeta | undefined)?.description, path).toBeTruthy();
      const [group = '', name = ''] = path.split('.');
      const child = parsed.children[group];
      expect(child?.nodeType, path).toBe('router');
      if (child?.nodeType === 'router') expect(child.children[name], path).toBeDefined();
    }
  });

  it('serves public SuperJSON queries and still rejects unauthenticated protected calls', async () => {
    const app = server();
    const cities = await app.inject({ method: 'GET', url: '/trpc/cities.list' });
    expect(cities.statusCode).toBe(200);
    expect(cities.json().result.data.json).toEqual([{ id: 'city1', name: 'Київ' }]);
    const me = await app.inject({ method: 'GET', url: '/trpc/auth.me' });
    expect(me.statusCode).toBe(401);
    expect(me.json().error.json.data.code).toBe('UNAUTHORIZED');
  });
});
