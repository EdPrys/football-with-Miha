import { afterEach, describe, expect, it, vi } from 'vitest';
import { gameDraft, readSaved, searchPreferences, writeSaved } from './saved-state';
afterEach(() => vi.unstubAllGlobals());

describe('saved preferences and drafts', () => {
  it('reads only known values from stale or malicious storage', () => {
    expect(searchPreferences('{"cityId":"kyiv","filter":"tomorrow"}')).toEqual({
      cityId: 'kyiv',
      filter: 'tomorrow',
    });
    expect(searchPreferences('{"cityId":"//external.test","filter":"invented"}')).toEqual({
      cityId: '',
      filter: 'all',
    });
    for (const value of ['null', '[]', 'not json'])
      expect(searchPreferences(value)).toEqual({ cityId: '', filter: 'all' });
    expect(
      gameDraft('{"cityId":"kyiv","price":"0","password":"secret","newcomerInfo":12}'),
    ).toEqual({ cityId: 'kyiv', price: '0' });
    expect(gameDraft(JSON.stringify({ newcomerInfo: 'x'.repeat(2001) }))).toEqual({});
  });
  it('recovers gracefully when browser storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readSaved('draft')).toBe('');
    expect(writeSaved('draft', 'data')).toBe(false);
  });
  it('stores and clears drafts while publishing a same-tab change event', () => {
    const values = new Map<string, string>();
    const dispatchEvent = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    vi.stubGlobal('window', { dispatchEvent });
    expect(writeSaved('draft:user1', '{"price":"0"}')).toBe(true);
    expect(readSaved('draft:user1')).toBe('{"price":"0"}');
    expect(readSaved('draft:user2')).toBe('');
    expect(writeSaved('draft:user1', null)).toBe(true);
    expect(readSaved('draft:user1')).toBe('');
    expect(dispatchEvent).toHaveBeenCalledTimes(2);
  });
});
