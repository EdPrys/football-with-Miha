'use client';

import { trpc } from '@/lib/trpc';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Picks one of the supported Ukrainian cities (Kyiv first). */
export function CitySelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (cityId: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const cities = trpc.cities.list.useQuery(undefined, { staleTime: Infinity });

  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Оберіть місто">
          {(id: string) => cities.data?.find((c) => c.id === id)?.name ?? 'Оберіть місто'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(cities.data ?? []).map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
