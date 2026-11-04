import {
  isActiveConversation,
  transitionContact,
  conversationIsIdle,
  isOptOut,
} from '@app/domain/outreach';
import type { Config, Contact, Pilot, State } from './state.js';

export function usageTotals(state: State): Record<string, number> {
  const total = {
    messages: 0,
    initial: 0,
    modelCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    unreportedUsageCalls: 0,
  };
  for (const row of Object.values(state.usage))
    for (const key of Object.keys(total) as (keyof typeof total)[]) {
      total[key] +=
        key === 'unreportedUsageCalls'
          ? (row.unreportedUsageCalls ??
            (row.inputTokens === undefined || row.outputTokens === undefined ? row.modelCalls : 0))
          : (row[key] ?? 0);
    }
  return total;
}
export function ensurePilot(state: State, config: Config, now: Date): Pilot {
  if (state.pilot) return state.pilot;
  // Adopt historical contacts instead of silently granting another ten on upgrade.
  const previous = Object.values(state.contacts).filter(
    (c) => c.messages.some((m) => m.direction === 'out') || c.pendingSend,
  );
  state.pilot = {
    id: 1,
    status: 'running',
    startedAt: now.toISOString(),
    contactIds: previous.map((c) => c.id),
    limit: config.maxPilotContacts,
    concurrency: config.maxActiveConversations,
    idleHours: config.idleConversationHours,
    usageBaseline: previous.length ? {} : usageTotals(state),
  };
  for (const c of previous) c.pilotId = 1;
  updateDrain(state.pilot);
  return state.pilot;
}
function updateDrain(pilot: Pilot) {
  if (pilot.status === 'running' && pilot.contactIds.length >= pilot.limit)
    pilot.status = 'draining';
}
export function activeCount(state: State): number {
  return Object.values(state.contacts).filter(
    (c) => isActiveConversation(c.status) || !!c.pendingSend,
  ).length;
}
export function mayStartContact(state: State): boolean {
  const pilot = state.pilot;
  return (
    !!pilot &&
    pilot.status === 'running' &&
    pilot.contactIds.length < pilot.limit &&
    activeCount(state) < pilot.concurrency &&
    !pilot.contactIds.some((id) => {
      const c = state.contacts[id];
      return (
        c?.status === 'waiting' &&
        c.messages.some((m) => m.direction === 'in' && m.id > c.handledInboundId)
      );
    })
  );
}
export function reserveContact(state: State, contact: Contact) {
  const pilot = state.pilot;
  if (!pilot || !mayStartContact(state))
    throw new Error('Pilot quota or concurrent conversation limit reached');
  if (pilot.contactIds.includes(contact.id)) throw new Error('Initial contact already reserved');
  pilot.contactIds.push(contact.id);
  contact.pilotId = pilot.id;
  updateDrain(pilot);
}
export function settleIdle(state: State, contact: Contact, now: Date) {
  const pilot = state.pilot;
  if (!pilot || !isActiveConversation(contact.status)) return;
  const last = contact.messages.reduce(
    (at, m) => (Date.parse(m.at) > Date.parse(at) ? m.at : at),
    '1970-01-01T00:00:00Z',
  );
  const unhandled = contact.messages.some(
    (m) => m.direction === 'in' && m.id > contact.handledInboundId,
  );
  if (
    conversationIsIdle({
      lastActivityAt: contact.messages.length ? last : pilot.startedAt,
      now,
      hours: pilot.idleHours,
      hasUnhandledReply: unhandled,
    })
  ) {
    contact.status = transitionContact(contact.status, 'waiting');
    contact.waitingSince = now.toISOString();
    contact.result = 'waiting';
    contact.note = `${pilot.idleHours}-hour inactivity window elapsed; no reminder sent`;
  }
}
export function reopenWaiting(state: State, contact: Contact): boolean {
  const pilot = state.pilot;
  if (
    !pilot ||
    pilot.status === 'awaiting_review' ||
    !pilot.contactIds.includes(contact.id) ||
    activeCount(state) >= pilot.concurrency
  )
    return false;
  contact.status = transitionContact(contact.status, 'contacted');
  contact.waitingSince = undefined;
  contact.result = undefined;
  contact.note = 'Late reply received; resumed in an available conversation slot';
  return true;
}
function resultFor(contact: Contact): string {
  if (contact.pendingSend) return 'delivery_uncertain';
  if (contact.status === 'activated') return 'owner_verified_activation';
  if (contact.status === 'declined') return 'declined';
  if (contact.status === 'waiting')
    return contact.messages.some((m) => m.direction === 'in') ? 'waiting_after_reply' : 'no_reply';
  if (contact.status === 'handoff')
    return contact.result === 'conversation_closed'
      ? 'conversation_closed_unverified'
      : 'needs_owner';
  return 'in_progress';
}
export function pilotReport(state: State, now = new Date()) {
  const pilot = state.pilot;
  if (!pilot) return { status: 'not_started' };
  const contacts = pilot.contactIds.flatMap((id) =>
    state.contacts[id] ? [state.contacts[id]!] : [],
  );
  const outcomes: Record<string, number> = {};
  const reasons: Record<string, number> = {};
  const entries = contacts.map((c) => {
    const outcome = resultFor(c);
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
    if (c.note) reasons[c.note] = (reasons[c.note] ?? 0) + 1;
    return {
      contactId: c.id,
      username: c.username,
      campaign: c.campaign,
      outcome,
      status: c.status,
      reason: c.note ?? null,
      inboundMessages: c.messages.filter((m) => m.direction === 'in').length,
      outboundMessages: c.messages.filter((m) => m.direction === 'out').length,
      lastInbound:
        [...c.messages]
          .reverse()
          .find((m) => m.direction === 'in')
          ?.text.slice(0, 400) ?? null,
      declineEvidence:
        c.status === 'declined'
          ? ([...c.messages]
              .reverse()
              .find((m) => m.direction === 'in' && isOptOut(m.text))
              ?.text.slice(0, 400) ?? null)
          : null,
      lastQuestion:
        [...c.messages]
          .reverse()
          .find((m) => m.direction === 'in' && m.text.includes('?'))
          ?.text.slice(0, 400) ?? null,
      manualActivation: c.verifiedEventUrl ?? null,
      metrics: c.metrics ?? null,
    };
  });
  const totals = usageTotals(state);
  const usage = Object.fromEntries(
    Object.entries(totals).map(([k, n]) => [k, Math.max(0, n - (pilot.usageBaseline[k] ?? 0))]),
  );
  return {
    pilotId: pilot.id,
    status: pilot.status,
    startedAt: pilot.startedAt,
    completedAt: pilot.completedAt ?? null,
    generatedAt: now.toISOString(),
    contactLimit: pilot.limit,
    concurrencyLimit: pilot.concurrency,
    reservedContacts: contacts.length,
    recordedFirstContacts: contacts.filter((c) => c.messages.some((m) => m.direction === 'out'))
      .length,
    repliedContacts: contacts.filter((c) => c.messages.some((m) => m.direction === 'in')).length,
    activeConversations: activeCount(state),
    outcomes,
    reasons,
    usage,
    estimatedCostUsd: (() => {
      const input = Number(process.env.OUTREACH_INPUT_USD_PER_MILLION || NaN),
        output = Number(process.env.OUTREACH_OUTPUT_USD_PER_MILLION || NaN);
      return Number.isFinite(input) &&
        input >= 0 &&
        Number.isFinite(output) &&
        output >= 0 &&
        !usage.unreportedUsageCalls
        ? ((usage.inputTokens ?? 0) * input + (usage.outputTokens ?? 0) * output) / 1_000_000
        : null;
    })(),
    contacts: entries,
    missingMetrics: contacts.filter((c) => !c.metrics).length,
    measurementNote:
      'Counts are cohort observations, not identity verification; missing/stale metrics and silence are not refusals. Usage includes background work during this pilot.',
  };
}
export function finishPilotIfReady(state: State, now: Date): boolean {
  const pilot = state.pilot;
  if (!pilot || pilot.status === 'awaiting_review') return false;
  updateDrain(pilot);
  if (
    pilot.contactIds.some((id) => {
      const c = state.contacts[id];
      return (
        c?.status === 'waiting' &&
        c.messages.some((m) => m.direction === 'in' && m.id > c.handledInboundId)
      );
    })
  )
    return false;
  if (
    pilot.status !== 'draining' ||
    activeCount(state) > 0 ||
    Object.values(state.contacts).some((c) => c.pendingSend)
  )
    return false;
  pilot.status = 'awaiting_review';
  pilot.completedAt = now.toISOString();
  state.pilotHistory ??= [];
  state.pilotHistory.push({
    id: pilot.id,
    completedAt: pilot.completedAt,
    report: JSON.parse(JSON.stringify(pilotReport(state, now))),
    markdown: renderPilotReport(pilotReport(state, now)),
  });
  return true;
}
export function reviewPilot(state: State, notes: string, now = new Date()) {
  const pilot = state.pilot;
  if (!pilot || pilot.status !== 'awaiting_review')
    throw new Error('Pilot must finish before review');
  if (!notes.trim() || notes.length > 4000)
    throw new Error('Record the owner review and agreed changes (1–4000 characters)');
  pilot.reviewNotes = notes.trim();
  pilot.reviewedAt = now.toISOString();
  const archived = state.pilotHistory?.find((p) => p.id === pilot.id);
  if (archived) {
    archived.reviewedAt = pilot.reviewedAt;
    archived.reviewNotes = pilot.reviewNotes;
  }
}
export function startNextPilot(state: State, config: Config, now = new Date()) {
  const pilot = state.pilot;
  if (!pilot || pilot.status !== 'awaiting_review' || !pilot.reviewedAt || !pilot.reviewNotes)
    throw new Error('Review the completed pilot before explicitly starting the next one');
  if (
    state.paused ||
    activeCount(state) > 0 ||
    Object.values(state.contacts).some((c) => c.pendingSend)
  )
    throw new Error('Resolve paused/uncertain conversations first');
  const archived = state.pilotHistory?.find((p) => p.id === pilot.id);
  if (archived) archived.nextPilotStartedAt = now.toISOString();
  const id = pilot.id + 1;
  // Do not reset contacts, opt-outs, daily quotas or historical reports.
  state.pilot = {
    id,
    status: 'running',
    startedAt: now.toISOString(),
    contactIds: [],
    limit: config.maxPilotContacts,
    concurrency: config.maxActiveConversations,
    idleHours: config.idleConversationHours,
    usageBaseline: usageTotals(state),
  };
}

