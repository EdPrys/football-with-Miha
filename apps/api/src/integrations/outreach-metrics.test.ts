import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { PrismaClient } from '@app/db';
import { registerOutreachMetrics } from './outreach-metrics.js';
const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
function setup(enabled = true) {
  vi.stubEnv('OUTREACH_METRICS_TOKEN', enabled ? 'x'.repeat(40) : '');
  vi.stubEnv('OUTREACH_CAMPAIGN_PREFIX', 'organizers_pilot');
  const db = {
    $transaction: vi.fn(async (fn: (db: unknown) => unknown) =>
      fn({ user: { findMany: async () => [] } }),
    ),
  };
  const app = Fastify();
  apps.push(app);
  registerOutreachMetrics(app, db as unknown as PrismaClient);
  return { app, db };
}
describe('read-only outreach capability', () => {
  it('is absent when disabled and rejects wrong credentials before accessing the DB', async () => {
    const off = setup(false);
    expect(
      (await off.app.inject({ method: 'POST', url: '/internal/outreach/metrics', payload: {} }))
        .statusCode,
    ).toBe(404);
    const { app, db } = setup();
    for (const authorization of [undefined, 'Bearer short', 'Bearer ' + 'y'.repeat(40)]) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/internal/outreach/metrics',
            headers: authorization ? { authorization } : {},
            payload: { campaign: 'organizers_pilot__0123456789abcdef' },
          })
        ).statusCode,
      ).toBe(401);
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('scopes requests to the configured campaign prefix and returns counts only', async () => {
    const { app, db } = setup();
    const headers = { authorization: 'Bearer ' + 'x'.repeat(40) };
    for (const campaign of [
      'other__0123456789abcdef',
      'organizers_pilot',
      'organizers_pilot__123',
    ]) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/internal/outreach/metrics',
            headers,
            payload: { campaign },
          })
        ).statusCode,
      ).toBe(400);
    }
    expect(db.$transaction).not.toHaveBeenCalled();
    const response = await app.inject({
      method: 'POST',
      url: '/internal/outreach/metrics',
      headers,
      payload: { campaign: 'organizers_pilot__0123456789abcdef' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json().registeredUsers).toBe(0);
    expect(Object.values(response.json()).every((v) => typeof v === 'number')).toBe(true);
  });
});
