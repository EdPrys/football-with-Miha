import { afterEach, describe, expect, it, vi } from 'vitest';
import { Config, emptyState, State, type Contact } from './state.js';
import { cycle, discover, type Transport } from './engine.js';
import {
  ensurePilot,
  activeCount,
  finishPilotIfReady,
  pilotReport,
  renderPilotReport,
  reviewPilot,
  startNextPilot,
} from './pilot.js';
import type { Model } from './model.js';
const now = new Date('2030-06-01T09:00:00Z');
const config = Config.parse({
  mode: 'live',
  city: 'Київ',
  sources: ['@football_kyiv'],
  siteUrl: 'https://kopanka.pro',
  campaign: 'organizers_pilot',
  maxNewContactsPerDay: 10,
  maxMessagesPerDay: 50,
  minSendIntervalSeconds: 60,
  maxModelCallsPerDay: 30,
  pollSeconds: 60,
  sourceMessageLimit: 30,
});
const make = (id: string, status: Contact['status'] = 'approved'): Contact => ({
  id,
  username: '@organizer_' + id,
  source: '@football_kyiv',
  sourceMessageId: 1,
  evidence: 'Організовую футбол',
  status,
  handledInboundId: 0,
  messages:
    status === 'approved'
      ? []
      : [{ id: 1, text: 'intro', at: now.toISOString(), direction: 'out' }],
});
function setup(n = 10) {
  const state = emptyState();
  for (let i = 0; i < n; i++) state.contacts['c' + i] = make('c' + i);
  let id = 10;
  const transport: Transport = {
    posts: vi.fn(async () => []),
    inbox: vi.fn(async () => []),
    send: vi.fn(async () => ++id),
  };
  const model: Model = {
    qualify: vi.fn(async (text) => ({ organizer: true, evidence: text })),
    respond: vi.fn(async () => ({
      action: 'reply' as const,
      text: 'Допоможу з грою.',
      reason: 'test',
    })),
  };
  return { state, transport, model, save: vi.fn(async () => {}) };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe('bounded pilot cycles', () => {
  it('starts only seven conversations, then reuses idle slots up to ten and waits for review', async () => {
    const s = setup(11);
    for (let i = 0; i < 9; i++)
      await cycle(s.state, config, s.transport, s.model, s.save, new Date(+now + i * 120000));
    expect(s.transport.send).toHaveBeenCalledTimes(7);
    expect(activeCount(s.state)).toBe(7);
    expect(s.state.pilot?.contactIds).toHaveLength(7);
    const later = new Date(+now + 48 * 3600000 + 30 * 60000);
    for (let i = 0; i < 3; i++)
      await cycle(s.state, config, s.transport, s.model, s.save, new Date(+later + i * 120000));
    expect(s.transport.send).toHaveBeenCalledTimes(10);
    expect(s.state.pilot?.status).toBe('draining');
    expect(s.state.contacts.c10?.status).toBe('approved');
    await cycle(
      s.state,
      config,
      s.transport,
      s.model,
      s.save,
      new Date(+later + 48 * 3600000 + 10 * 60000),
    );
    expect(s.state.pilot?.status).toBe('awaiting_review');
    expect(s.state.pilotHistory).toHaveLength(1);
    expect(pilotReport(s.state).outcomes?.no_reply).toBe(10);
    const restored = State.parse(JSON.parse(JSON.stringify(s.state)));
    const reads = vi.mocked(s.transport.inbox).mock.calls.length;
    await cycle(restored, config, s.transport, s.model, s.save, new Date(+later + 49 * 3600000));
    await discover(restored, config, s.transport, s.model, s.save, new Date(+later + 49 * 3600000));
    expect(s.transport.send).toHaveBeenCalledTimes(10);
    expect(s.transport.inbox).toHaveBeenCalledTimes(reads);
    expect(s.transport.posts).not.toHaveBeenCalled();
    expect(s.model.respond).not.toHaveBeenCalled();
  });
  it('does not free a slot just before 48 hours, and never calls silence a refusal', async () => {
    const s = setup(1);
    await cycle(s.state, config, s.transport, s.model, s.save, now);
    await cycle(
      s.state,
      config,
      s.transport,
      s.model,
      s.save,
      new Date(+now + 48 * 3600000 - 1000),
    );
    expect(s.state.contacts.c0?.status).toBe('contacted');
    await cycle(
      s.state,
      config,
      s.transport,
      s.model,
      s.save,
      new Date(+now + 48 * 3600000 + 1000),
    );
    expect(s.state.contacts.c0?.status).toBe('waiting');
    expect(s.state.contacts.c0?.result).toBe('waiting');
    expect(pilotReport(s.state).outcomes?.declined).toBeUndefined();
    expect(s.transport.send).toHaveBeenCalledTimes(1);
  });
  it('prioritizes a queued late response over new contacts without exceeding seven slots', async () => {
    const s = setup(0);
    s.state.contacts.wait = make('wait', 'waiting');
    for (let i = 0; i < 7; i++) s.state.contacts['a' + i] = make('a' + i, 'contacted');
    s.state.contacts.new = make('new');
    ensurePilot(s.state, config, now);
    s.transport.inbox = async (c) =>
      c.id === 'wait'
        ? [
            {
              id: 20,
              text: 'так можна спробувати',
              at: now.toISOString(),
              direction: 'in' as const,
            },
          ]
        : c.id === 'a0'
          ? [{ id: 21, text: 'Не цікаво', at: now.toISOString(), direction: 'in' as const }]
          : [];
    await cycle(s.state, config, s.transport, s.model, s.save, now);
    expect(s.state.contacts.wait?.status).toBe('waiting');
    expect(s.state.contacts.new?.status).toBe('approved');
    await cycle(s.state, config, s.transport, s.model, s.save, new Date(+now + 120000));
    expect(s.state.contacts.wait?.status).toBe('interested');
    expect(activeCount(s.state)).toBe(7);
    expect(s.state.contacts.new?.status).toBe('approved');
    expect(s.transport.send).toHaveBeenCalledTimes(1);
  });
  it('requires recorded review and an explicit next-cycle command while retaining quotas and opt-outs', () => {
    const s = setup(0);
    s.state.contacts.old = make('old', 'declined');
    ensurePilot(s.state, { ...config, maxPilotContacts: 1 }, now);
    finishPilotIfReady(s.state, now);
    s.state.usage['2030-06-01'] = { messages: 3, initial: 1, modelCalls: 2 };
    expect(() => startNextPilot(s.state, config, now)).toThrow('Review');
    expect(() => reviewPilot(s.state, ' ')).toThrow('Record');
    reviewPilot(s.state, 'Разом переглянули звіт; скоротити пояснення реєстрації', now);
    expect(s.state.pilot?.status).toBe('awaiting_review');
    startNextPilot(s.state, config, new Date(+now + 60000));
    expect(s.state.pilot?.id).toBe(2);
    expect(s.state.pilot?.contactIds).toEqual([]);
    expect(s.state.usage['2030-06-01']?.initial).toBe(1);
    expect(s.state.contacts.old?.status).toBe('declined');
    expect(s.state.pilotHistory?.[0]?.reviewNotes).toContain('скоротити');
    expect(s.state.pilotHistory?.[0]?.nextPilotStartedAt).toBeTruthy();
    expect(s.state.pilotHistory?.[0]?.report.reservedContacts).toBe(1);
  });
  it('does not stop at the tenth introduction until active conversations resolve', async () => {
    const s = setup(1);
    const cfg = { ...config, maxPilotContacts: 1 };
    await cycle(s.state, cfg, s.transport, s.model, s.save, now);
    expect(s.state.pilot?.status).toBe('draining');
    s.transport.inbox = async () => [
      { id: 21, text: 'Не пишіть більше', at: now.toISOString(), direction: 'in' as const },
    ];
    await cycle(s.state, cfg, s.transport, s.model, s.save, new Date(+now + 120000));
    expect(s.state.pilot?.status).toBe('awaiting_review');
    const snapshot = JSON.stringify(s.state.pilotHistory?.[0]?.report);
    s.state.contacts.c0!.note = 'Changed after report';
    expect(JSON.stringify(s.state.pilotHistory?.[0]?.report)).toBe(snapshot);
    expect(s.state.pilotHistory?.[0]?.markdown).toContain('Відмова');
    expect(renderPilotReport(pilotReport(s.state))).toContain('MISSING');
  });
  it('does not reopen a previous-cycle waiting contact on an unrelated new cycle', async () => {
    const s = setup(0);
    s.state.contacts.old = make('old', 'waiting');
    ensurePilot(s.state, { ...config, maxPilotContacts: 1 }, now);
    finishPilotIfReady(s.state, now);
    reviewPilot(s.state, 'Перший цикл переглянуто', now);
    startNextPilot(s.state, config, now);
    s.transport.inbox = vi.fn(async () => [
      { id: 20, text: 'Так', at: now.toISOString(), direction: 'in' as const },
    ]);
    await cycle(s.state, config, s.transport, s.model, s.save, now);
    expect(s.transport.inbox).not.toHaveBeenCalled();
    expect(s.state.contacts.old?.status).toBe('waiting');
  });
  it('fails closed on a migrated state with too many already active conversations', async () => {
    const s = setup(0);
    for (let i = 0; i < 8; i++) s.state.contacts['c' + i] = make('c' + i, 'contacted');
    await expect(cycle(s.state, config, s.transport, s.model, s.save, now)).rejects.toThrow(
      'exceed',
    );
    expect(s.transport.send).not.toHaveBeenCalled();
    expect(s.transport.inbox).not.toHaveBeenCalled();
  });
  it('rechecks the Kyiv sending window after a slow model response and reuses the cached reply next morning', async () => {
    const s = setup(0);
    s.state.contacts.c0 = make('c0', 'contacted');
    s.transport.inbox = async () => [
      {
        id: 20,
        text: 'Чи можна змінити команди після старту?',
        at: now.toISOString(),
        direction: 'in' as const,
      },
    ];
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    s.model.respond = vi.fn(async () => {
      clock.mockReturnValue(11000);
      return { action: 'reply' as const, text: 'Це питання передам команді.', reason: 'test' };
    });
    await cycle(s.state, config, s.transport, s.model, s.save, new Date('2030-06-01T15:59:55Z'));
    expect(s.transport.send).not.toHaveBeenCalled();
    expect(s.state.contacts.c0?.prepared).toBeDefined();
    await cycle(s.state, config, s.transport, s.model, s.save, new Date('2030-06-02T09:00:00Z'));
    expect(s.transport.send).toHaveBeenCalledTimes(1);
    expect(s.model.respond).toHaveBeenCalledTimes(1);
  });
});
