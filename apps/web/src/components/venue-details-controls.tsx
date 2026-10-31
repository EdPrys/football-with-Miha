'use client';

import type { AppRouterOutputs } from '@app/api';
import { Label } from '@/components/ui/label';

type VenueDetails = AppRouterOutputs['venues']['get'];
type FieldDetails = VenueDetails['fields'][number];
export type Environment = NonNullable<FieldDetails['environment']>;
export type Surface = NonNullable<FieldDetails['surface']>;

export const environmentLabels: Record<Environment, string> = {
  OPEN_AIR: 'Відкрите поле',
  COVERED: 'Під накриттям',
  INDOOR: 'У приміщенні',
};
export const surfaceLabels: Record<Surface, string> = {
  NATURAL_GRASS: 'Натуральна трава',
  ARTIFICIAL_TURF: 'Штучний газон',
  PARQUET: 'Паркет',
  RUBBER: 'Гума',
  HARD_COURT: 'Тверде покриття',
  OTHER: 'Інше покриття',
};
export function OptionalSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Record<string, string>;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
      >
        <option value="">Невідомо</option>
        {Object.entries(options).map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
export const booleanOptions = { yes: 'Так', no: 'Ні' };
export const optionalBoolean = (value: string) => (value === '' ? undefined : value === 'yes');

export function externalHttpUrl(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
