import type { EventStatus } from '@app/db';
import { DomainError } from '../errors.js';

/** Allowed event status transitions. FINISHED and CANCELLED are terminal. */
export const EVENT_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  UPCOMING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['FINISHED', 'CANCELLED'],
  FINISHED: [],
  CANCELLED: [],
};

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return EVENT_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: EventStatus, to: EventStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError('INVALID_STATE', `Cannot change event from ${from} to ${to}`);
  }
}
