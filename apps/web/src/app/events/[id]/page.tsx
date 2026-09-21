'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CalendarDays, MapPin, Users, Star } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { PitchLineup } from '@/components/pitch-lineup';
import { PlayerAvatar } from '@/components/player-avatar';
import { formationFor } from '@/lib/formation';
import { formatDate, formatRange, POSITION_LABEL, type PositionValue } from '@/lib/format';

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const ev = trpc.events.get.useQuery({ id });
  const me = trpc.auth.me.useQuery(undefined, { retry: false });

  const refresh = () => utils.events.get.invalidate({ id });
  const onErr = (e: { message: string }) => toast.error(e.message);

  const join = trpc.events.join.useMutation({
    onSuccess: () => {
      toast.success('Ти в грі!');
      refresh();
    },
    onError: onErr,
  });
  const leave = trpc.events.leave.useMutation({
    onSuccess: () => {
      toast('Ти вийшов з гри');
      refresh();
    },
    onError: onErr,
  });
  const start = trpc.events.start.useMutation({
    onSuccess: () => {
      toast.success('Гру розпочато');
      refresh();
    },
    onError: onErr,
  });
  const finish = trpc.events.finish.useMutation({
    onSuccess: () => {
      toast.success('Гру завершено');
      refresh();
    },
    onError: onErr,
  });
  const cancel = trpc.events.cancel.useMutation({
    onSuccess: () => {
      toast('Гру скасовано');
      refresh();
    },
    onError: onErr,
  });
  const assign = trpc.events.assignTeam.useMutation({ onSuccess: refresh, onError: onErr });

  if (ev.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (ev.error || !ev.data) return <Card className="p-8 text-center text-sm">Гру не знайдено</Card>;

  const e = ev.data;
  const userId = me.data?.user.id;
  const mine = userId ? e.participants.find((p) => p.user.id === userId) : undefined;
  const isOrganizer = !!userId && e.organizer.id === userId;
  const full = e.availableSlots <= 0;
  const canRate = e.status === 'FINISHED' && mine?.status === 'ATTENDED';
  const canJoin = e.status === 'UPCOMING' && !mine && !full;

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CalendarDays className="size-4 text-primary" />
          {formatDate(e.startAt)} · {formatRange(e.startAt, e.endAt)}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="size-4" />
          <Link href={`/venues/${e.field.venue.id}`} className="underline-offset-2 hover:underline">
            {e.field.venue.name}
          </Link>
          , {e.field.venue.city} · {e.field.name}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {e.playersPerTeam} на {e.playersPerTeam}
          </Badge>
          <Badge variant={full ? 'secondary' : 'default'}>
            <Users className="mr-1 size-3" />
            {e.joinedCount}/{e.capacity}
          </Badge>
          <Badge variant="outline">{e.status}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Організатор: {e.organizer.name}</p>
      </Card>

      {canRate && (
        <Link href={`/events/${e.id}/rate`} className={cn(buttonVariants(), 'w-full')}>
          <Star className="mr-1 size-4" /> Оцінити гравців
        </Link>
      )}

      {/* Pitch — tap a "+" on a line to join at that position */}
      <PitchLineup
        participants={e.participants}
        teams={e.teams}
        formation={formationFor(e.playersPerTeam)}
        numberOfTeams={e.numberOfTeams}
        meId={userId}
        canJoin={canJoin}
        isLoggedIn={!!me.data}
        joinPending={join.isPending}
        onJoin={(position) => join.mutate({ eventId: e.id, position })}
      />

      {mine && e.status === 'UPCOMING' && (
        <Button
          variant="outline"
          className="w-full"
          disabled={leave.isPending}
          onClick={() => leave.mutate({ eventId: e.id })}
        >
          Вийти з гри ({POSITION_LABEL[mine.preferredPosition as PositionValue]})
        </Button>
      )}

      {/* Organizer lifecycle controls */}
      {isOrganizer && e.status !== 'FINISHED' && e.status !== 'CANCELLED' && (
        <Card className="space-y-3 p-4">
          <p className="text-sm font-semibold text-muted-foreground">Керування (організатор)</p>
          <div className="flex gap-2">
            {e.status === 'UPCOMING' && (
              <Button
                className="flex-1"
                disabled={start.isPending}
                onClick={() => start.mutate({ eventId: e.id })}
              >
                Почати
              </Button>
            )}
            {e.status === 'IN_PROGRESS' && (
              <Button
                className="flex-1"
                disabled={finish.isPending}
                onClick={() => finish.mutate({ eventId: e.id })}
              >
                Завершити
              </Button>
            )}
            <Button
              variant="outline"
              className="flex-1"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate({ eventId: e.id })}
            >
              Скасувати
            </Button>
          </div>
        </Card>
      )}

      {/* Organizer team assignment */}
      {isOrganizer && e.status !== 'CANCELLED' && e.participants.length > 0 && (
        <Card className="space-y-2 p-4">
          <p className="text-sm font-semibold text-muted-foreground">Команди</p>
          {e.participants.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PlayerAvatar name={p.user.name} url={p.user.avatarUrl} className="size-7" />
                <span className="text-sm">{p.user.name}</span>
              </div>
              <Select
                value={p.teamId ?? ''}
                onValueChange={(v) =>
                  assign.mutate({ eventId: e.id, userId: p.user.id, teamId: v || null })
                }
              >
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue placeholder="Команда" />
                </SelectTrigger>
                <SelectContent>
                  {e.teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
