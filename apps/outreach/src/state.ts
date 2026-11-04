import { z } from 'zod';
import { mkdir, readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';

export const Config = z
  .object({
    mode: z.enum(['dry-run', 'live']),
    city: z.string().trim().max(100),
    sources: z.array(z.string().regex(/^@[a-zA-Z][a-zA-Z0-9_]{4,31}$/)).max(20),
    siteUrl: z
      .string()
      .url()
      .refine((v) => new URL(v).protocol === 'https:'),
    campaign: z.string().regex(/^[a-z0-9_]+$/),
    maxNewContactsPerDay: z.number().int().min(0).max(10),
    maxMessagesPerDay: z.number().int().min(1).max(50),
    minSendIntervalSeconds: z.number().int().min(60),
    maxModelCallsPerDay: z.number().int().min(1).max(200),
    pollSeconds: z.number().int().min(30),
    sourceMessageLimit: z.number().int().min(1).max(100),
  })
  .strict();
export type Config = z.infer<typeof Config>;
export const Message = z.object({
  id: z.number().int(),
  text: z.string(),
  at: z.string(),
  direction: z.enum(['in', 'out']),
});
export type Message = z.infer<typeof Message>;
const Contact = z.object({
  id: z.string(),
  username: z.string(),
  source: z.string(),
  evidence: z.string(),
  status: z.enum([
    'candidate',
    'approved',
    'contacted',
    'interested',
    'handoff',
    'declined',
    'activated',
  ]),
  messages: z.array(Message),
  inboxCursor: z.number().int().optional(),
  handledInboundId: z.number().default(0),
  sourceMessageId: z.number(),
  pendingSend: z.string().optional(),
  note: z.string().optional(),
  verifiedEventUrl: z.string().optional(),
});
export type Contact = z.infer<typeof Contact>;
export const State = z.object({
  version: z.literal(1),
  contacts: z.record(Contact),
  seen: z.array(z.string()),
  paused: z.string().optional(),
  usage: z.record(z.object({ messages: z.number(), initial: z.number(), modelCalls: z.number() })),
  lastSentAt: z.string().optional(),
});
export type State = z.infer<typeof State>;
export const emptyState = (): State => ({ version: 1, contacts: {}, seen: [], usage: {} });
export class Store {
  constructor(readonly dir: string) {}
  async config() {
    return Config.parse(JSON.parse(await readFile(join(this.dir, 'config.json'), 'utf8')));
  }
  async load(): Promise<State> {
    try {
      return State.parse(JSON.parse(await readFile(join(this.dir, 'state.json'), 'utf8')));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return emptyState();
      throw e;
    }
  }
  async save(state: State) {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    const path = join(this.dir, 'state.json');
    await writeFile(path + '.tmp', JSON.stringify(State.parse(state), null, 2), { mode: 0o600 });
    await rename(path + '.tmp', path);
  }
  async lock() {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    const path = join(this.dir, 'worker.lock');
    const handle = await open(path, 'wx', 0o600);
    await handle.writeFile(String(process.pid));
    const cleanup = () => {
      try {
        unlinkSync(path);
      } catch {
        /* already released */
      }
    };
    process.once('exit', cleanup);
    return async () => {
      process.off('exit', cleanup);
      await handle.close();
      await unlink(path);
    };
  }
}
