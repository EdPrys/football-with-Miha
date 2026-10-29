'use client';

import { useMemo, useState, type FormEvent } from 'react';
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

  const fields = useMemo(
    () =>
      (venues.data ?? []).flatMap((v) =>
        v.fields.map((f) => ({ ...f, venue: v.name, cityId: v.cityId, city: v.city.name })),
      ),
    [venues.data],
  );

  const field = fields.find((f) => f.id === fieldId);
  const cityPlayers = trpc.players.inCity.useQuery(
    { cityId: field?.cityId ?? '' },
    { enabled: !!field && me.data?.user.role !== 'PLAYER' },
  );
  const invitedIds = field && invites.cityId === field.cityId ? invites.ids : [];

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
    e.preventDefault();
    if (!fieldId || !date) return toast.error('Оберіть поле і дату');
    const startAt = new Date(`${date}T${startTime}`);
    const endAt = new Date(`${date}T${endTime}`);
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
    <div className="mx-auto w-full max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Створити гру</h1>
      <Card className="p-5">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Де граємо</Label>
            <Select value={fieldId} onValueChange={(v) => setFieldId(v ?? '')}>
              <SelectTrigger className={cn(!fieldId && 'border-primary/60')}>
                <SelectValue placeholder="Оберіть стадіон і поле">
                  {(id: string) => {
                    const f = fields.find((x) => x.id === id);
                    // Base UI calls this even with no value, hiding the placeholder.
                    return f ? `${f.venue} · ${f.name}` : 'Оберіть стадіон і поле';
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {fields.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.venue} · {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AddVenueDialog venues={venues.data ?? []} onCreated={setFieldId} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Дата</Label>
            <Input
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
                id="start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">Кінець</Label>
              <Input
                id="end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="teams">Команд</Label>
              <Input
                id="teams"
                type="number"
                min={2}
                value={numberOfTeams}
                onChange={(e) => setNumberOfTeams(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Формат</Label>
              <Select value={playersPerTeam} onValueChange={(v) => v && setPlayersPerTeam(v)}>
                <SelectTrigger>
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
                cityName={field.city}
                selected={invitedIds}
                onChange={(ids) => setInvites({ cityId: field.cityId, ids })}
              />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending
              ? '...'
              : invitedIds.length
                ? `Створити і запросити (${invitedIds.length})`
                : 'Створити'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
