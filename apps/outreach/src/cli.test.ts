import { afterEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store, Config, emptyState } from './state.js';
import { ensurePilot, finishPilotIfReady } from './pilot.js';
const exec = promisify(execFile),
  dirs: string[] = [];
const appDir = fileURLToPath(new URL('../', import.meta.url));
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'kopanka-pilot-cli-'));
  dirs.push(dir);
  const config = Config.parse(
    JSON.parse(await readFile(join(appDir, 'config.example.json'), 'utf8')),
  );
  await writeFile(join(dir, 'config.json'), JSON.stringify(config));
  const state = emptyState();
  state.contacts.one = {
    id: 'one',
    username: '@test_organizer',
    source: '@football_kyiv',
    evidence: 'test',
    sourceMessageId: 1,
    status: 'declined',
    handledInboundId: 0,
    messages: [{ id: 1, text: 'test', direction: 'out', at: '2030-01-01T09:00:00Z' }],
  };
  ensurePilot(state, { ...config, maxPilotContacts: 1 }, new Date('2030-01-01T09:00:00Z'));
  finishPilotIfReady(state, new Date('2030-01-01T10:00:00Z'));
  const store = new Store(dir);
  await store.save(state);
  const cli = (...args: string[]) =>
    exec(process.execPath, ['--import', 'tsx', 'src/cli.ts', ...args], {
      cwd: appDir,
      env: {
        ...process.env,
        OUTREACH_DATA_DIR: dir,
        OPENAI_API_KEY: '',
        OPENAI_MODEL: '',
        TELEGRAM_API_ID: '',
        TELEGRAM_API_HASH: '',
      },
      timeout: 20000,
    });
  return { dir, store, state, cli };
}
describe('pilot operator commands', () => {
  it('persists private human-readable and machine-readable snapshots and does not overwrite them', async () => {
    const { dir, store, state, cli } = await fixture();
    const json = await readFile(join(dir, 'reports/pilot-0001.json'), 'utf8');
    expect(JSON.parse(json).reservedContacts).toBe(1);
    expect(await readFile(join(dir, 'reports/pilot-0001.md'), 'utf8')).toContain('Відмова');
    state.contacts.one!.note = 'Later note';
    await store.save(state);
    expect(await readFile(join(dir, 'reports/pilot-0001.json'), 'utf8')).toBe(json);
    expect((await cli('pilot-report')).stdout).toContain('Пілот №1');
  });
  it('survives restarts without credentials and requires both review and explicit start', async () => {
    const { store, cli } = await fixture();
    expect((await cli('run')).stdout).toContain('awaiting_review');
    await expect(cli('start-next-pilot')).rejects.toThrow();
    await cli('pause');
    await cli('resume');
    expect((await store.load()).pilot?.status).toBe('awaiting_review');
    await cli('review-pilot', 'Разом розглянули результати; уточнити користь для гравців');
    expect((await store.load()).pilot?.status).toBe('awaiting_review');
    expect((await cli('run')).stdout).toContain('awaiting_review');
    await cli('start-next-pilot');
    const state = await store.load();
    expect(state.pilot?.id).toBe(2);
    expect(state.contacts.one?.status).toBe('declined');
    expect(state.pilotHistory?.[0]?.reviewNotes).toContain('гравців');
  }, 30000);
});
