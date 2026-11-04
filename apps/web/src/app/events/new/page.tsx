'use client';

import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { MapPin, CalendarDays, Users, ArrowRight } from 'lucide-react';
import { CitySelect } from '@/components/city-select';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import type { AppRouterOutputs } from '@app/api';
import { useSavedText, writeSaved, gameDraft, type GameDraft } from '@/lib/saved-state';
import { loginFor, nextWeeklyDates, GAME_LEVEL_LABEL } from '@/lib/game-flow';
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

type Template = AppRouterOutputs['events']['repeatTemplate'];
export default function NewEventPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
      <NewEventLoader />
    </Suspense>
  );
}
function NewEventLoader() {
  const params = useSearchParams();
  const sourceId = params.get('repeat');
  const [revision, setRevision] = useState(0);
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const draftKey = `kopanka:game-draft:${me.data?.user.id ?? 'guest'}:${sourceId ?? 'new'}`;
  const saved = useSavedText(draftKey);

  const source = trpc.events.repeatTemplate.useQuery(
    { eventId: sourceId ?? '' },
    { enabled: !!sourceId && !!me.data, retry: false },
  );
  if (me.isLoading || saved === null) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (sourceId && !me.data)
    return (
      <Card className="space-y-4 p-6 text-center">
        <p>Увійди, щоб повторити свою гру.</p>
        <Link
          href={loginFor(`/events/new?repeat=${encodeURIComponent(sourceId)}`)}
          className={buttonVariants()}
        >
          Увійти
        </Link>
      </Card>
    );
  if (sourceId && source.isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (sourceId && (source.isError || !source.data))
    return (
      <Card className="space-y-4 p-6">
        <p>
          Не вдалося завантажити гру для повторення. Повторювати гру може її організатор з роллю
          організатора.
        </p>
        <Link href="/events/new" className={buttonVariants({ variant: 'outline' })}>
          Створити нову гру
        </Link>
      </Card>
    );
  return (
    <NewEventForm
      key={`${draftKey}:${revision}`}
      template={source.data}
      draftKey={draftKey}
      initialDraft={gameDraft(saved)}
      onDiscard={() => {
        writeSaved(draftKey, null);
        setRevision((value) => value + 1);
      }}
    />
  );
}
function NewEventForm({
  template,
  draftKey,
  initialDraft,
  onDiscard,
}: {
  template?: Template;
  draftKey: string;
  initialDraft: GameDraft;
  onDiscard: () => void;
}) {
  const router = useRouter();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const venues = trpc.venues.list.useQuery();

  const draft = template ? nextWeeklyDates(template.startAt, template.endAt) : undefined;
  const [cityId, setCityId] = useState(initialDraft.cityId ?? template?.cityId ?? 'kyiv');
  const [venueId, setVenueId] = useState(initialDraft.venueId ?? template?.venueId ?? '');
  const [fieldId, setFieldId] = useState(initialDraft.fieldId ?? template?.fieldId ?? '');
  // iOS shows an empty date input as a blank box, so start from today.
  const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD, local time
  const [date, setDate] = useState(
    initialDraft.date ?? draft?.startAt.toLocaleDateString('sv-SE') ?? today,
  );
  const [endDate, setEndDate] = useState(
    initialDraft.endDate ?? draft?.endAt.toLocaleDateString('sv-SE') ?? today,
  );
  const [startTime, setStartTime] = useState(
    initialDraft.startTime ??
      (draft
        ? `${String(draft.startAt.getHours()).padStart(2, '0')}:${String(draft.startAt.getMinutes()).padStart(2, '0')}`
        : '20:00'),
  );
  const [endTime, setEndTime] = useState(
    initialDraft.endTime ??
      (draft
        ? `${String(draft.endAt.getHours()).padStart(2, '0')}:${String(draft.endAt.getMinutes()).padStart(2, '0')}`
        : '22:00'),
  );
  const [numberOfTeams, setNumberOfTeams] = useState(
    initialDraft.numberOfTeams ?? String(template?.numberOfTeams ?? 2),
  );
  const [playersPerTeam, setPlayersPerTeam] = useState(
    initialDraft.playersPerTeam ?? String(template?.playersPerTeam ?? 5),
  );
  const [price, setPrice] = useState(
    initialDraft.price ?? (template?.priceMinor == null ? '' : String(template.priceMinor / 100)),
  );
  const [paymentRequired, setPaymentRequired] = useState(
    initialDraft.paymentRequired ?? Number(price.replace(',', '.')) > 0,
  );
  const [level, setLevel] = useState<NonNullable<Template['level']> | ''>(
    (initialDraft.level === '' || Object.hasOwn(GAME_LEVEL_LABEL, initialDraft.level ?? '')
      ? initialDraft.level
      : (template?.level ?? '')) as NonNullable<Template['level']> | '',
  );
  const [newcomerInfo, setNewcomerInfo] = useState(
    initialDraft.newcomerInfo ?? template?.newcomerInfo ?? '',
  );
  const [organizerPhone, setOrganizerPhone] = useState(
    initialDraft.organizerPhone ?? template?.organizerPhone ?? '',
  );
  const [organizerTelegram, setOrganizerTelegram] = useState(
    initialDraft.organizerTelegram ?? template?.organizerTelegram ?? '',
  );
  const [restored] = useState(Object.keys(initialDraft).length > 0);
  const completed = useRef(false);
  useEffect(() => {
    if (!completed.current && me.data && me.data.user.role !== 'PLAYER') {
      writeSaved(
        draftKey,
        JSON.stringify({
          cityId,
          venueId,
          fieldId,
          date,
          endDate,
          startTime,
          endTime,
          numberOfTeams,
          playersPerTeam,
          price,
          paymentRequired,
          level,
          newcomerInfo,
          organizerPhone,
          organizerTelegram,
        }),
      );
    }
  }, [
    draftKey,
    me.data,
    cityId,
    venueId,
    fieldId,
    date,
    endDate,
    startTime,
    endTime,
    numberOfTeams,
    playersPerTeam,
    price,
    paymentRequired,
    level,
    newcomerInfo,
    organizerPhone,
    organizerTelegram,
  ]);
  // Invitees belong to one city; picking a field in another city drops them.
  const [invites, setInvites] = useState<{ cityId: string; ids: string[] }>({
    cityId: '',
    ids: [],
  });

  const create = trpc.events.create.useMutation({
    onSuccess: (d) => {
      completed.current = true;
      writeSaved(draftKey, null);
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
        <Link href={loginFor('/events/new')} className={cn(buttonVariants(), 'w-full')}>
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
    const endAt = new Date(`${endDate}T${endTime}`);
    if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()))
      return toast.error('Перевір дату та час');
    if (startAt <= new Date()) return toast.error('Початок гри має бути в майбутньому');
    if (endAt <= startAt) return toast.error('Кінець гри має бути пізніше початку');
    if (paymentRequired && price.trim() === '')
      return toast.error('Вкажи вартість участі в гривнях');
    const amount = paymentRequired ? Number(price.replace(',', '.')) : 0;
    if (
      !Number.isFinite(amount) ||
      (paymentRequired && amount <= 0) ||
      amount > 1_000_000 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001
    )
      return toast.error('Вкажи суму від 0,01 до 1 000 000 грн, до двох знаків після коми');
    create.mutate({
      fieldId,
      startAt,
      endAt,
      numberOfTeams: Number(numberOfTeams),
      playersPerTeam: Number(playersPerTeam),
      invitedUserIds: invitedIds,
      priceMinor: Math.round(amount * 100),
      level: level || null,
      newcomerInfo: newcomerInfo.trim() || null,
      organizerPhone: organizerPhone.trim() || null,
      organizerTelegram: organizerTelegram.trim() || null,
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Збери свою команду
        </p>
        <h1 className="text-[2rem] font-semibold tracking-tight md:text-4xl">
          {template ? 'Повторити гру' : 'Створити гру'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {template
            ? 'Перевір дату й умови. Буде створена окрема гра без учасників, старих запрошень та результатів.'
            : 'Обери майданчик, час і формат. Гравців можна запросити одразу.'}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        {restored
          ? 'Чернетку відновлено. Перевір дату та умови перед створенням.'
          : 'Дані форми зберігаються в цьому браузері, якщо доступне локальне сховище.'}{' '}
        Вибір гравців для запрошення потрібно підтвердити заново після перезавантаження.
      </p>
      {restored && (
        <Button
          type="button"
          variant="outline"
          disabled={create.isPending}
          onClick={() => {
            completed.current = true;
            onDiscard();
          }}
        >
          Очистити чернетку
        </Button>
      )}
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
              onChange={(e) => {
                setDate(e.target.value);
                setEndDate(e.target.value);
              }}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end-date">Дата завершення</Label>
            <Input
              id="end-date"
              type="date"
              min={date}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="h-11 min-h-11"
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
          <div className="space-y-4 border-t border-border pt-5">
            <h2 className="text-sm font-semibold">Умови для гравців</h2>
            <div className="space-y-3">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-input px-3 py-2 text-sm font-medium">
                <input
                  id="game-payment-required"
                  type="checkbox"
                  checked={paymentRequired}
                  onChange={(e) => setPaymentRequired(e.target.checked)}
                  aria-controls={paymentRequired ? 'game-price-fields' : undefined}
                  className="size-5 shrink-0 accent-primary"
                />
                Потрібна оплата за гру
              </label>
              {paymentRequired ? (
                <div id="game-price-fields" className="space-y-1.5">
                  <Label htmlFor="game-price">Сума з одного гравця, грн</Label>
                  <Input
                    id="game-price"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    max="1000000"
                    step="0.01"
                    required
                    placeholder="Наприклад, 150"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    aria-describedby="game-payment-info"
                  />
                  <p id="game-payment-info" className="text-xs text-muted-foreground">
                    Оплата узгоджується з організатором поза Kopanka.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Участь у грі безкоштовна.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="game-level">Рівень гри</Label>
              <select
                id="game-level"
                value={level}
                onChange={(e) => setLevel(e.target.value as typeof level)}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">Уточнюється</option>
                {Object.entries(GAME_LEVEL_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="organizer-phone">Телефон організатора (необов’язково)</Label>
              <Input
                id="organizer-phone"
                type="tel"
                value={organizerPhone}
                maxLength={30}
                onChange={(e) => setOrganizerPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="organizer-telegram">Telegram організатора (необов’язково)</Label>
              <Input
                id="organizer-telegram"
                placeholder="@username"
                value={organizerTelegram}
                maxLength={33}
                onChange={(e) => setOrganizerTelegram(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Телефон і Telegram будуть публічно доступні на сторінці цієї гри.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newcomer-info">Що знати перед першою грою</Label>
              <textarea
                id="newcomer-info"
                value={newcomerInfo}
                onChange={(e) => setNewcomerInfo(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="Де зустрічаємось, яке взуття взяти, як зв’язатися з організатором…"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Цей текст видно всім. Додавай лише контакти, які готовий оприлюднити.
              </p>
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
          {create.error && (
            <div role="alert" className="rounded-xl border border-destructive p-3 text-sm">
              <p>{errorMessage(create.error)}</p>
              <p className="mt-1 text-muted-foreground">
                Дані залишилися у формі. Перевір помилку й натисни «Створити гру» ще раз.
              </p>
            </div>
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
