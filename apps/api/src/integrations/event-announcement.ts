import type { Event, Field, Venue } from '@app/db';

const dateFmt = new Intl.DateTimeFormat('uk-UA', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const timeFmt = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' });

/** Base URL of the web app, for linking back to the event. Not deployed yet, so defaults to localhost. */
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

export function eventAnnouncementText(event: Event, field: Field & { venue: Venue }): string {
  const when = `${dateFmt.format(event.startAt)}, ${timeFmt.format(event.startAt)}–${timeFmt.format(event.endAt)}`;
  return [
    '⚽ <b>Нова гра!</b>',
    when,
    `📍 ${field.venue.name}, ${field.venue.city} · ${field.name}`,
    `👥 ${event.playersPerTeam} на ${event.playersPerTeam}`,
    `${APP_URL}/events/${event.id}`,
  ].join('\n');
}
