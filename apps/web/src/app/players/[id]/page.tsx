'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { PlayerAvatar } from '@/components/player-avatar';
import { StarRow } from '@/components/star-row';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, POSITION_LABEL } from '@/lib/format';

const SKILL_LABEL: Record<string, string> = {
  PACE: 'Швидкість',
  DRIBBLING: 'Дриблінг',
  PASSING: 'Пас',
  SHOOTING: 'Удар',
  DEFENDING: 'Захист',
  PHYSICAL: 'Фізика',
};

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const profile = trpc.players.profile.useQuery({ userId: id }, { retry: false });
  const history = trpc.players.matchHistory.useQuery({ userId: id }, { enabled: !!profile.data });
  const p = profile.data;
  return (
    <div className="space-y-6">
      <Link
        href="/profile"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> До мого профілю
      </Link>
      {profile.isLoading && <Skeleton className="h-64 rounded-2xl" />}
      {profile.isError && (
        <Card className="items-start gap-3 p-6">
          <h1 className="text-xl font-semibold">
            {profile.error.data?.code === 'NOT_FOUND'
              ? 'Гравця не знайдено'
              : 'Не вдалося завантажити профіль'}
          </h1>
          <Button variant="outline" onClick={() => profile.refetch()}>
            Спробувати ще
          </Button>
        </Card>
      )}
      {p && !profile.isError && (
        <>
          <div className="flex items-center gap-4">
            <div className="shrink-0 space-y-2">
              <PlayerAvatar
                name={p.name}
                url={p.avatarUrl}
                mvpCount={p.mvpCount}
                className="size-16"
              />
              <StarRow stars={p.stars} starClassName="size-3" />
            </div>
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-bold md:text-3xl">{p.name}</h1>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-4" />
                {p.city.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Оцінок від гравців: {p.stars.count}
              </p>
            </div>
          </div>
          {p.bio && (
            <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{p.bio}</p>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Матчі', p.matchesPlayed],
              ['Явка', p.attendance == null ? '—' : `${p.attendance}%`],
              ['Рейтинг', p.stars.average == null ? '—' : `★ ${p.stars.average.toFixed(1)}`],
              ['MVP', p.mvpCount],
            ].map(([label, value]) => (
              <Card key={label} className="gap-1 p-4 text-center">
                <p className="text-2xl font-bold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </Card>
            ))}
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Card className="gap-4 p-5">
              <div>
                <h2 className="font-semibold">Навички</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Самооцінка гравця · від 1 до 100
                </p>
              </div>
              {!p.skills.some((s) => s.value > 0) && (
                <p className="text-sm text-muted-foreground">Гравець ще не заповнив навички.</p>
              )}
              {p.skills
                .filter((s) => s.value > 0)
                .map((s) => (
                  <div key={s.skill} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span>{SKILL_LABEL[s.skill] ?? s.skill}</span>
                      <span>{Math.round(s.value)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, Math.max(0, s.value))}%` }}
                      />
                    </div>
                  </div>
                ))}
            </Card>
            <section className="space-y-3">
              <h2 className="font-semibold">Зіграні матчі</h2>
              {history.isLoading && <Skeleton className="h-32 rounded-xl" />}
              {history.isError && (
                <div className="space-y-2">
                  <p className="text-sm">Не вдалося завантажити матчі.</p>
                  <Button variant="outline" onClick={() => history.refetch()}>
                    Спробувати ще
                  </Button>
                </div>
              )}
              {history.data && !history.isError && history.data.length === 0 && (
                <p className="text-sm text-muted-foreground">Ще немає зіграних матчів.</p>
              )}
              {!history.isError &&
                history.data?.map((m) => (
                  <Link
                    key={m.eventId}
                    href={`/events/${m.eventId}`}
                    className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary/50"
                  >
                    <p className="text-sm font-medium">{formatDate(m.date)}</p>
                    <p className="mt-1 break-words text-sm text-muted-foreground">
                      {m.venue} · {m.field}
                    </p>
                    <p className="mt-2 text-xs text-primary">
                      {m.team ? `${m.team} · ` : ''}
                      {POSITION_LABEL[m.position]}
                    </p>
                  </Link>
                ))}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
