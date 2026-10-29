import { createTRPCClient, httpLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@app/api';
import { API_URL } from '@/lib/site';

// Server-side reads for link previews (metadata + OG image). The browser
// client lives in providers.tsx; this one has no auth, like a crawler.
const api = createTRPCClient<AppRouter>({
  links: [httpLink({ url: `${API_URL}/trpc`, transformer: superjson })],
});

// Previews render on the server (UTC), but games happen in Ukraine.
const TZ = 'Europe/Kyiv';
const day = new Intl.DateTimeFormat('uk-UA', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TZ,
});
const time = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: TZ });

export type EventPreview = {
  day: string;
  time: string;
  place: string;
  format: string;
  status: string;
  availableSlots: number;
  capacity: number;
};

export async function getEventPreview(id: string): Promise<EventPreview | null> {
  try {
    const e = await api.events.get.query({ id });
    return {
      day: day.format(e.startAt),
      time: `${time.format(e.startAt)}–${time.format(e.endAt)}`,
      place: `${e.field.venue.name}, ${e.field.venue.city.name}`,
      format: `${e.playersPerTeam} на ${e.playersPerTeam}`,
      status: e.status,
      availableSlots: e.availableSlots,
      capacity: e.capacity,
    };
  } catch {
    return null;
  }
}

export function slotsLabel(p: EventPreview): string {
  if (p.status === 'FINISHED') return 'Гру зіграно';
  if (p.status === 'CANCELLED') return 'Гру скасовано';
  if (p.availableSlots === 0) return 'Усі місця зайняті';
  return `Вільно ${p.availableSlots} з ${p.capacity} місць`;
}
