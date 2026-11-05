/** Outreach policy is independent of Telegram, model providers and storage. */
export type ContactStatus =
  | 'candidate'
  | 'approved'
  | 'contacted'
  | 'interested'
  | 'waiting'
  | 'handoff'
  | 'declined'
  | 'activated';
const transitions: Record<ContactStatus, readonly ContactStatus[]> = {
  candidate: ['approved', 'declined'],
  approved: ['contacted', 'declined', 'handoff'],
  contacted: ['interested', 'waiting', 'declined', 'handoff', 'activated'],
  interested: ['waiting', 'declined', 'handoff', 'activated'],
  waiting: ['contacted', 'interested', 'declined', 'handoff', 'activated'],
  handoff: ['declined', 'activated'],
  declined: [],
  activated: [],
};
export function transitionContact(from: ContactStatus, to: ContactStatus): ContactStatus {
  if (from !== to && !transitions[from].includes(to))
    throw new Error(`Invalid contact transition: ${from} -> ${to}`);
  return to;
}
export function kyivDay(now: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv' }).format(now);
}
export function isContactWindow(now: Date): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Kyiv',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  );
  return hour >= 9 && hour < 19;
}
export function isOptOut(text: string): boolean {
  return /(?:\b(?:stop|unsubscribe)\b|не\s+(?:пишіть|пиши|цікавить|цікаво|треба|потрібно)|відпис|відмовля|не\s+пишите|не\s+интерес)/iu.test(
    text,
  );
}
export function canSend(input: {
  status: ContactStatus;
  initial: boolean;
  now: Date;
  sentToday: number;
  initialToday: number;
  maxMessages: number;
  maxInitial: number;
  lastSentAt?: string;
  minIntervalSeconds: number;
  hasUnansweredInbound: boolean;
}): boolean {
  if (!isContactWindow(input.now) || input.sentToday >= input.maxMessages) return false;
  if (
    input.lastSentAt &&
    input.now.getTime() - Date.parse(input.lastSentAt) < input.minIntervalSeconds * 1000
  )
    return false;
  if (input.initial) return input.status === 'approved' && input.initialToday < input.maxInitial;
  return ['contacted', 'interested'].includes(input.status) && input.hasUnansweredInbound;
}

export function isActiveConversation(status: ContactStatus): boolean {
  return status === 'contacted' || status === 'interested';
}
export function conversationIsIdle(input: {
  lastActivityAt: string;
  now: Date;
  hours: number;
  hasUnhandledReply: boolean;
}): boolean {
  const at = Date.parse(input.lastActivityAt);
  return (
    !input.hasUnhandledReply &&
    Number.isFinite(at) &&
    input.now.getTime() - at >= input.hours * 3600_000
  );
}
