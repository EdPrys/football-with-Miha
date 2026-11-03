export type CalendarGame = {
  id: string;
  startAt: Date;
  endAt: Date;
  venue: string;
  location: string;
  instructions?: string | null;
  url: string;
};

function escapeText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}
function timestamp(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}
/** RFC 5545 folds physical lines at 75 UTF-8 octets, not JS character counts. */
function foldLine(line: string) {
  const encoder = new TextEncoder();
  let result = '',
    width = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (width + size > 75) {
      result += '\r\n ';
      width = 1;
    }
    result += character;
    width += size;
  }
  return result;
}
export function gameCalendar(game: CalendarGame, now = new Date()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kopanka//Football Games//UK',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${escapeText(game.id)}@kopanka.pro`,
    `DTSTAMP:${timestamp(now)}`,
    `DTSTART:${timestamp(game.startAt)}`,
    `DTEND:${timestamp(game.endAt)}`,
    `SUMMARY:${escapeText(`Футбол · ${game.venue}`)}`,
    `LOCATION:${escapeText(game.location)}`,
    `DESCRIPTION:${escapeText([game.instructions, 'Перевір актуальний статус гри в Kopanka.', game.url].filter(Boolean).join('\n'))}`,
    `URL:${game.url.replace(/[\r\n]/g, '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function directionsUrl(venue: {
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city: { name: string };
}) {
  const hasCoordinates = venue.latitude != null && venue.longitude != null;
  const destination = hasCoordinates
    ? `${venue.latitude},${venue.longitude}`
    : [venue.address, venue.name, venue.city.name].filter(Boolean).join(', ');
  const url = new URL(
    hasCoordinates || venue.address
      ? 'https://www.google.com/maps/dir/'
      : 'https://www.google.com/maps/search/',
  );
  url.searchParams.set('api', '1');
  url.searchParams.set(hasCoordinates || venue.address ? 'destination' : 'query', destination);
  return url.href;
}
