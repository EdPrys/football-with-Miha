'use client';

import { useState, type FormEvent } from 'react';
import { MapPin, CalendarDays, Users, ArrowRight } from 'lucide-react';
import { CitySelect } from '@/components/city-select';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { errorMessage } from '@/lib/errors';
import { track } from '@/lib/analytics';
import { BecomeOrganizer } from '@/components/become-organizer';
import { AddVenueDialog } from '@/components/add-venue-dialog';
import { InvitePlayers } from '@/components/invite-players';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// "2 на 2" … "11 на 11"; mirrors MIN/MAX_PLAYERS_PER_TEAM in @app/domain.
const TEAM_SIZES = Array.from({ length: 10 }, (_, i) => i + 2);

export default function NewEventPage() {
  const router = useRouter();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const venues = trpc.venues.list.useQuery();

  const [cityId, setCityId] = useState('kyiv');
  const [venueId, setVenueId] = useState('');
  const [fieldId, setFieldId] = useState('');
  // iOS shows an empty date input as a blank box, so start from today.
  const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD, local time
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState('20:00');
  const [endTime, setEndTime] = useState('22:00');
  const [numberOfTeams, setNumberOfTeams] = useState('2');
  const [playersPerTeam, setPlayersPerTeam] = useState('5');
  // Invitees belong to one city; picking a field in another city drops them.
  const [invites, setInvites] = useState<{ cityId: string; ids: string[] }>({
    cityId: '',
    ids: [],
  });

  const create = trpc.events.create.useMutation({
    onSuccess: (d) => {
      track('create_event');
      toast.success(d.invited ? `Гру створено! Запрошено гравців: ${d.invited}` : 'Гру створено!');
      router.push(`/events/${d.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const cityVenues = (venues.data ?? []).filter((v) => v.cityId === cityId);
  const venue = cityVenues.find((v) => v.id === venueId);
  const fields = venue?.fields ?? [];
  const field = fields.find((f) => f.id === fieldId);
  const cityPlayers = trpc.players.inCity.useQuery(
    { cityId },
    { enabled: !!field && !!me.data && me.data.user.role !== 'PLAYER' },
  );
  const invitedIds = field && invites.cityId === cityId ? invites.ids : [];

  const changeCity = (next: string) => {
    if (next === cityId) return;
    setCityId(next);
    setVenueId('');
    setFieldId('');
    setInvites({ cityId: next, ids: [] });
  };
  const changeVenue = (next: string) => {
    setVenueId(next);
    setFieldId('');
  };

  if (me.isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (!me.data)
    return (
      <Card className="mx-auto max-w-md space-y-4 p-8 text-center">
        <p className="text-sm text-muted-foreground">Увійди, щоб створювати ігри.</p>
        <Link href="/login" className={cn(buttonVariants(), 'w-full')}>
          Увійти
        </Link>
      </Card>
    );
  if (me.data.user.role === 'PLAYER') return <BecomeOrganizer className="mx-auto max-w-md" />;

  const submit = (e: FormEvent) => {
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    if (!field || !venue || !date) return toast.error('Обери місто, стадіон, поле і дату');
    const startAt = new Date(`${date}T${startTime}`);
    const endAt = new Date(`${date}T${endTime}`);
    if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()))
      return toast.error('Перевір дату та час');
    if (startAt <= new Date()) return toast.error('Початок гри має бути в майбутньому');
    if (endAt <= startAt) return toast.error('Кінець гри має бути пізніше початку');
    create.mutate({
      fieldId,
      startAt,
      endAt,
      numberOfTeams: Number(numberOfTeams),
      playersPerTeam: Number(playersPerTeam),
      invitedUserIds: invitedIds,
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Збери свою команду
        </p>
        <h1 className="text-[2rem] font-semibold tracking-tight md:text-4xl">Створити гру</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Обери майданчик, час і формат. Гравців можна запросити одразу.
        </p>
      </div>
      <Card className="rounded-2xl p-5 md:p-7">
        <form onSubmit={submit} className="space-y-7">
          <div className="flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold">
            <MapPin className="size-4 text-primary" />
            Місце гри
          </div>
          <div className="space-y-2">
            <Label htmlFor="game-city">Місто</Label>
            <CitySelect id="game-city" value={cityId} onChange={changeCity} className="w-full" />
          </div>
          {venues.isError ? (
            <div className="rounded-xl border border-border p-4 text-sm">
              <p>Не вдалося завантажити стадіони.</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 h-11 px-4"
                onClick={() => venues.refetch()}
              >
                Спробувати ще
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="game-venue">Стадіон / майданчик</Label>
                <Select
                  value={venueId}
                  onValueChange={(v) => changeVenue(v ?? '')}
                  disabled={venues.isLoading || !cityVenues.length}
                >
                  <SelectTrigger id="game-venue" className="h-11 min-h-11 md:h-11">
                    <SelectValue>
                      {(id: string) =>
                        cityVenues.find((v) => v.id === id)?.name ??
                        (venues.isLoading ? 'Завантажуємо…' : 'Обери стадіон')
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {cityVenues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="game-field">Поле / зал</Label>
                <Select
                  value={fieldId}
                  onValueChange={(v) => setFieldId(v ?? '')}
                  disabled={!venue || !fields.length}
                >
                  <SelectTrigger id="game-field" className="h-11 min-h-11 md:h-11">
                    <SelectValue>
                      {(id: string) => fields.find((f) => f.id === id)?.name ?? 'Обери поле'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {!venues.isLoading && !venues.isError && !cityVenues.length && (
            <p className="text-sm text-muted-foreground">
              У цьому місті ще немає стадіонів. Додай перший або обери інше місто.
            </p>
          )}
          {venue && !fields.length && (
            <p className="text-sm text-muted-foreground">
              На цьому майданчику поки немає активних полів. Додай поле, щоб створити гру.
            </p>
          )}
          {!venues.isError && (
            <AddVenueDialog
              selectedCityId={cityId}
              venues={cityVenues}
              onCreated={(nextFieldId, nextVenueId, nextCityId) => {
                if (nextCityId !== cityId) setInvites({ cityId: nextCityId, ids: [] });
                setCityId(nextCityId);
                setVenueId(nextVenueId);
                setFieldId(nextFieldId);
              }}
            />
          )}
          <div className="flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold">
            <CalendarDays className="size-4 text-primary" />
            Коли граємо
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Дата</Label>
            <Input
              className="h-11 min-h-11 md:h-11"
              id="date"
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start">Початок</Label>
              <Input
                className="h-11 min-h-11 md:h-11"
                required
                id="start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">Кінець</Label>
              <Input
                className="h-11 min-h-11 md:h-11"
                required
                id="end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold">
            <Users className="size-4 text-primary" />
            Формат гри
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="teams">Команд</Label>
              <Input
                className="h-11 min-h-11 md:h-11"
                required
                id="teams"
                type="number"
                min={2}
                value={numberOfTeams}
                onChange={(e) => setNumberOfTeams(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="game-format">Формат</Label>
              <Select value={playersPerTeam} onValueChange={(v) => v && setPlayersPerTeam(v)}>
                <SelectTrigger className="h-11 min-h-11 md:h-11" id="game-format">
                  <SelectValue>{(n: string) => `${n} на ${n}`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TEAM_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} на {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {field && (
            <div className="space-y-1.5">
              <Label>Запросити гравців</Label>
              <InvitePlayers
                players={cityPlayers.data}
                loading={cityPlayers.isLoading}
                cityName={venue?.city.name ?? ''}
                selected={invitedIds}
                onChange={(ids) => setInvites({ cityId, ids })}
              />
            </div>
          )}
          {field && (
            <p className="text-sm text-muted-foreground">
              {Number(numberOfTeams) * Number(playersPerTeam)} місць у грі · {venue?.name} ·{' '}
              {field.name}
            </p>
          )}
          {cityPlayers.isError && field && (
            <p className="text-sm text-muted-foreground">
              Не вдалося завантажити гравців для запрошення. Гру можна створити без запрошень.
            </p>
          )}
          <Button
            type="submit"
            className="h-12 w-full gap-2"
            disabled={create.isPending || !field || venues.isFetching}
          >
            {create.isPending
              ? 'Створюємо гру…'
              : invitedIds.length
                ? `Створити і запросити (${invitedIds.length})`
                : 'Створити гру'}
            {!create.isPending && <ArrowRight className="size-4" />}
          </Button>
        </form>
      </Card>
    </div>
  );
}
