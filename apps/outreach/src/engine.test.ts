import { afterEach, describe, expect, it, vi } from 'vitest';
import { canSend, isContactWindow, isOptOut, transitionContact } from '@app/domain/outreach';
import { cycle, discover, report, type Transport } from './engine.js';
import { Config, emptyState, type Contact } from './state.js';
import {
  introduction,
  safeReply,
  structured,
  Decision,
  decisionSchema,
  type Model,
} from './model.js';

const now = new Date('2030-06-01T09:00:00Z');
const config = Config.parse({
  mode: 'live',
  city: 'Київ',
  sources: ['@football_kyiv'],
  siteUrl: 'https://kopanka.pro',
  campaign: 'pilot_kyiv',
  maxNewContactsPerDay: 3,
  maxMessagesPerDay: 15,
  minSendIntervalSeconds: 300,
  maxModelCallsPerDay: 30,
  pollSeconds: 60,
  sourceMessageLimit: 30,
});
const contact = (status: Contact['status'] = 'approved'): Contact => ({
  id: '123',
  username: '@organizer',
  source: '@football_kyiv',
  sourceMessageId: 1,
  evidence: 'Організовую футбол у Києві',
  status,
  messages: [],
  handledInboundId: 0,
});
function setup(status: Contact['status'] = 'approved') {
  const state = emptyState();
  state.contacts['123'] = contact(status);
  const transport: Transport = {
    posts: vi.fn(async () => []),
    inbox: vi.fn(async () => []),
    send: vi.fn(async () => 10),
  };
  const model: Model = {
    qualify: vi.fn(async (text) => ({ organizer: true, evidence: text })),
    respond: vi.fn(async () => ({
      action: 'reply' as const,
      text: 'Допоможу створити гру.',
      reason: 'Question',
    })),
  };
  const save = vi.fn(async () => {});
  return { state, transport, model, save };
}
afterEach(() => vi.unstubAllGlobals());
describe('outreach delivery policy', () => {
  it('sends once after explicit lead approval, never follows up without an answer', async () => {
    const s = setup();
    await cycle(s.state, config, s.transport, s.model, s.save, now);
    await cycle(s.state, config, s.transport, s.model, s.save, new Date(now.getTime() + 600_000));
    expect(s.transport.send).toHaveBeenCalledTimes(1);
    expect(s.state.contacts['123']?.status).toBe('contacted');
    expect(s.model.respond).not.toHaveBeenCalled();
  });
  it('does not contact candidates, handoffs, opted-out or activated contacts', async () => {
    for (const status of ['candidate', 'handoff', 'declined', 'activated'] as const) {
      const s = setup(status);
      await cycle(s.state, config, s.transport, s.model, s.save, now);
      expect(s.transport.send).not.toHaveBeenCalled();
    }
    expect(() => transitionContact('declined', 'approved')).toThrow();
  });
  it('detects an opt-out before any model call, including outside sending hours', async () => {
    const s = setup('contacted');
    s.transport.inbox = async () => [
      { id: 11, text: 'Не пишіть мені більше', direction: 'in', at: now.toISOString() },
    ];
    await cycle(s.state, config, s.transport, s.model, s.save, new Date('2030-06-01T23:00:00Z'));
    expect(s.state.contacts['123']?.status).toBe('declined');
    expect(s.model.respond).not.toHaveBeenCalled();
    expect(s.transport.send).not.toHaveBeenCalled();
  });
  it('hands an existing conversation to the owner instead of sending a cold introduction', async () => {
    const s = setup();
    s.transport.inbox = async () => [
      { id: 2, text: 'Привіт', direction: 'out', at: now.toISOString() },
    ];
    await cycle(s.state, config, s.transport, s.model, s.save, now);
    expect(s.state.contacts['123']?.status).toBe('handoff');
    expect(s.transport.send).not.toHaveBeenCalled();
  });
  it('stops automatic replies when the owner responds manually', async () => {
    const s = setup('contacted');
    s.transport.inbox = async () => [
      { id: 11, text: 'Як створити гру?', direction: 'in', at: now.toISOString() },
      { id: 12, text: 'Я особисто допоможу', direction: 'out', at: now.toISOString() },
    ];
    await cycle(s.state, config, s.transport, s.model, s.save, now);
    expect(s.state.contacts['123']?.status).toBe('handoff');
    expect(s.model.respond).not.toHaveBeenCalled();
    expect(s.transport.send).not.toHaveBeenCalled();
  });
  it('preview never sends, consumes send quota or acknowledges an incoming message', async () => {
    const s = setup('contacted');
    s.transport.inbox = async () => [
      { id: 11, text: 'Як створити гру?', direction: 'in', at: now.toISOString() },
    ];
    vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await cycle(s.state, { ...config, mode: 'dry-run' }, s.transport, s.model, s.save, now);
      expect(s.transport.send).not.toHaveBeenCalled();
      expect(s.state.contacts['123']?.handledInboundId).toBe(0);
      expect(s.state.usage['2030-06-01']?.messages).toBe(0);
    } finally {
      vi.restoreAllMocks();
    }
  });
  it('retains a read cursor below the send ID to avoid skipping replies that race a send', async () => {
    const s = setup();
    await cycle(s.state, config, s.transport, s.model, s.save, now);
    expect(s.state.contacts['123']?.messages[0]?.id).toBe(10);
    expect(s.state.contacts['123']?.inboxCursor).toBe(0);
    s.transport.inbox = async () => [
      { id: 9, text: 'Так, цікаво', direction: 'in', at: now.toISOString() },
    ];
    await cycle(s.state, config, s.transport, s.model, s.save, new Date(now.getTime() + 600_000));
    expect(s.model.respond).toHaveBeenCalledTimes(1);
    expect(s.state.contacts['123']?.inboxCursor).toBe(9);
  });
  it('blocks restart/retry after an uncertain send and reserves quota first', async () => {
    const s = setup();
    s.transport.send = async () => {
      expect(s.state.contacts['123']?.pendingSend).toBeTruthy();
      throw new Error('timeout');
    };
    await expect(cycle(s.state, config, s.transport, s.model, s.save, now)).rejects.toThrow(
      'uncertain',
    );
    expect(s.state.contacts['123']?.pendingSend).toBeTruthy();
    expect(s.state.usage['2030-06-01']?.messages).toBe(1);
    await expect(cycle(s.state, config, s.transport, s.model, s.save, now)).rejects.toThrow(
      'paused',
    );
  });
  it('never sends more than the daily or interval budget', async () => {
    const input = {
      status: 'approved' as const,
      initial: true,
      now,
      sentToday: 0,
      initialToday: 0,
      maxMessages: 15,
      maxInitial: 3,
      minIntervalSeconds: 300,
      hasUnansweredInbound: false,
    };
    expect(canSend(input)).toBe(true);
    expect(canSend({ ...input, initialToday: 3 })).toBe(false);
    expect(canSend({ ...input, sentToday: 15 })).toBe(false);
    expect(canSend({ ...input, lastSentAt: now.toISOString() })).toBe(false);
    expect(isContactWindow(new Date('2030-01-01T06:00:00Z'))).toBe(false);
    expect(isContactWindow(new Date('2030-06-01T06:00:00Z'))).toBe(true);
  });
  it('processes an incoming answer once and never trusts external links', async () => {
    const s = setup('contacted');
    s.transport.inbox = async () => [
      { id: 11, text: 'Так, цікаво', direction: 'in', at: now.toISOString() },
    ];
    s.model.respond = async () => ({
      action: 'interested',
      text: 'Створіть гру: https://kopanka.pro/events/new',
      reason: 'Interested',
    });
    await cycle(s.state, config, s.transport, s.model, s.save, now);
    await cycle(s.state, config, s.transport, s.model, s.save, new Date(now.getTime() + 600_000));
    expect(s.transport.send).toHaveBeenCalledTimes(1);
    expect(s.state.contacts['123']?.status).toBe('interested');
    expect(report(s.state).confirmedFirstGames).toBe(0);
    expect(safeReply('https://kopanka.pro.evil.org', config)).toBe(false);
    expect(safeReply('https://example.net', config)).toBe(false);
    expect(safeReply('Пишіть @someone', config)).toBe(false);
    expect(introduction(config)).toContain('автоматизований');
  });
});
describe('candidate qualification', () => {
  it('deduplicates authors across source posts and requires verbatim evidence', async () => {
    const s = setup();
    s.state.contacts = {};
    s.transport.posts = async () =>
      [1, 2].map((id) => ({
        id,
        text: 'Організовую футбол у Києві',
        at: now.toISOString(),
        author: { id: '123', username: '@organizer' },
      }));
    await discover(s.state, config, s.transport, s.model, s.save, now);
    await discover(s.state, config, s.transport, s.model, s.save, now);
    expect(Object.keys(s.state.contacts)).toEqual(['123']);
    expect(s.model.qualify).toHaveBeenCalledTimes(1);
    const other = setup();
    other.state.contacts = {};
    other.transport.posts = s.transport.posts;
    other.model.qualify = async () => ({ organizer: true, evidence: 'Invented evidence' });
    await discover(other.state, config, other.transport, other.model, other.save, now);
    expect(Object.keys(other.state.contacts)).toHaveLength(0);
  });
  it('reserves model budget durably and never exceeds it', async () => {
    const s = setup();
    s.state.contacts = {};
    s.transport.posts = async () =>
      [1, 2].map((id) => ({
        id,
        text: 'Футбол Київ',
        at: now.toISOString(),
        author: { id: String(id), username: '@organizer' },
      }));
    await discover(
      s.state,
      { ...config, maxModelCallsPerDay: 1 },
      s.transport,
      s.model,
      s.save,
      now,
    );
    expect(s.model.qualify).toHaveBeenCalledTimes(1);
    expect(s.save).toHaveBeenCalled();
  });
});
describe('structured model response', () => {
  it('rejects malformed, refused and incomplete output without sending', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test');
    vi.stubEnv('OPENAI_MODEL', 'test');
    try {
      for (const body of [
        { status: 'incomplete' },
        { status: 'completed', output: [] },
        {
          status: 'completed',
          output: [
            {
              type: 'message',
              content: [{ type: 'output_text', text: '{"action":"execute_shell"}' }],
            },
          ],
        },
      ]) {
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => ({ ok: true, json: async () => body })),
        );
        await expect(structured(Decision, decisionSchema, 'test', {})).rejects.toThrow();
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('recognizes stop expressions', () => {
    for (const text of ['STOP', 'не цікаво', 'не пишите', 'відписатися'])
      expect(isOptOut(text)).toBe(true);
    expect(isOptOut('Так, цікаво. Як створити гру?')).toBe(false);
  });
});
