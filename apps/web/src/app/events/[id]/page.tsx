'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CalendarDays, MapPin, Users, Star, Scale, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { errorMessage } from '@/lib/errors';
import { track } from '@/lib/analytics';
import {
  GameDirections,
  OrganizerContact,
  CalendarDownload,
  ReminderControl,
  WaitlistControl,
} from '@/components/game-comfort';
import { ShareGame } from '@/components/share-game';
import { loginFor, participationPrice, GAME_LEVEL_LABEL } from '@/lib/game-flow';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { PitchLineup } from '@/components/pitch-lineup';
import { MvpCard } from '@/components/mvp-card';
import { PlayerAvatar } from '@/components/player-avatar';
import { InviteDialog } from '@/components/invite-dialog';
import {
  EVENT_STATUS_LABEL,
  formatDate,
  formatRange,
  POSITION_LABEL,
  type PositionValue,
} from '@/lib/format';

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ev = trpc.events.get.useQuery({ id }, { refetchInterval: 30_000 });
  const me = trpc.auth.me.useQuery(undefined, { retry: false });

  const refresh = () =>
    Promise.all([
      utils.events.get.invalidate({ id }),
      utils.events.myState.invalidate({ eventId: id }),
      utils.events.list.invalidate(),
      utils.events.mine.invalidate(),
    ]);
  const onErr = (e: unknown) => {
    toast.error(errorMessage(e));
    // The server may have completed a mutation even if the response was lost.
    // Reconcile participation before the player tries again.
    void refresh();
  };

  const join = trpc.events.join.useMutation({
    onSuccess: () => {
      track('join_event');
      toast.success('Ти в грі!');
      refresh();
    },
    onError: onErr,
  });
  const leave = trpc.events.leave.useMutation({
    onSuccess: () => {
      setConfirmLeave(false);
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
  const balance = trpc.events.balanceTeams.useMutation({
    onSuccess: () => {
      toast.success('Команди збалансовано за зірками');
      refresh();
    },
    onError: onErr,
  });
  const remove = trpc.events.delete.useMutation({
    onSuccess: async () => {
      toast('Гру видалено');
      await Promise.all([utils.events.list.invalidate(), utils.events.mine.invalidate()]);
      router.push('/my');
    },
    onError: onErr,
  });
  if (ev.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (!ev.data)
    return (
      <Card className="space-y-4 p-8 text-center text-sm" role="alert">
        <p>
          {ev.error?.data?.code === 'NOT_FOUND'
            ? 'Гру не знайдено або її видалено'
            : 'Не вдалося завантажити гру. Перевір з’єднання й спробуй ще раз.'}
        </p>
        <Button variant="outline" onClick={() => ev.refetch()}>
          Спробувати ще
        </Button>
        <Link href="/" className="block text-primary">
          Переглянути інші ігри
        </Link>
      </Card>
    );

  const e = ev.data;
  const userId = me.data?.user.id;
  const mine = userId ? e.participants.find((p) => p.user.id === userId) : undefined;
  const isOrganizer = !!userId && e.organizer.id === userId;
  const full = e.availableSlots <= 0;
  const ratingOpen = !!e.ratingClosesAt && new Date() <= new Date(e.ratingClosesAt);
  const canRate = e.status === 'FINISHED' && mine?.status === 'ATTENDED' && ratingOpen;
  const open = e.status === 'UPCOMING' && +new Date(e.startAt) > now;
  const canJoin = open && !mine && !full;
  const canLeave = open && +new Date(e.startAt) >= now + 60 * 60_000;
  // Mirrors inviteToEvent: the organizer or anyone already in the game can invite.
  const canInvite = e.status === 'UPCOMING' && (isOrganizer || !!mine);
  // Every slot is taken: the next player can open another team (up to 4).
  const canOpenTeam = open && e.canAddTeam && !mine;
  const canDelete = isOrganizer && e.joinedCount === 0 && e.status !== 'FINISHED';

  // Mobile: one column in the original order (aside is `display: contents`, so its
  // children flow into the outer flex and `order-*` interleaves them with the pitch).
  // Desktop: details/controls in a sticky left column, the pitch on the right.
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
      {ev.isError && (
        <Card className="order-1 space-y-2 p-4 lg:col-span-2" role="alert">
          <p className="text-sm">Не вдалося оновити гру. Показані останні отримані дані.</p>
          <Button variant="outline" onClick={() => ev.refetch()}>
            Оновити
          </Button>
        </Card>
      )}
      <aside className="contents lg:sticky lg:top-24 lg:flex lg:flex-col lg:gap-4">
        <Card className="order-1 space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="size-4 text-primary" />
            {formatDate(e.startAt)} · {formatRange(e.startAt, e.endAt)}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" />
            <span>
              <Link
                href={`/venues/${e.field.venue.id}`}
                className="underline-offset-2 hover:underline"
              >
                {e.field.venue.name}
              </Link>
              , {e.field.venue.city.name} · {e.field.name}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {e.playersPerTeam} на {e.playersPerTeam}
            </Badge>
            <Badge variant={full ? 'secondary' : 'default'}>
              <Users className="mr-1 size-3" />
              {e.joinedCount}/{e.capacity}
            </Badge>
            <Badge variant="outline">{EVENT_STATUS_LABEL[e.status] ?? e.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Організатор: {e.organizer.name}</p>
          <GameDirections game={e} />
        </Card>

        <Card className="order-2 space-y-3 p-5">
          <h2 className="text-sm font-semibold">Перед грою</h2>
          <p className="text-sm font-medium">{participationPrice(e.priceMinor)}</p>
          <p className="text-sm text-muted-foreground">
            Рівень: {e.level ? GAME_LEVEL_LABEL[e.level] : 'уточнюється'}
          </p>
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {e.newcomerInfo ||
              'Організатор ще не додав інструкцій. Уточни місце зустрічі, взуття та умови участі перед грою.'}
          </p>
          {e.priceMinor != null && e.priceMinor > 0 && (
            <p className="text-xs text-muted-foreground">
              Умови оплати узгоджуються з організатором. Оплати через Kopanka немає.
            </p>
          )}
        </Card>
        <OrganizerContact key={e.id} game={e} isOrganizer={isOrganizer} />
        {mine && (e.status === 'UPCOMING' || e.status === 'IN_PROGRESS') && (
          <Card className="order-2 space-y-3 border-primary/50 p-5" role="status">
            <h2 className="text-lg font-semibold text-primary">
              {e.status === 'IN_PROGRESS' ? 'Гра розпочалася — ти в складі' : 'Ти записаний на гру'}
            </h2>
            <p className="text-sm">
              {formatDate(e.startAt)} · {formatRange(e.startAt, e.endAt)}
            </p>
            <p className="text-sm">
              {e.teams.find((team) => team.id === mine.teamId)?.name ?? 'Команда ще не обрана'} ·{' '}
              {POSITION_LABEL[mine.preferredPosition as PositionValue]}
            </p>
            {open && (
              <>
                <CalendarDownload game={e} />
                <ReminderControl eventId={e.id} />
              </>
            )}
            {e.status === 'UPCOMING' && (
              <p className="text-xs text-muted-foreground">
                Вийти з гри можна щонайменше за годину до початку. Пізніше зв’яжися з організатором.
              </p>
            )}
          </Card>
        )}
        {!mine && <WaitlistControl eventId={e.id} loggedIn={!!me.data} full={full} open={open} />}
        <ShareGame eventId={e.id} venue={e.field.venue.name} />
        {isOrganizer && (
          <Link
            href={`/events/new?repeat=${encodeURIComponent(e.id)}`}
            className={cn(buttonVariants({ variant: 'outline' }), 'order-6 w-full')}
          >
            Повторити наступного тижня
          </Link>
        )}

        {e.status === 'FINISHED' && <MvpCard eventId={e.id} className="order-2" />}

        {canRate && (
          <Link href={`/events/${e.id}/rate`} className={cn(buttonVariants(), 'order-2 w-full')}>
            <Star className="mr-1 size-4" /> Оцінити гравців
          </Link>
        )}

        {e.participants.some((p) => !p.teamId) && (
          <Card className="order-4 space-y-2 p-3">
            <p className="text-xs font-medium text-muted-foreground">Очікують команду</p>
            <div className="flex flex-wrap gap-3">
              {e.participants
                .filter((p) => !p.teamId)
                .map((p) => (
                  <div key={p.id} className="flex w-16 flex-col items-center gap-1">
                    <PlayerAvatar name={p.user.name} url={p.user.avatarUrl} className="size-10" />
                    <span className="max-w-16 truncate text-[11px]">{p.user.name}</span>
                  </div>
                ))}
            </div>
          </Card>
        )}

        {canOpenTeam && (
          <Card className="order-4 space-y-3 p-4">
            <div>
              <p className="text-sm font-semibold">Усі команди заповнені</p>
              <p className="text-xs text-muted-foreground">
                Відкрий {e.teams.length + 1}-у команду і стань у ній першим — решта гравців зможуть
                доєднатися до тебе.
              </p>
            </div>
            {me.data ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={join.isPending}
                  onClick={() => join.mutate({ eventId: e.id, position: 'GK', newTeam: true })}
                >
                  <Plus className="mr-1 size-4" /> Воротар
                </Button>
                <Button
                  className="flex-1"
                  disabled={join.isPending}
                  onClick={() => join.mutate({ eventId: e.id, position: 'MID', newTeam: true })}
                >
                  <Plus className="mr-1 size-4" /> Польовий
                </Button>
              </div>
            ) : (
              <Link
                href={loginFor(`/events/${e.id}`, true)}
                className={cn(buttonVariants(), 'w-full')}
              >
                Зареєструватись і грати
              </Link>
            )}
          </Card>
        )}

        {canInvite && (
          <InviteDialog
            eventId={e.id}
            cityName={e.field.venue.city.name}
            className="order-5 w-full"
          />
        )}

        {mine && e.status === 'UPCOMING' && (
          <div className="order-5 space-y-2">
            <Button
              variant={confirmLeave ? 'destructive' : 'outline'}
              className="w-full"
              disabled={leave.isPending || !canLeave}
              onClick={() =>
                confirmLeave ? leave.mutate({ eventId: e.id }) : setConfirmLeave(true)
              }
            >
              {leave.isPending
                ? 'Виходимо…'
                : confirmLeave
                  ? 'Підтвердити вихід із гри'
                  : `Вийти з гри (${POSITION_LABEL[mine.preferredPosition as PositionValue]})`}
            </Button>
            {confirmLeave && (
              <Button
                variant="ghost"
                className="w-full"
                disabled={leave.isPending}
                onClick={() => setConfirmLeave(false)}
              >
                Залишитися в грі
              </Button>
            )}
            {!canLeave && (
              <p className="text-xs text-muted-foreground">
                До початку менше години або час гри вже настав. Зв’яжися з організатором, якщо не
                зможеш прийти.
              </p>
            )}
          </div>
        )}

        {/* Organizer lifecycle controls */}
        {isOrganizer && e.status !== 'FINISHED' && e.status !== 'CANCELLED' && (
          <Card className="order-6 space-y-3 p-4">
            <p className="text-sm font-semibold text-muted-foreground">Керування (організатор)</p>
            {e.status === 'UPCOMING' && e.joinedCount >= 2 && (
              <Button
                variant="secondary"
                className="w-full"
                disabled={balance.isPending}
                onClick={() => balance.mutate({ eventId: e.id })}
              >
                <Scale className="mr-1 size-4" /> Збалансувати команди за зірками
              </Button>
            )}
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

        {/* Only an empty game can go away entirely (e.g. created by mistake). */}
        {canDelete && (
          <Button
            variant={confirmDelete ? 'destructive' : 'ghost'}
            className="order-6 w-full"
            disabled={remove.isPending}
            onClick={() =>
              confirmDelete ? remove.mutate({ eventId: e.id }) : setConfirmDelete(true)
            }
          >
            <Trash2 className="mr-1 size-4" />
            {confirmDelete ? 'Точно видалити? Натисни ще раз' : 'Видалити гру'}
          </Button>
        )}
      </aside>

      {/* Pitch — tap a "+" on a line to join at that position */}
      <section className="order-3 min-w-0">
        <PitchLineup
          participants={e.participants}
          teams={e.teams}
          playersPerTeam={e.playersPerTeam}
          meId={userId}
          canJoinBase={canJoin}
          isLoggedIn={!!me.data}
          loginHref={loginFor(`/events/${e.id}`, true)}
          joinPending={join.isPending}
          onJoin={(position, teamId) => join.mutate({ eventId: e.id, position, teamId })}
        />
      </section>
    </div>
  );
}
