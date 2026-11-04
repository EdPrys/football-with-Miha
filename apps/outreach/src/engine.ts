import { canSend, isOptOut, kyivDay, transitionContact } from '@app/domain/outreach';
import {
  ensurePilot,
  activeCount,
  mayStartContact,
  reserveContact,
  settleIdle,
  reopenWaiting,
  finishPilotIfReady,
  pilotReport,
} from './pilot.js';
import { randomBytes } from 'node:crypto';
import { footballPost, leadPriority, replyKey, shortReply, templateReply } from './playbook.js';
import { introduction, safeReply, type Model, type UsageSink } from './model.js';
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
  if (
    day.modelCalls >= config.maxModelCallsPerDay ||
    (day.inputTokens ?? 0) + (day.outputTokens ?? 0) >= config.maxTokensPerDay
  )
    return false;
  day.unreportedUsageCalls ??=
    day.inputTokens === undefined || day.outputTokens === undefined ? day.modelCalls : 0;
  day.modelCalls++;
  day.unreportedUsageCalls = (day.unreportedUsageCalls ?? 0) + 1;
  await save(state);
  return true;
}
function usageSink(state: State, save: Save, now: Date): UsageSink {
  return async (tokens) => {
    const day = usage(state, now);
    day.inputTokens = (day.inputTokens ?? 0) + tokens.inputTokens;
    day.outputTokens = (day.outputTokens ?? 0) + tokens.outputTokens;
    day.unreportedUsageCalls = Math.max(0, (day.unreportedUsageCalls ?? 0) - 1);
    await save(state);
  };
}
function ensureCampaign(contact: Contact, config: Config) {
  contact.campaign ??= `${config.campaign}__${randomBytes(8).toString('hex')}`;
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
  ensurePilot(state, config, now);
  await save(state);
  if (
    state.pilot &&
    (state.pilot.status !== 'running' ||
      activeCount(state) >= state.pilot.concurrency ||
      state.pilot.contactIds.length +
        Object.values(state.contacts).filter(
          (c) => c.status === 'candidate' || c.status === 'approved',
        ).length >=
        state.pilot.limit)
  )
    return;
  if (!config.city || !config.sources.length)
    throw new Error('Set city and source groups before discovery');
  for (const source of config.sources) {
    for (const post of await transport.posts(source, config.sourceMessageLimit)) {
      const key = `${source}:${post.id}`;
      if (state.seen.includes(key)) continue;
      if (
        !footballPost(post.text) ||
        !post.author ||
        Date.parse(post.at) < now.getTime() - 7 * 86400_000 ||
        state.contacts[post.author.id]
      ) {
        state.seen.push(key);
        await save(state);
        continue;
      }
      if (!(await reserveModel(state, config, save, now))) return;
      const result = await model.qualify(
        post.text.slice(0, 2000),
        config,
        usageSink(state, save, now),
      );
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
          priority: leadPriority(post.text),
          campaign: `${config.campaign}__${randomBytes(8).toString('hex')}`,
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
  const startedClock = Date.now();
  if (state.paused || Object.values(state.contacts).some((c) => c.pendingSend))
    throw new Error('Agent paused or send delivery uncertain; operator review required');
  const pilot = ensurePilot(state, config, now);
  await save(state);
  if (pilot.status === 'awaiting_review') return;
  if (activeCount(state) > pilot.concurrency) {
    state.paused =
      'Existing active conversations exceed the configured limit; owner review required';
    await save(state);
    throw new Error(state.paused);
  }
  for (const contact of Object.values(state.contacts).sort(
    (a, b) =>
      Number(a.status === 'approved') - Number(b.status === 'approved') ||
      (b.priority ?? 1) - (a.priority ?? 1),
  )) {
    if (!['approved', 'contacted', 'interested', 'waiting'].includes(contact.status)) continue;
    if (contact.status === 'waiting' && !pilot.contactIds.includes(contact.id)) continue;
    if (contact.status === 'approved' && !mayStartContact(state)) continue;
    ensureCampaign(contact, config);
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
      contact.result = 'owner_help';
      contact.note = 'Owner replied outside the agent; automatic replies stopped';
    }
    // Never send an introduction into a conversation someone has already started.
    if (contact.status === 'approved' && incoming.length) {
      contact.status = transitionContact(contact.status, 'handoff');
      contact.result = 'owner_help';
      contact.note = 'Existing conversation: owner should review before contact';
    }
    const unhandled = contact.messages.filter(
      (m) => m.direction === 'in' && m.id > contact.handledInboundId,
    );
    if (unhandled.some((m) => isOptOut(m.text))) {
      contact.status = transitionContact(contact.status, 'declined');
      contact.note = 'Opt-out';
      contact.result = 'declined';
    }
    settleIdle(state, contact, now);
    if (contact.status === 'waiting' && unhandled.length && !reopenWaiting(state, contact)) {
      await save(state);
      continue;
    }
    await save(state);
    const initial = contact.status === 'approved';
    if (initial && !mayStartContact(state)) continue;
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
    const key = replyKey(contact, config);
    let plan = contact.prepared?.key === key ? contact.prepared : undefined;
    if (!plan) {
      let decision;
      let kind: 'template' | 'model' = 'template';
      if (initial)
        decision = {
          action: 'reply' as const,
          text: introduction(config, contact),
          reason: 'First contact',
        };
      else {
        decision = templateReply(contact, config);
        if (!decision) {
          if ((contact.modelReplies ?? 0) >= config.maxModelRepliesPerContact) {
            contact.status = transitionContact(contact.status, 'handoff');
            contact.result = 'owner_help';
            contact.note = 'Model reply limit reached; owner can help with this specific question';
            await save(state);
            continue;
          }
          if (!(await reserveModel(state, config, save, now))) continue;
          contact.modelReplies = (contact.modelReplies ?? 0) + 1;
          await save(state);
          decision = await model.respond(contact, config, usageSink(state, save, now));
          kind = 'model';
        }
      }
      plan = { key, ...decision, kind };
      contact.prepared = plan;
      await save(state);
    }
    if (plan.action === 'decline' || plan.action === 'handoff') {
      contact.status = transitionContact(
        contact.status,
        plan.action === 'decline' ? 'declined' : 'handoff',
      );
      contact.note = plan.reason;
      contact.result =
        plan.action === 'decline'
          ? 'declined'
          : plan.reason.startsWith('Conversation complete')
            ? 'conversation_closed'
            : 'owner_help';
      await save(state);
      continue;
    }
    const text = plan.text;
    if (!safeReply(text, config) || !shortReply(text)) {
      contact.status = transitionContact(contact.status, 'handoff');
      contact.result = 'owner_help';
      contact.note = 'Reply failed short-copy validation';
      await save(state);
      continue;
    }
    if (
      !initial &&
      contact.messages
        .filter((m) => m.direction === 'out')
        .slice(-2)
        .some((m) => m.text === text)
    ) {
      contact.handledInboundId = Math.max(contact.handledInboundId, ...unhandled.map((m) => m.id));
      contact.note = 'Identical call to action already sent; no repeated sales message';
      await save(state);
      continue;
    }
    if (config.mode === 'dry-run') {
      if (contact.previewedKey !== key) {
        console.log(
          JSON.stringify({ preview: true, contactId: contact.id, kind: plan.kind, text }),
        );
        contact.previewedKey = key;
        await save(state);
      }
      continue;
    }
    const sendAt = new Date(now.getTime() + Math.max(0, Date.now() - startedClock));
    if (
      !canSend({
        status: contact.status,
        initial,
        now: sendAt,
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
    // Reserve quota and intent BEFORE the network call. Crashes/errors never retry blindly.
    if (initial) reserveContact(state, contact);
    contact.pendingSend = text;
    day.messages++;
    if (initial) day.initial++;
    state.lastSentAt = sendAt.toISOString();
    await save(state);
    try {
      const id = await transport.send(contact, text);
      contact.messages.push({ id, text, at: sendAt.toISOString(), direction: 'out' });
      contact.pendingSend = undefined;
      if (initial) contact.status = transitionContact(contact.status, 'contacted');
      else if (plan.action === 'interested')
        contact.status = transitionContact(contact.status, 'interested');
      contact.handledInboundId = Math.max(contact.handledInboundId, ...unhandled.map((m) => m.id));
      await save(state);
    } catch {
      state.paused =
        'Telegram send failed or acknowledgement uncertain; inspect actual chat before resolving pending send';
      await save(state);
      throw new Error(state.paused);
    }
  }
  if (finishPilotIfReady(state, now)) await save(state);
}
export function report(state: State) {
  const inputRate = Number(process.env.OUTREACH_INPUT_USD_PER_MILLION || NaN);
  const outputRate = Number(process.env.OUTREACH_OUTPUT_USD_PER_MILLION || NaN);
  const knownRates =
    Number.isFinite(inputRate) && inputRate >= 0 && Number.isFinite(outputRate) && outputRate >= 0;
  const usageRows = Object.values(state.usage);
  const unknownCalls = usageRows.reduce(
    (n, u) =>
      n +
      (u.unreportedUsageCalls ??
        (u.inputTokens === undefined || u.outputTokens === undefined ? u.modelCalls : 0)),
    0,
  );
  const estimate =
    knownRates && !unknownCalls
      ? usageRows.reduce(
          (n, u) =>
            n + ((u.inputTokens ?? 0) * inputRate + (u.outputTokens ?? 0) * outputRate) / 1_000_000,
          0,
        )
      : null;
  const counts: Record<string, number> = {};
  for (const c of Object.values(state.contacts)) counts[c.status] = (counts[c.status] ?? 0) + 1;
  return {
    pilot: pilotReport(state),
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
    acquisition: Object.values(state.contacts)
      .filter((c) => c.metrics)
      .map((c) => ({
        contactId: c.id,
        campaign: c.campaign,
        ...c.metrics,
      })),
    missingMetrics: Object.values(state.contacts).filter((c) => !c.metrics).length,
    unreportedUsageCallsTotal: unknownCalls,
    estimatedCostUsd: estimate,
    estimatedCostPerNewPlayerUsd:
      estimate !== null &&
      Object.values(state.contacts).reduce((n, c) => n + (c.metrics?.newPlayersJoined ?? 0), 0) > 0
        ? estimate /
          Object.values(state.contacts).reduce((n, c) => n + (c.metrics?.newPlayersJoined ?? 0), 0)
        : null,
    costNote:
      'Estimate from configured rates, without cache discounts; null if rates/usage are missing. Invoice and acquisition causality are not inferred',
  };
}
