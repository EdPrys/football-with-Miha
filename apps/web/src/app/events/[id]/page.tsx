'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  formatDate,
  formatRange,
  POSITIONS,
  POSITION_LABEL,
  type PositionValue,
} from '@/lib/format';

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const ev = trpc.events.get.useQuery({ id });
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const [position, setPosition] = useState<PositionValue>('MID');

  const join = trpc.events.join.useMutation({
    onSuccess: () => {
      toast.success('Ти в грі!');
      utils.events.get.invalidate({ id });
    },
    onError: (e) => toast.error(e.message),
  });
  const leave = trpc.events.leave.useMutation({
    onSuccess: () => {
      toast('Ти вийшов з гри');
      utils.events.get.invalidate({ id });
    },
    onError: (e) => toast.error(e.message),
  });

  if (ev.isLoading) return <Skeleton className="h-72 w-full rounded-xl" />;
  if (ev.error || !ev.data) return <Card className="p-8 text-center text-sm">Гру не знайдено</Card>;

  const e = ev.data;
  const mine = me.data ? e.participants.find((p) => p.user.id === me.data!.user.id) : undefined;
  const isLoggedIn = !!me.data;
  const full = e.availableSlots <= 0;

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
          <Badge variant="secondary">{e.numberOfTeams} команди</Badge>
          <Badge variant={full ? 'secondary' : 'default'}>
            <Users className="mr-1 size-3" />
            {e.joinedCount}/{e.capacity}
          </Badge>
          <Badge variant="outline">{e.status}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Організатор: {e.organizer.name}</p>
      </Card>

      {/* Join / Leave */}
      {e.status === 'UPCOMING' && (
        <Card className="space-y-3 p-4">
          {!isLoggedIn ? (
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
              <Select value={position} onValueChange={(v) => setPosition(v as PositionValue)}>
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

      {/* Participants */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Гравці ({e.joinedCount})
        </h2>
        <div className="space-y-2">
          {e.participants.map((p) => (
            <Card key={p.id} className="flex items-center justify-between p-3">
              <span className="text-sm">{p.user.name}</span>
              <Badge variant="secondary">
                {POSITION_LABEL[p.preferredPosition as PositionValue]}
              </Badge>
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