export function renderPilotReport(snapshot: ReturnType<typeof pilotReport>): string {
  if (!snapshot.contacts) return 'Пілот ще не розпочато.\n';
  const esc = (value: unknown) =>
    String(value ?? '—')
      .replace(/\|/g, '\\|')
      .replace(/[\r\n]+/g, ' ');
  const names: Record<string, string> = {
    owner_verified_activation: 'Результат підтверджено власником',
    declined: 'Відмова',
    no_reply: 'Без відповіді',
    waiting_after_reply: 'Очікування після відповіді',
    needs_owner: 'Потрібна допомога власника',
    conversation_closed_unverified: 'Розмову завершено, результат не підтверджено',
    delivery_uncertain: 'Доставка невизначена',
    in_progress: 'У роботі',
  };
  const lines = [
    `# Пілот №${snapshot.pilotId}`,
    '',
    `Стан: ${snapshot.status}. Контакти: ${snapshot.reservedContacts}/${snapshot.contactLimit}. Відповіли: ${snapshot.repliedContacts}. Активні розмови: ${snapshot.activeConversations}/${snapshot.concurrencyLimit}.`,
    '',
    '| Контакт | Результат | Реєстрації групи | Ігри | Нові гравці записались | Причина / спостереження |',
    '| --- | --- | ---: | ---: | ---: | --- |',
  ];
  for (const c of snapshot.contacts)
    lines.push(
      `| ${esc(c.username)} | ${esc(names[c.outcome])} | ${c.metrics?.registeredUsers ?? 'MISSING'} | ${c.metrics?.gamesCreated ?? 'MISSING'} | ${c.metrics?.newPlayersJoined ?? 'MISSING'} | ${esc(c.reason)} |`,
    );
  lines.push(
    '',
    `Оцінка витрат USD: ${snapshot.estimatedCostUsd ?? 'MISSING (немає ставок або повного usage)'}. Модельні запити: ${snapshot.usage.modelCalls ?? 0}; вхідні токени: ${snapshot.usage.inputTokens ?? 0}; вихідні: ${snapshot.usage.outputTokens ?? 0}; виклики без підтвердженого usage: ${snapshot.usage.unreportedUsageCalls ?? 0}.`,
    '',
    'Без відповіді ≠ відмова. Цифри стосуються групи переходів за посиланням, а не підтвердженої особи співрозмовника. Час спостереження та останні питання є у JSON-звіті.',
    '',
    'Перед наступним запуском разом розгляньте причини відмов, незрозумілі питання, кроки без завершення та витрати; запишіть висновки через review-pilot і явно виконайте start-next-pilot.',
    '',
  );
  return lines.join('\n');
}
