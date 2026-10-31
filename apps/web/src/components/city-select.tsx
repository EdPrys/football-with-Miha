'use client';

import { Combobox } from '@base-ui/react/combobox';
import { Check, ChevronDown } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

type City = { id: string; name: string };

/** Search matches any part of a supported city's name, without case sensitivity. */
export function CitySelect({
  value,
  onChange,
  disabled,
  className,
  id,
}: {
  value: string;
  onChange: (cityId: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const cities = trpc.cities.list.useQuery(undefined, { staleTime: Infinity });
  const selected = cities.data?.find((city) => city.id === value) ?? null;

  return (
    <div className={cn('min-w-0', className)}>
      <Combobox.Root
        items={cities.data ?? []}
        value={selected}
        onValueChange={(city: City | null) => city && onChange(city.id)}
        itemToStringLabel={(city: City) => city.name}
        isItemEqualToValue={(a: City, b: City) => a.id === b.id}
        filter={(city: City, query: string) =>
          city.name.toLocaleLowerCase('uk-UA').includes(query.trim().toLocaleLowerCase('uk-UA'))
        }
        disabled={disabled || cities.isLoading || cities.isError}
        autoHighlight
      >
        <div className="relative">
          <Combobox.Input
            id={id}
            aria-label="Місто"
            placeholder={cities.isLoading ? 'Завантажуємо міста…' : 'Знайти місто'}
            className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 pr-10 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:text-sm"
          />
          <Combobox.Trigger
            aria-label="Показати міста"
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ChevronDown className="size-4" />
          </Combobox.Trigger>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={6} className="z-60">
            <Combobox.Popup className="max-h-72 w-(--anchor-width) min-w-48 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl outline-none">
              <Combobox.Empty className="px-3 py-5 text-center text-sm text-muted-foreground">
                Місто не знайдено
              </Combobox.Empty>
              <Combobox.List>
                {(city: City) => (
                  <Combobox.Item
                    key={city.id}
                    value={city}
                    className="flex min-h-11 cursor-default items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    {city.name}
                    <Combobox.ItemIndicator>
                      <Check className="size-4" />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      {cities.isError && (
        <p className="mt-1 text-xs text-destructive">
          Не вдалося завантажити міста.{' '}
          <button type="button" className="underline" onClick={() => cities.refetch()}>
            Спробувати ще
          </button>
        </p>
      )}
    </div>
  );
}
