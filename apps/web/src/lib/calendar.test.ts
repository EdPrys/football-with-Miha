import { describe, expect, it } from 'vitest';
import { directionsUrl, gameCalendar } from './calendar';
const game = {
  id: 'e1',
  startAt: new Date('2030-06-01T15:00:00Z'),
  endAt: new Date('2030-06-01T16:00:00Z'),
  venue: 'Поле',
  location: 'Київ, вул. Тестова; 1',
  instructions: 'Вхід\nBEGIN:VEVENT\nТест, кома',
  url: 'https://kopanka.pro/events/e1',
};

describe('calendar export', () => {
  it('exports UTC times, stable identity and escaped text without injecting ICS properties', () => {
    const text = gameCalendar(game, new Date('2030-01-01T00:00:00Z'));
    expect(text).toContain('DTSTART:20300601T150000Z\r\n');
    expect(text).toContain('DTEND:20300601T160000Z\r\n');
    expect(text).toContain('UID:e1@kopanka.pro');
    expect(text.match(/\r\nBEGIN:VEVENT\r\n/g)).toHaveLength(1);
    expect(text).toContain('Вхід\\nBEGIN:VEVENT\\n');
    expect(text).toContain('\\,');
    expect(text).not.toContain('VALARM');
  });
  it('folds long Ukrainian lines by UTF-8 byte length without breaking characters', () => {
    const text = gameCalendar({ ...game, instructions: 'Граємо разом ⚽ '.repeat(100) });
    for (const line of text.split('\r\n'))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(text).not.toContain('\uFFFD');
    const unfolded = text.replace(/\r\n /g, '');
    expect(unfolded).toContain('Граємо разом ⚽ '.repeat(100));
  });
});

describe('directions links', () => {
  it('uses known coordinates including zero', () => {
    const url = new URL(
      directionsUrl({ name: 'Field', city: { name: 'Київ' }, latitude: 0, longitude: 30 }),
    );
    expect(url.searchParams.get('destination')).toBe('0,30');
  });
  it('uses a known address, but searches when the precise location is unknown', () => {
    expect(
      new URL(directionsUrl({ name: 'Поле', city: { name: 'Київ' }, address: 'Адреса 1' }))
        .pathname,
    ).toBe('/maps/dir/');
    expect(new URL(directionsUrl({ name: 'Поле', city: { name: 'Київ' } })).pathname).toBe(
      '/maps/search/',
    );
  });
});
