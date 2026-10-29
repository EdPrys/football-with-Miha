import type { City, Event, Field, Venue } from '@app/db';

const dateFmt = new Intl.DateTimeFormat('uk-UA', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Kyiv',
});
const timeFmt = new Intl.DateTimeFormat('uk-UA', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Kyiv',
});

/** Base URL of the web app, for linking back to the event (prod: https://kopanka.pro). */
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

export function eventAnnouncementText(
  event: Event,
  field: Field & { venue: Venue & { city: City } },
): string {
  const when = `${dateFmt.format(event.startAt)}, ${timeFmt.format(event.startAt)}–${timeFmt.format(event.endAt)}`;
  return [
    '⚽ <b>Нова гра!</b>',
    when,
    `📍 ${field.venue.name}, ${field.venue.city.name} · ${field.name}`,
    `👥 ${event.playersPerTeam} на ${event.playersPerTeam}`,
    `${APP_URL}/events/${event.id}`,
  ].join('\n');
}
