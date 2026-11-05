import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), verifyToken: vi.fn() }));
vi.mock('@app/db', () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock('./auth/jwt.js', () => ({ verifyToken: mocks.verifyToken }));
import { createContext } from './context.js';

const context = (headers: Record<string, string> = {}) =>
  createContext({
    req: { headers, ip: '127.0.0.1' },
  } as unknown as CreateFastifyContextOptions);

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe('authentication context after password reset', () => {
  it('rejects an otherwise valid JWT issued before the current session version', async () => {
    mocks.verifyToken.mockReturnValue({ sub: 'u1', sessionVersion: 0 });
    mocks.findUnique.mockResolvedValue({ id: 'u1', sessionVersion: 1 });
    expect((await context({ authorization: 'Bearer old' })).user).toBeNull();
    mocks.verifyToken.mockReturnValue({ sub: 'u1', sessionVersion: 1 });
    expect((await context({ authorization: 'Bearer new' })).user?.id).toBe('u1');
  });

  it('does not trust client IP headers by default', async () => {
    vi.stubEnv('TRUST_RAILWAY_PROXY', 'false');
    expect((await context({ 'x-real-ip': '203.0.113.20' })).clientIp).toBe('127.0.0.1');
  });

  it('uses only a valid edge IP when explicit Railway proxy trust is enabled', async () => {
    vi.stubEnv('TRUST_RAILWAY_PROXY', 'true');
    expect((await context({ 'x-real-ip': '2001:db8::1' })).clientIp).toBe('2001:db8::1');
    expect((await context({ 'x-real-ip': 'invalid' })).clientIp).toBe('127.0.0.1');
    expect((await context()).clientIp).toBe('127.0.0.1');
  });
});
