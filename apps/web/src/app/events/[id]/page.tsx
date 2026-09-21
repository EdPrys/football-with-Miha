'use client';

import { useState } from 'react';
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
import {
  formatDate,
  formatRange,
  POSITIONS,
  POSITION_LABEL,
  type PositionValue,
} from '@/lib/format';

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const ev = trpc.events.get.useQuery({ id });
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const [position, setPosition] = useState<PositionValue>('MID');

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

  if (ev.isLoading) return <Skeleton className="h-72 w-full rounded-xl" />;
  if (ev.error || !ev.data) return <Card className="p-8 text-center text-sm">Гру не знайдено</Card>;

  const e = ev.data;
  const userId = me.data?.user.id;
  const mine = userId ? e.participants.find((p) => p.user.id === userId) : undefined;
  const isOrganizer = !!userId && e.organizer.id === userId;
  const full = e.availableSlots <= 0;
  const canRate = e.status === 'FINISHED' && mine?.status === 'ATTENDED';

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CalendarDays className="size-4 text-primary" />
          {formatDate(e.startAt)} · {formatRange(e.startAt, e.endAt)}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="size-4" />
          {e.field.venue.name}, {e.field.venue.city} · {e.field.name}
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

      {/* Rating CTA */}
      {canRate && (
        <Link href={`/events/${e.id}/rate`} className={cn(buttonVariants(), 'w-full')}>
          <Star className="mr-1 size-4" /> Оцінити гравців
        </Link>
      )}

      {/* Join / Leave */}
      {e.status === 'UPCOMING' && (
        <Card className="space-y-3 p-4">
          {!me.data ? (
            <Link href="/login" className={cn(buttonVariants(), 'w-full')}>
              Увійти, щоб приєднатися
            </Link>
          ) : mine ? (
            <div className="space-y-3">
              <p className="text-sm">
                Ти в грі як{' '}
                <span className="font-medium">
                  {POSITION_LABEL[mine.preferredPosition as PositionValue]}
                </span>
              </p>
              <Button
                variant="outline"
                className="w-full"
                disabled={leave.isPending}
                onClick={() => leave.mutate({ eventId: e.id })}
              >
                Вийти з гри
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Select
                value={position}
                onValueChange={(v) => setPosition((v ?? 'MID') as PositionValue)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {POSITION_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="flex-1"
                disabled={full || join.isPending}
                onClick={() => join.mutate({ eventId: e.id, position })}
              >
                {full ? 'Повна' : 'Приєднатися'}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Organizer controls */}
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

      {/* Participants (+ team assignment for organizer) */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Гравці ({e.joinedCount})
        </h2>
        <div className="space-y-2">
          {e.participants.map((p) => (
            <Card key={p.id} className="flex items-center justify-between gap-2 p-3">
              <span className="text-sm">{p.user.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {POSITION_LABEL[p.preferredPosition as PositionValue]}
                </Badge>
                {isOrganizer && e.status !== 'CANCELLED' ? (
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
                ) : (
                  p.teamId && (
                    <Badge variant="outline" className="text-xs">
                      {e.teams.find((t) => t.id === p.teamId)?.name}
                    </Badge>
                  )
                )}
              </div>
            </Card>
          ))}
          {e.participants.length === 0 && (
            <p className="text-sm text-muted-foreground">Ще ніхто не приєднався.</p>
          )}
        </div>
      </div>
    </div>
  );
}
