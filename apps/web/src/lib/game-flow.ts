/** Only navigate inside this application after authentication. */
export function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value))
    return '/profile';
  try {
    const url = new URL(value, 'https://kopanka.local');
    if (url.origin !== 'https://kopanka.local' || url.pathname.replace(/\/+$/, '') === '/login')
      return '/profile';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/profile';
  }
}

export function loginFor(path: string, register = false) {
  return `/login?${register ? 'mode=register&' : ''}next=${encodeURIComponent(safeReturnTo(path))}`;
}

/** Calendar weeks in the organizer's local timezone, preserving local clock times. */
export function nextWeeklyDates(start: Date, end: Date, now = new Date()) {
  const startAt = new Date(start);
  const endAt = new Date(end);
  do {
    startAt.setDate(startAt.getDate() + 7);
    endAt.setDate(endAt.getDate() + 7);
  } while (startAt <= now);
  return { startAt, endAt };
}

export const GAME_LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Для початківців',
  CASUAL: 'Аматорський',
  COMPETITIVE: 'Досвідчені гравці',
  ALL_LEVELS: 'Будь-який рівень',
};

export function participationPrice(priceMinor: number | null | undefined) {
  if (priceMinor == null) return 'Вартість уточнюється';
  if (priceMinor === 0) return 'Безкоштовно';
  return `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(priceMinor / 100)} грн / гравець`;
}
