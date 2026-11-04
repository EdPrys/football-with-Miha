import { canSend, isOptOut, kyivDay, transitionContact } from '@app/domain/outreach';
import { introduction, safeReply, type Model } from './model.js';
import type { Config, State, Contact, Message } from './state.js';

export type Transport = {
  posts: (
    source: string,
    limit: number,
  ) => Promise<
    { id: number; text: string; at: string; author?: { id: string; username: string } }[]
  >;
  inbox: (contact: Contact) => Promise<Message[]>;
  send: (contact: Contact, text: string) => Promise<number>;
};
export type Save = (state: State) => Promise<void>;
function usage(state: State, now: Date) {
  return (state.usage[kyivDay(now)] ??= { messages: 0, initial: 0, modelCalls: 0 });
}
async function reserveModel(state: State, config: Config, save: Save, now: Date) {
  const day = usage(state, now);
  if (day.modelCalls >= config.maxModelCallsPerDay) return false;
  day.modelCalls++;
  await save(state);
  return true;
}
export async function discover(
  state: State,
  config: Config,
  transport: Transport,
  model: Model,
  save: Save,
  now = new Date(),
) {
  if (state.paused) throw new Error('Agent paused; inspect state before resuming');
  if (!config.city || !config.sources.length)
    throw new Error('Set city and source groups before discovery');
  for (const source of config.sources) {
    for (const post of await transport.posts(source, config.sourceMessageLimit)) {
      const key = `${source}:${post.id}`;
      if (state.seen.includes(key)) continue;
      if (
        !post.author ||
        Date.parse(post.at) < now.getTime() - 7 * 86400_000 ||
        state.contacts[post.author.id]
      ) {
        state.seen.push(key);
        await save(state);
        continue;
      }
      if (!(await reserveModel(state, config, save, now))) return;
      const result = await model.qualify(post.text.slice(0, 4000), config);
      if (result.organizer && result.evidence.trim() && post.text.includes(result.evidence)) {
        state.contacts[post.author.id] = {
          id: post.author.id,
          username: post.author.username,
          source,
          evidence: result.evidence,
          status: 'candidate',
          messages: [],
          handledInboundId: 0,
          sourceMessageId: post.id,
        };
      }
      state.seen.push(key);
      await save(state);
    }
  }
}
export async function cycle(
  state: State,
  config: Config,
  transport: Transport,
  model: Model,
  save: Save,
  now = new Date(),
) {
  if (state.paused || Object.values(state.contacts).some((c) => c.pendingSend))
    throw new Error('Agent paused or send delivery uncertain; operator review required');
  for (const contact of Object.values(state.contacts)) {
    if (!['approved', 'contacted', 'interested'].includes(contact.status)) continue;
    const incoming = await transport.inbox(contact);
    // Cursor advances only over a fetched snapshot, never over our new send ID:
    // an organizer may reply while the model/send request is in flight.
    contact.inboxCursor = Math.max(contact.inboxCursor ?? 0, ...incoming.map((m) => m.id));
    let ownerReplied = false;
    for (const msg of incoming) {
      if (!contact.messages.some((m) => m.direction === msg.direction && m.id === msg.id)) {
        if (msg.direction === 'out') ownerReplied = true;
        contact.messages.push(msg);
      }
    }
    if (ownerReplied && contact.status !== 'approved') {
      contact.status = transitionContact(contact.status, 'handoff');
      contact.note = 'Owner replied outside the agent; automatic replies stopped';
    }
    // Never send an introduction into a conversation someone has already started.
    if (contact.status === 'approved' && incoming.length) {
      contact.status = transitionContact(contact.status, 'handoff');
      contact.note = 'Existing conversation: owner should review before contact';
    }
    const unhandled = contact.messages.filter(
      (m) => m.direction === 'in' && m.id > contact.handledInboundId,
    );
    if (unhandled.some((m) => isOptOut(m.text))) {
      contact.status = transitionContact(contact.status, 'declined');
      contact.note = 'Opt-out';
    }
    await save(state);
    const initial = contact.status === 'approved';
    const day = usage(state, now);
    if (
      !canSend({
        status: contact.status,
        initial,
        now,
        sentToday: day.messages,
        initialToday: day.initial,
        maxMessages: config.maxMessagesPerDay,
        maxInitial: config.maxNewContactsPerDay,
        lastSentAt: state.lastSentAt,
        minIntervalSeconds: config.minSendIntervalSeconds,
        hasUnansweredInbound: unhandled.length > 0,
      })
    )
      continue;
    let text = introduction(config);
    let interested = false;
    if (!initial) {
      if (!(await reserveModel(state, config, save, now))) return;
      const result = await model.respond(contact, config);
      if (result.action === 'decline' || result.action === 'handoff') {
        contact.status = transitionContact(
          contact.status,
          result.action === 'decline' ? 'declined' : 'handoff',
        );
        contact.note = result.reason;
        await save(state);
        continue;
      }
      text = result.text;
      interested = result.action === 'interested';
      if (!safeReply(text, config)) {
        contact.status = transitionContact(contact.status, 'handoff');
        contact.note = 'Reply failed output validation';
        await save(state);
        continue;
      }
    }
    if (config.mode === 'dry-run') {
      // No delivery markers, status changes or inbound acknowledgements in preview mode.
      console.log(JSON.stringify({ preview: true, contactId: contact.id, text }));
      continue;
    }
    // Reserve quota and intent BEFORE the network call. Crashes/errors never retry blindly.
    contact.pendingSend = text;
    day.messages++;
    if (initial) day.initial++;
    state.lastSentAt = now.toISOString();
    await save(state);
    try {
      const id = await transport.send(contact, text);
      contact.messages.push({ id, text, at: now.toISOString(), direction: 'out' });
      contact.pendingSend = undefined;
      if (initial) contact.status = transitionContact(contact.status, 'contacted');
      else if (interested) contact.status = transitionContact(contact.status, 'interested');
      contact.handledInboundId = Math.max(contact.handledInboundId, ...unhandled.map((m) => m.id));
      await save(state);
    } catch {
      state.paused =
        'Telegram send failed or acknowledgement uncertain; inspect actual chat before resolving pending send';
      await save(state);
      throw new Error(state.paused);
    }
  }
}
export function report(state: State) {
  const counts: Record<string, number> = {};
  for (const c of Object.values(state.contacts)) counts[c.status] = (counts[c.status] ?? 0) + 1;
  return {
    counts,
    contacted: Object.values(state.contacts).filter((c) =>
      c.messages.some((m) => m.direction === 'out'),
    ).length,
    replied: Object.values(state.contacts).filter((c) =>
      c.messages.some((m) => m.direction === 'in'),
    ).length,
    confirmedFirstGames: Object.values(state.contacts).filter(
      (c) => c.status === 'activated' && c.verifiedEventUrl,
    ).length,
    paused: state.paused ?? false,
    usage: state.usage,
  };
}
