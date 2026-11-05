import { TelegramClient, Api } from 'teleproto';
import { StringSession } from 'teleproto/sessions';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import type { Transport } from './engine.js';
import type { Contact, Message } from './state.js';

function credentials() {
  const id = Number(process.env.TELEGRAM_API_ID),
    hash = process.env.TELEGRAM_API_HASH;
  if (!Number.isSafeInteger(id) || id <= 0 || !hash)
    throw new Error('Set TELEGRAM_API_ID and TELEGRAM_API_HASH');
  return { id, hash };
}
export async function login(dir: string) {
  if (!process.stdin.isTTY) throw new Error('Connect interactively in a private terminal');
  const { id, hash } = credentials();
  const session = new StringSession('');
  const client = new TelegramClient(session, id, hash, { connectionRetries: 1 });
  client.setLogLevel('none' as Parameters<typeof client.setLogLevel>[0]);
  async function ask(label: string, secret = false) {
    process.stdout.write(label);
    const out = secret
      ? new Writable({
          write(_chunk, _encoding, done) {
            done();
          },
        })
      : process.stdout;
    const rl = createInterface({ input: process.stdin, output: out, terminal: true });
    try {
      return await rl.question('');
    } finally {
      rl.close();
      if (secret) process.stdout.write('\n');
    }
  }
  try {
    await client.start({
      phoneNumber: () => ask('Telegram phone number: '),
      phoneCode: () => ask('Telegram login code: ', true),
      password: () => ask('Telegram 2FA password: ', true),
      onError: () => {
        throw new Error('Telegram login failed; credentials omitted');
      },
    });
    await writeFile(join(dir, 'telegram.session'), session.save(), { mode: 0o600 });
    console.log('Telegram session saved privately. Sending is still controlled by config mode.');
  } finally {
    await client.disconnect();
  }
}
export async function telegram(
  dir: string,
): Promise<{ transport: Transport; close: () => Promise<void> }> {
  const { id, hash } = credentials();
  const session = await readFile(join(dir, 'telegram.session'), 'utf8');
  const client = new TelegramClient(new StringSession(session.trim()), id, hash, {
    connectionRetries: 1,
    requestRetries: 0,
    floodSleepThreshold: 0,
  });
  client.setLogLevel('none' as Parameters<typeof client.setLogLevel>[0]);
  await client.connect();
  if (!(await client.checkAuthorization())) {
    await client.disconnect();
    throw new Error('Telegram session expired: reconnect locally');
  }
  const resolve = async (contact: Contact) => {
    const user = await client.getEntity(contact.username);
    if (
      !(user instanceof Api.User) ||
      user.id.toString() !== contact.id ||
      user.bot ||
      user.self ||
      user.deleted
    )
      throw new Error('Contact identity changed or unavailable; operator review required');
    return user;
  };
  return {
    close: () => client.disconnect(),
    transport: {
      posts: async (source, limit) => {
        const result: Awaited<ReturnType<Transport['posts']>> = [];
        for (const msg of await client.getMessages(source, { limit })) {
          if (!msg.message || msg.fwdFrom) continue;
          const sender = await msg.getSender();
          if (
            !(sender instanceof Api.User) ||
            !sender.username ||
            sender.bot ||
            sender.self ||
            sender.deleted
          )
            continue;
          result.push({
            id: msg.id,
            text: msg.message,
            at: new Date(msg.date * 1000).toISOString(),
            author: { id: sender.id.toString(), username: '@' + sender.username },
          });
        }
        return result;
      },
      inbox: async (contact) => {
        const user = await resolve(contact);
        const minId = contact.inboxCursor ?? 0;
        const rows = await client.getMessages(
          user,
          contact.status === 'approved' ? { limit: 1 } : { minId, reverse: true, limit: 100 },
        );
        if (rows.length >= 100)
          throw new Error('Conversation backlog exceeds one safe batch: inspect before resuming');
        return rows
          .filter((m) => !!m.message)
          .map((m): Message => ({
            id: m.id,
            text: m.message,
            at: new Date(m.date * 1000).toISOString(),
            direction: m.out ? 'out' : 'in',
          }));
      },
      send: async (contact, text) => {
        const user = await resolve(contact);
        return (
          await client.sendMessage(user, { message: text, parseMode: false, linkPreview: false })
        ).id;
      },
    },
  };
}
