import { join, resolve } from 'node:path';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transitionContact } from '@app/domain/outreach';
import { Store } from './state.js';
import { cycle, discover, report } from './engine.js';
import { introduction, model } from './model.js';
import { syncMetrics } from './metrics.js';

const dir = resolve(process.env.OUTREACH_DATA_DIR ?? '.outreach');
const store = new Store(dir);
async function main() {
  const [command, id, ...args] = process.argv.slice(2);
  if (command === 'init') {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await copyFile(
      fileURLToPath(new URL('../config.example.json', import.meta.url)),
      join(dir, 'config.json'),
      1,
    );
    console.log(`Created ${join(dir, 'config.json')}; mode=dry-run. Configure city and sources.`);
    return;
  }
  if (command === 'demo') {
    const { demo } = await import('./demo.js');
    await demo();
    return;
  }
  const unlock = await store.lock();
  try {
    const config = await store.config();
    const state = await store.load();
    if (command === 'check') {
      console.log(
        JSON.stringify(
          {
            mode: config.mode,
            city: config.city || 'MISSING',
            sources: config.sources,
            telegramApplication: !!process.env.TELEGRAM_API_ID && !!process.env.TELEGRAM_API_HASH,
            model: process.env.OPENAI_MODEL || 'MISSING',
            modelKey: !!process.env.OPENAI_API_KEY,
            telegramSession: await readFile(join(dir, 'telegram.session'), 'utf8')
              .then((s) => !!s.trim())
              .catch(() => false),
            paused: state.paused ?? false,
          },
          null,
          2,
        ),
      );
      return;
    }
    if (command === 'sync-metrics') {
      const connected = await syncMetrics(state, (s) => store.save(s));
      console.log(
        connected ? 'Aggregate metrics updated' : 'Metrics URL/token MISSING; no request made',
      );
      return;
    }
    if (command === 'report') {
      console.log(JSON.stringify(report(state), null, 2));
      return;
    }
    if (command === 'leads') {
      console.log(
        JSON.stringify(
          Object.values(state.contacts).map((c) => ({
            id: c.id,
            username: c.username,
            source: c.source,
            priority: c.priority ?? 1,
            campaign: c.campaign,
            evidence: c.evidence,
            status: c.status,
            note: c.note,
            pendingSend: !!c.pendingSend,
          })),
          null,
          2,
        ),
      );
      return;
    }
    if (['approve', 'decline', 'activate', 'resolve-send'].includes(command ?? '')) {
      const contact = id ? state.contacts[id] : undefined;
      if (!contact) throw new Error('Unknown contact ID');
      if (command === 'resolve-send') {
        if (!contact.pendingSend) throw new Error('No uncertain send for this contact');
        // Do not guess delivery and do not automatically retry; hand the conversation to owner.
        contact.pendingSend = undefined;
        contact.status = transitionContact(contact.status, 'handoff');
        contact.note = args.join(' ') || 'Owner must verify actual chat before continuing';
      } else {
        if (command === 'activate') {
          const url = new URL(args[0] ?? '');
          if (
            url.origin !== new URL(config.siteUrl).origin ||
            !/^\/events\/[^/]+$/.test(url.pathname)
          )
            throw new Error('Provide verified Kopanka event URL');
          contact.verifiedEventUrl = url.href;
        }
        contact.status = transitionContact(
          contact.status,
          command === 'approve' ? 'approved' : command === 'activate' ? 'activated' : 'declined',
        );
      }
      await store.save(state);
      console.log('Contact updated.');
      return;
    }
    if (command === 'pause') {
      state.paused = 'Paused by owner';
      await store.save(state);
      return;
    }
    if (command === 'resume') {
      if (Object.values(state.contacts).some((c) => c.pendingSend))
        throw new Error('Resolve uncertain sends first');
      state.paused = undefined;
      await store.save(state);
      console.log('Resumed; config still controls dry-run/live.');
      return;
    }
    if (command === 'preview') {
      console.log(introduction(config, id ? state.contacts[id] : undefined));
      return;
    }
    if (command === 'connect') {
      const { login } = await import('./telegram.js');
      await login(dir);
      return;
    }
    if (!['discover', 'run'].includes(command ?? ''))
      throw new Error(
        'Commands: init, demo, check, discover, leads, preview, approve ID, decline ID, run [--once], pause, resume, report, activate ID EVENT_URL, resolve-send ID NOTE, connect, sync-metrics',
      );
    if (!config.city || !config.sources.length)
      throw new Error('Configure pilot city and source groups first');
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL)
      throw new Error('Configure model and API key first');
    const { telegram } = await import('./telegram.js');
    const connection = await telegram(dir);
    try {
      if (command === 'discover') {
        await discover(state, config, connection.transport, model, (s) => store.save(s));
        return;
      }
      let lastDiscovery = 0;
      for (;;) {
        await cycle(state, config, connection.transport, model, (s) => store.save(s));
        if (Date.now() - lastDiscovery > 3600_000) {
          try {
            await syncMetrics(state, (s) => store.save(s));
          } catch {
            console.error(
              'Metrics unavailable; previous observations stay marked with their timestamp',
            );
          }
          await discover(state, config, connection.transport, model, (s) => store.save(s));
          lastDiscovery = Date.now();
        }
        console.log(JSON.stringify(report(state)));
        if (id === '--once') break;
        await new Promise((r) => setTimeout(r, config.pollSeconds * 1000));
      }
    } catch {
      state.paused ??=
        'Worker failed; inspect configuration, limits and pending sends before resuming';
      await store.save(state);
      throw new Error(state.paused);
    } finally {
      await connection.close();
    }
  } finally {
    await unlock();
  }
}
process.once('SIGTERM', () => process.exit(0));
process.once('SIGINT', () => process.exit(0));
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Agent failed');
  process.exitCode = 1;
});
