import type { PrismaClient } from '@app/db';
import { DomainError } from '../errors.js';

/** A template, not a clone: no participant, invitation, rating or lifecycle data. */
export async function repeatEventTemplate(
  prisma: PrismaClient,
  eventId: string,
  organizerId: string,
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organizerId: true,
      fieldId: true,
      startAt: true,
      endAt: true,
      numberOfTeams: true,
      playersPerTeam: true,
      priceMinor: true,
      level: true,
      newcomerInfo: true,
      organizerPhone: true,
      organizerTelegram: true,
      field: { select: { venueId: true, venue: { select: { cityId: true } } } },
    },
  });
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
  if (event.organizerId !== organizerId)
    throw new DomainError('FORBIDDEN', 'Only the organizer can repeat this game');
  return {
    fieldId: event.fieldId,
    startAt: event.startAt,
    endAt: event.endAt,
    numberOfTeams: event.numberOfTeams,
    playersPerTeam: event.playersPerTeam,
    priceMinor: event.priceMinor,
    level: event.level,
    newcomerInfo: event.newcomerInfo,
    organizerPhone: event.organizerPhone,
    organizerTelegram: event.organizerTelegram,
    venueId: event.field.venueId,
    cityId: event.field.venue.cityId,
  };
}
