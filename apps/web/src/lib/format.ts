export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'] as const;
export type PositionValue = (typeof POSITIONS)[number];

export const POSITION_LABEL: Record<PositionValue, string> = {
  GK: 'Воротар',
  DEF: 'Захисник',
  MID: 'Півзахисник',
  FWD: 'Нападник',
};

const day = new Intl.DateTimeFormat('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' });
const time = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' });

export const formatDate = (d: Date) => day.format(new Date(d));
export const formatTime = (d: Date) => time.format(new Date(d));
export const formatRange = (a: Date, b: Date) => `${formatTime(a)}–${formatTime(b)}`;
export const formatFormat = (teams: number, per: number) => `${per} на ${per} · ${teams} команди`;
