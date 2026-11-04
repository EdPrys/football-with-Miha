'use client';

import { useCallback, useSyncExternalStore } from 'react';
const CHANGE = 'kopanka:saved-state';

export function readSaved(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
export function writeSaved(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    window.dispatchEvent(new Event(CHANGE));
    return true;
  } catch {
    return false;
  }
}
function subscribe(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener(CHANGE, listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener(CHANGE, listener);
  };
}
/** null during SSR/hydration, then a stable raw string; works when storage is blocked. */
export function useSavedText(key: string) {
  return useSyncExternalStore(
    subscribe,
    useCallback(() => readSaved(key), [key]),
    () => null,
  );
}

export type SearchPreferences = {
  cityId: string;
  filter: 'all' | 'today' | 'tomorrow' | 'weekend';
};
export function searchPreferences(raw: string | null): SearchPreferences {
  try {
    const value = JSON.parse(raw ?? '');
    return {
      cityId:
        typeof value.cityId === 'string' && /^[a-z0-9-]{1,100}$/.test(value.cityId)
          ? value.cityId
          : '',
      filter: ['all', 'today', 'tomorrow', 'weekend'].includes(value.filter) ? value.filter : 'all',
    };
  } catch {
    return { cityId: '', filter: 'all' };
  }
}

const TEXT_FIELDS = [
  'cityId',
  'venueId',
  'fieldId',
  'date',
  'endDate',
  'startTime',
  'endTime',
  'numberOfTeams',
  'playersPerTeam',
  'price',
  'level',
  'newcomerInfo',
  'organizerPhone',
  'organizerTelegram',
] as const;
export type GameDraft = Partial<Record<(typeof TEXT_FIELDS)[number], string>> & {
  paymentRequired?: boolean;
};
/** Untrusted/stale browser storage is never spread into API input. */
export function gameDraft(raw: string | null): GameDraft {
  try {
    const data = JSON.parse(raw ?? '');
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const draft: GameDraft = {};
    for (const key of TEXT_FIELDS)
      if (typeof data[key] === 'string' && data[key].length <= 2000) draft[key] = data[key];
    if (typeof data.paymentRequired === 'boolean') draft.paymentRequired = data.paymentRequired;
    return draft;
  } catch {
    return {};
  }
}
