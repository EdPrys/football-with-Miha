import { describe, expect, it } from 'vitest';
import { loginFor, nextWeeklyDates, participationPrice, safeReturnTo } from './game-flow';

describe('auth return paths', () => {
  it('preserves an internal destination through login and signup', () => {
    const path = '/events/new?repeat=abc';
    const params = new URL(loginFor(path, true), 'https://example.test').searchParams;
    expect(params.get('mode')).toBe('register');
    expect(safeReturnTo(params.get('next'))).toBe(path);
    expect(safeReturnTo('/?city=kyiv')).toBe('/?city=kyiv');
  });
  it.each([
    null,
    '',
    '//evil.test',
    '/\\evil.test',
    'javascript:alert(1)',
    'https://evil.test',
    '/\nevil.test',
    '/login?next=/login',
    '/login/',
  ])('rejects unsafe/looping return path %s', (value) => {
    expect(safeReturnTo(value)).toBe('/profile');
  });
});

describe('repeat date suggestions', () => {
  it('moves by a calendar week and preserves an overnight end date', () => {
    const start = new Date(2030, 5, 1, 23, 0);
    const end = new Date(2030, 5, 2, 1, 0);
    const result = nextWeeklyDates(start, end, new Date(2030, 4, 1));
    expect(result.startAt).toEqual(new Date(2030, 5, 8, 23, 0));
    expect(result.endAt).toEqual(new Date(2030, 5, 9, 1, 0));
    expect(start).toEqual(new Date(2030, 5, 1, 23, 0));
  });
  it('keeps wall-clock times over a daylight-saving calendar week', () => {
    const result = nextWeeklyDates(
      new Date(2030, 2, 24, 20),
      new Date(2030, 2, 24, 22),
      new Date(2030, 2, 23),
    );
    expect(result.startAt).toEqual(new Date(2030, 2, 31, 20));
    expect(result.endAt).toEqual(new Date(2030, 2, 31, 22));
  });
  it('skips expired weeks for an old game', () => {
    const result = nextWeeklyDates(
      new Date(2030, 5, 1, 20),
      new Date(2030, 5, 1, 22),
      new Date(2030, 5, 16),
    );
    expect(result.startAt).toEqual(new Date(2030, 5, 22, 20));
    expect(result.endAt).toEqual(new Date(2030, 5, 22, 22));
  });
});

describe('participation price', () => {
  it('distinguishes unknown, free and paid games', () => {
    expect(participationPrice(null)).toBe('Вартість уточнюється');
    expect(participationPrice(0)).toBe('Безкоштовно');
    expect(participationPrice(15050)).toContain('150,5');
  });
});
