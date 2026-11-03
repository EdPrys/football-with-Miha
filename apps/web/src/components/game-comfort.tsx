'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Bell, CalendarPlus, MapPin, Phone, Send } from 'lucide-react';
import type { AppRouterOutputs } from '@app/api';
import { trpc } from '@/lib/trpc';
import { errorMessage } from '@/lib/errors';
import { loginFor } from '@/lib/game-flow';
import { gameCalendar, directionsUrl } from '@/lib/calendar';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Game = AppRouterOutputs['events']['get'];

export function GameDirections({ game }: { game: Game }) {
  const venue = game.field.venue;
  return (
    <div className="space-y-2">
      {venue.address && (
        <p className="text-sm text-muted-foreground break-words">{venue.address}</p>
      )}
      <a
        href={directionsUrl(venue)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: 'outline' }), 'w-full gap-2')}
      >
        <MapPin className="size-4" />
        {venue.address || (venue.latitude != null && venue.longitude != null)
          ? 'Прокласти маршрут'
          : 'Знайти майданчик на карті'}
      </a>
    </div>
  );
}

export function OrganizerContact({ game, isOrganizer }: { game: Game; isOrganizer: boolean }) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(game.organizerPhone ?? '');
  const [telegram, setTelegram] = useState(game.organizerTelegram ?? '');
  const utils = trpc.useUtils();
  const update = trpc.events.updateContacts.useMutation({
    onSuccess: async () => {
      await utils.events.get.invalidate({ id: game.id });
      setEditing(false);
      toast.success('Контакти збережено');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card className="order-2 space-y-3 p-5">
      <h2 className="text-sm font-semibold">Зв’язатися з організатором</h2>
      <p className="text-sm">{game.organizer.name}</p>
      <div className="flex flex-wrap gap-2">
        {game.organizerPhone && (
          <a
            className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
            href={`tel:${game.organizerPhone.replace(/[^+0-9]/g, '')}`}
          >
            <Phone className="size-4" />
            Зателефонувати
          </a>
        )}
        {game.organizerTelegram && (
          <a
            className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
            href={`https://t.me/${encodeURIComponent(game.organizerTelegram)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Send className="size-4" />
            Telegram
          </a>
        )}
      </div>
      {!game.organizerPhone && !game.organizerTelegram && (
        <p className="text-sm text-muted-foreground">Організатор ще не додав контактів.</p>
      )}
      {isOrganizer && !editing && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setPhone(game.organizerPhone ?? '');
            setTelegram(game.organizerTelegram ?? '');
            setEditing(true);
          }}
        >
          Редагувати контакти
        </Button>
      )}
      {isOrganizer && editing && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            update.mutate({
              eventId: game.id,
              organizerPhone: phone.trim() || null,
              organizerTelegram: telegram.trim() || null,
            });
          }}
        >
          <p className="text-xs text-muted-foreground">
            Необов’язково. Ці контакти будуть видимі всім на сторінці цієї гри.
          </p>
          <div className="space-y-1">
            <Label htmlFor="contact-phone">Телефон</Label>
            <Input
              id="contact-phone"
              type="tel"
              maxLength={30}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="contact-telegram">Telegram username</Label>
            <Input
              id="contact-telegram"
              maxLength={33}
              placeholder="@username"
              value={telegram}
              onChange={(event) => setTelegram(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={update.isPending} type="submit">
              {update.isPending ? 'Зберігаємо…' : 'Зберегти'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={update.isPending}
              onClick={() => setEditing(false)}
            >
              Скасувати
            </Button>
          </div>
          {update.error && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(update.error)} Дані залишилися у формі — виправ їх і спробуй ще раз.
            </p>
          )}
        </form>
      )}
    </Card>
  );
}

export function CalendarDownload({ game }: { game: Game }) {
  const download = () => {
    const venue = game.field.venue;
    const content = gameCalendar({
      id: game.id,
      startAt: game.startAt,
      endAt: game.endAt,
      venue: venue.name,
      location: [venue.address, venue.city.name, venue.name, game.field.name]
        .filter(Boolean)
        .join(', '),
      instructions: game.newcomerInfo,
      url: new URL(`/events/${encodeURIComponent(game.id)}`, window.location.origin).href,
    });
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `kopanka-${game.id}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Відкрий файл у своєму календарі. Нагадування налаштовуються в календарі.');
  };
  return (
    <Button variant="outline" className="w-full gap-2" onClick={download}>
      <CalendarPlus className="size-4" />
      Додати в календар
    </Button>
  );
}

export function ReminderControl({ eventId }: { eventId: string }) {
  const utils = trpc.useUtils();
  const state = trpc.events.myState.useQuery({ eventId }, { retry: false });
  const mutation = trpc.events.setReminder.useMutation({
    onSuccess: async (data) => {
      await utils.events.myState.invalidate({ eventId });
      toast(data.enabled ? 'Нагадування ввімкнено' : 'Нагадування вимкнено');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full gap-2"
        disabled={!state.data || mutation.isPending}
        onClick={() =>
          mutation.mutate({ eventId, enabled: !state.data?.participant?.remindBeforeGame })
        }
      >
        <Bell className="size-4" />
        {mutation.isPending
          ? 'Зберігаємо…'
          : state.data?.participant?.remindBeforeGame
            ? 'Вимкнути нагадування'
            : 'Нагадати перед грою'}
      </Button>
      <p className="text-xs text-muted-foreground">
        Одне нагадування у «Сповіщеннях» Kopanka протягом години до початку, перевірка кожні 5
        хвилин. Без push та email.
      </p>
      {state.data?.participant?.reminderSentAt && (
        <p className="text-xs text-muted-foreground">
          Нагадування для цього запису на гру вже надіслано.
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          Не вдалося перевірити нагадування.{' '}
          <button className="underline" onClick={() => state.refetch()}>
            Повторити
          </button>
        </p>
      )}
    </div>
  );
}

export function WaitlistControl({
  eventId,
  loggedIn,
  full,
  open,
}: {
  eventId: string;
  loggedIn: boolean;
  full: boolean;
  open: boolean;
}) {
  const utils = trpc.useUtils();
  const state = trpc.events.myState.useQuery({ eventId }, { enabled: loggedIn, retry: false });
  const mutation = trpc.events.setWaitlist.useMutation({
    onSuccess: async (data) => {
      await utils.events.myState.invalidate({ eventId });
      toast(data.waiting ? 'Ти в листі очікування' : 'Ти вийшов з листа очікування');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if ((!full || !open) && !state.data?.waiting) return null;
  return (
    <Card className="order-4 space-y-3 p-4">
      <h2 className="text-sm font-semibold">
        {state.data?.waiting ? 'Ти в листі очікування' : 'Місць поки немає'}
      </h2>
      <p className="text-sm text-muted-foreground">
        Коли звільниться місце, повідомимо у Kopanka всіх, хто очікує. Місце не бронюється —
        потрібно відкрити гру й записатися.
      </p>
      {!full && open && state.data?.waiting && (
        <p className="text-sm font-medium text-primary">
          З’явилися місця! Обери позицію на полі, щоб записатися.
        </p>
      )}
      {!open && state.data?.waiting && (
        <p className="text-sm text-muted-foreground">Запис на цю гру вже закритий.</p>
      )}
      {loggedIn ? (
        <Button
          className="w-full"
          variant="outline"
          disabled={!state.data || mutation.isPending}
          onClick={() => mutation.mutate({ eventId, waiting: !state.data?.waiting })}
        >
          {mutation.isPending
            ? 'Зберігаємо…'
            : state.data?.waiting
              ? 'Вийти з листа очікування'
              : 'Сповістити про вільне місце'}
        </Button>
      ) : (
        <Link
          href={loginFor(`/events/${eventId}`, true)}
          className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
        >
          Увійти до листа очікування
        </Link>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          Не вдалося перевірити лист очікування.{' '}
          <button className="underline" onClick={() => state.refetch()}>
            Повторити
          </button>
        </p>
      )}
    </Card>
  );
}
