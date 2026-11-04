import { afterEach, describe, expect, it, vi } from 'vitest';
import { syncMetrics } from './metrics.js';
import { emptyState } from './state.js';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const snapshot = {
  registeredUsers: 3,
  organizers: 1,
  gamesCreated: 1,
  gamesFinished: 0,
  playersJoined: 2,
  newPlayersJoined: 2,
  playersAttended: 0,
  organizersWithRepeatGames: 0,
  organizersWithRepeatFinishedGames: 0,
};
function state() {
  const s = emptyState();
  s.contacts['123'] = {
    id: '123',
    username: '@organizer',
    source: '@football_kyiv',
    sourceMessageId: 1,
    evidence: 'футбол',
    status: 'contacted',
    handledInboundId: 0,
    campaign: 'organizers_pilot__0123456789abcdef',
    messages: [{ id: 1, text: 'test', direction: 'out', at: '2030-01-01T09:00:00Z' }],
  };
  return s;
}
describe('optional aggregate synchronization', () => {
  it('uses no model or network when disabled', async () => {
    vi.stubEnv('OUTREACH_METRICS_URL', '');
    vi.stubEnv('OUTREACH_METRICS_TOKEN', '');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await syncMetrics(state(), async () => {})).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('sends only an opaque campaign, records observed counts and retains them after failure', async () => {
    vi.stubEnv('OUTREACH_METRICS_URL', 'https://api.example.com/internal/outreach/metrics');
    vi.stubEnv('OUTREACH_METRICS_TOKEN', 'secret');
    const s = state();
    const fetch = vi.fn(async (_url: unknown, _options: unknown) => ({
      ok: true,
      json: async () => snapshot,
    }));
    vi.stubGlobal('fetch', fetch);
    const save = vi.fn(async () => {});
    await syncMetrics(s, save, new Date('2030-01-01T09:00:00Z'));
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      body: '{"campaign":"organizers_pilot__0123456789abcdef"}',
      redirect: 'error',
    });
    expect(s.contacts['123']?.metrics?.newPlayersJoined).toBe(2);
    expect(save).toHaveBeenCalled();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503 })),
    );
    await expect(syncMetrics(s, save)).rejects.toThrow('previously');
    expect(s.contacts['123']?.metrics?.registeredUsers).toBe(3);
  });
});
