'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSavedText, writeSaved, searchPreferences } from '@/lib/saved-state';
import { CitySelect } from '@/components/city-select';
import { GameSubscription } from '@/components/game-subscription';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { ArrowRight, CalendarDays, Plus, RotateCcw } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { WelcomeHero } from '@/components/welcome-hero';
import { EventCard } from '@/components/event-card';

type DateFilter = 'all' | 'today' | 'tomorrow' | 'weekend';
const FILTERS: { value: DateFilter; label: string }[] = [
  { value: 'all', label: 'Усі ігри' },
  { value: 'today', label: 'Сьогодні' },
  { value: 'tomorrow', label: 'Завтра' },
  { value: 'weekend', label: 'Вихідні' },
];

function validDateFilter(value: string | null): DateFilter {
  switch (value) {
    case 'today':
      return 'today';
    case 'tomorrow':
      return 'tomorrow';
    case 'weekend':
      return 'weekend';
    default:
      return 'all';
  }
}

function dateRange(filter: DateFilter) {
  if (filter === 'all') return {};
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  if (filter === 'tomorrow') from.setDate(from.getDate() + 1);
  if (filter === 'weekend' && from.getDay() !== 0)
    from.setDate(from.getDate() + ((6 - from.getDay() + 7) % 7));
  const to = new Date(from);
  if (filter === 'weekend' && from.getDay() === 6) to.setDate(to.getDate() + 1);
  to.setHours(23, 59, 59, 999);
  return { dateFrom: new Date(Math.max(now.getTime(), from.getTime())), dateTo: to };
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
      <DiscoverGames />
    </Suspense>
  );
}
function DiscoverGames() {
  const params = useSearchParams();
  const router = useRouter();
  const saved = useSavedText('kopanka:search');
  const defaults = searchPreferences(saved);
  const cityId = params.has('city') ? (params.get('city') ?? '') : defaults.cityId;
  const candidate = params.has('when') ? params.get('when') : defaults.filter;
  const filter = validDateFilter(candidate);
  // Keep timestamp objects stable between requests. Recompute the chosen range
  // on an explicit filter change, including a click after local midnight.
  const [ranges, setRanges] = useState(() => ({
    all: {},
    today: dateRange('today'),
    tomorrow: dateRange('tomorrow'),
    weekend: dateRange('weekend'),
  }));
  const range = ranges[filter];
  const choose = (city: string, when: DateFilter) => {
    setRanges((previous) => ({ ...previous, [when]: dateRange(when) }));
    writeSaved('kopanka:search', JSON.stringify({ cityId: city, filter: when }));
    const query = new URLSearchParams({ city, when });
    router.replace(`/?${query.toString()}#games`, { scroll: false });
  };
  const setCityId = (city: string) => choose(city, filter);
  const events = trpc.events.list.useQuery({ ...range, ...(cityId ? { cityId } : {}) });
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const guest = !me.isLoading && !me.data;
  const GamesHeading = guest ? 'h2' : 'h1';
  const chooseFilter = (value: DateFilter) => choose(cityId, value);

  return (
    <div className="space-y-8 md:space-y-10">
      {guest && <WelcomeHero />}
      <section id="games" className="scroll-mt-24 space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Виходь на поле
            </p>
            <GamesHeading className="text-[2rem] font-semibold leading-tight tracking-tight md:text-4xl">
              Знайди свою гру
            </GamesHeading>
            <p className="mt-2 text-sm text-muted-foreground">
              Обирай час, майданчик і місце в команді.
            </p>
          </div>
          <Link
            href="/events/new"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'hidden h-11 gap-2 px-4 md:inline-flex',
            )}
          >
            <Plus className="size-4" />
            Створити гру
          </Link>
        </div>
        <div className="max-w-sm space-y-2">
          <label className="text-sm font-medium" htmlFor="discover-city">
            Місто {cityId ? '' : '· усі міста'}
          </label>
          <CitySelect id="discover-city" value={cityId} onChange={setCityId} />
          {cityId && (
            <button className="text-sm text-primary" onClick={() => setCityId('')}>
              Показати всі міста
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Фільтр за датою">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => chooseFilter(f.value)}
              className={cn(
                'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                filter === f.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {events.isLoading && (
          <div
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            role="status"
            aria-label="Завантажуємо ігри"
          >
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        )}
        {events.isError && (
          <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center">
            <p className="text-lg font-semibold">Не вдалося завантажити ігри</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Перевір з’єднання та спробуй ще раз.
            </p>
            <Button
              variant="outline"
              className="mt-5 h-11 gap-2 px-4"
              onClick={() => events.refetch()}
            >
              <RotateCcw className="size-4" />
              Спробувати ще
            </Button>
          </div>
        )}
        {!events.isError && events.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center">
            <CalendarDays className="mx-auto mb-4 size-8 text-primary" />
            <h2 className="text-xl font-semibold">
              {filter === 'all' ? 'Тут почнеться наступна гра' : 'На ці дати ігор поки немає'}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              {filter === 'all'
                ? 'Організуй матч і збери гравців на полі.'
                : 'Переглянь інші дати або створи власний матч.'}
            </p>
            {cityId ? (
              <GameSubscription
                cityId={cityId}
                returnTo={`/?${new URLSearchParams({ city: cityId, when: filter }).toString()}`}
              />
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Обери місто вище, щоб підписатися на нові ігри.
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {filter !== 'all' && (
                <Button variant="outline" className="h-11 px-4" onClick={() => chooseFilter('all')}>
                  Усі ігри
                </Button>
              )}
              <Link href="/events/new" className={cn(buttonVariants(), 'h-11 gap-2 px-4')}>
                Створити гру
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        )}
        {!events.isError && !!events.data?.length && (
          <>
            <p className="text-xs text-muted-foreground" role="status">
              Знайдено ігор: {events.data.length}
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {events.data.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
