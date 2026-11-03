import type { PrismaClient } from '@app/db';
import { DomainError } from '../errors.js';

export function organizerContacts(phone?: string | null, telegram?: string | null) {
  const organizerPhone = phone?.trim() || null;
  const organizerTelegram = telegram?.trim().replace(/^@/, '') || null;
  if (
    organizerPhone &&
    (!/^\+?[0-9 ()-]{7,30}$/.test(organizerPhone) ||
      !/^[0-9]{7,15}$/.test(organizerPhone.replace(/\D/g, '')))
  ) {
    throw new DomainError('VALIDATION', 'Invalid organizer phone');
  }
  if (organizerTelegram && !/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(organizerTelegram)) {
    throw new DomainError('VALIDATION', 'Invalid organizer Telegram username');
  }
  return { organizerPhone, organizerTelegram };
}

export async function updateOrganizerContacts(
  prisma: PrismaClient,
  eventId: string,
  organizerId: string,
  phone?: string | null,
  telegram?: string | null,
) {
  const contacts = organizerContacts(phone, telegram);
  const result = await prisma.event.updateMany({
    where: { id: eventId, organizerId },
    data: contacts,
  });
  if (!result.count) throw new DomainError('FORBIDDEN', 'Only the organizer can manage this event');
  return { ok: true };
}
