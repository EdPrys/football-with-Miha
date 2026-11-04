import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyState, Store } from './state.js';
const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});
async function store() {
  const dir = await mkdtemp(join(tmpdir(), 'kopanka-outreach-'));
  dirs.push(dir);
  return new Store(dir);
}
describe('durable outreach state', () => {
  it('round-trips suppression and uncertain deliveries across process restarts', async () => {
    const s = await store();
    const state = emptyState();
    state.paused = 'Uncertain delivery';
    state.contacts['123'] = {
      id: '123',
      username: '@organizer',
      source: '@source',
      evidence: 'test',
      status: 'declined',
      sourceMessageId: 1,
      handledInboundId: 0,
      messages: [],
      pendingSend: 'test send',
    };
    await s.save(state);
    expect(await new Store(s.dir).load()).toEqual(state);
  });
  it('refuses corrupted state instead of resetting contact and daily limits', async () => {
    const s = await store();
    await writeFile(join(s.dir, 'state.json'), '{broken');
    await expect(s.load()).rejects.toThrow();
    expect(await readFile(join(s.dir, 'state.json'), 'utf8')).toBe('{broken');
  });
  it('prevents simultaneous workers/mutations and releases its lock', async () => {
    const s = await store();
    const unlock = await s.lock();
    await expect(new Store(s.dir).lock()).rejects.toThrow();
    await unlock();
    const unlockAgain = await s.lock();
    await unlockAgain();
  });
});
