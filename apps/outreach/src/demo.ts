import { emptyState, Config, type Message } from './state.js';
import { cycle, discover, report, type Transport } from './engine.js';
import type { Model } from './model.js';
import { transitionContact } from '@app/domain/outreach';
export async function demo() {
  const now = new Date('2030-06-01T09:00:00Z');
  const config = Config.parse({
    mode: 'live',
    city: 'Тестове місто',
    sources: ['@demo_football'],
    siteUrl: 'https://kopanka.pro',
    campaign: 'demo',
    maxNewContactsPerDay: 3,
    maxMessagesPerDay: 15,
    minSendIntervalSeconds: 300,
    maxModelCallsPerDay: 30,
    pollSeconds: 60,
    sourceMessageLimit: 30,
  });
  const state = emptyState();
  let inbox: Message[] = [];
  const sent: string[] = [];
  const transport: Transport = {
    posts: async () => [
      {
        id: 1,
        text: 'Організовую футбол у Тестовому місті, добираю гравців.',
        at: now.toISOString(),
        author: { id: 'demo-only', username: '@demo_organizer' },
      },
    ],
    inbox: async () => inbox,
    send: async (_contact, text) => {
      sent.push(text);
      return 10 + sent.length;
    },
  };
  const model: Model = {
    qualify: async (text, _config, onUsage) => {
      await onUsage?.({ inputTokens: 0, outputTokens: 0 });
      return { organizer: true, evidence: text };
    },
    respond: async () => ({
      action: 'interested',
      text: 'Почніть із реєстрації, а у профілі натисніть «Стати організатором». Потім можна створити найближчу гру: https://kopanka.pro/events/new',
      reason: 'Explicit interest in a synthetic conversation',
    }),
  };
  const save = async () => {};
  await discover(state, config, transport, model, save, now);
  const contact = state.contacts['demo-only']!;
  contact.status = transitionContact(contact.status, 'approved');
  await cycle(state, config, transport, model, save, now);
  inbox = [
    {
      id: 20,
      text: 'так можна спробувати',
      at: now.toISOString(),
      direction: 'in',
    },
  ];
  await cycle(state, config, transport, model, save, new Date(now.getTime() + 301_000));
  inbox.push({
    id: 21,
    text: 'Готово, ось гра https://kopanka.pro/events/demo-event',
    at: now.toISOString(),
    direction: 'in',
  });
  await cycle(state, config, transport, model, save, new Date(now.getTime() + 602_000));
  inbox.push({ id: 22, text: 'Стоп, більше не пишіть', at: now.toISOString(), direction: 'in' });
  await cycle(state, config, transport, model, save, new Date(now.getTime() + 602_000));
  console.log(
    JSON.stringify(
      { offlineDemo: true, externalRequests: 0, sentToMockOnly: sent, report: report(state) },
      null,
      2,
    ),
  );
}
