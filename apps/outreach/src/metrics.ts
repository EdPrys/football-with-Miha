import { z } from 'zod';
import type { State } from './state.js';
const counts = z.number().int().nonnegative();
export const Metrics = z
  .object({
    registeredUsers: counts,
    organizers: counts,
    gamesCreated: counts,
    gamesFinished: counts,
    playersJoined: counts,
    newPlayersJoined: counts,
    playersAttended: counts,
    organizersWithRepeatGames: counts,
    organizersWithRepeatFinishedGames: counts,
  })
  .strict();
/** Read-only aggregate endpoint. Its secret is never passed to the model. */
export async function syncMetrics(
  state: State,
  save: (s: State) => Promise<void>,
  now = new Date(),
) {
  const endpoint = process.env.OUTREACH_METRICS_URL,
    token = process.env.OUTREACH_METRICS_TOKEN;
  if (!endpoint || !token) return false;
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
    throw new Error('Metrics endpoint requires HTTPS');
  if (
    url.pathname !== '/internal/outreach/metrics' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid metrics endpoint');
  for (const contact of Object.values(state.contacts)) {
    if (!contact.campaign || !contact.messages.some((m) => m.direction === 'out')) continue;
    const r = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign: contact.campaign }),
    });
    if (!r.ok)
      throw new Error(
        `Metrics unavailable (${r.status}); previously recorded figures remain stale`,
      );
    contact.metrics = { ...Metrics.parse(await r.json()), observedAt: now.toISOString() };
    await save(state);
  }
  return true;
}
