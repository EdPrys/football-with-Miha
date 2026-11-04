'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Users } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { PlayerAvatar } from '@/components/player-avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function Teammates() {
  const [page, setPage] = useState(0);
  const players = trpc.players.teammates.useQuery({ page });
  return (
    <section className="space-y-4" aria-labelledby="teammates-heading">
      <div>
        <h2 id="teammates-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Users className="size-5 text-primary" /> Друзі по грі
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Гравці, з якими ти вже зіграв. Додаються автоматично після завершення спільного матчу.
        </p>
      </div>
      {players.isLoading && <Skeleton className="h-32 rounded-xl" />}
      {players.isError && (
        <Card className="items-start gap-3 p-4">
          <p className="text-sm">Не вдалося завантажити гравців.</p>
          <Button variant="outline" onClick={() => players.refetch()}>
            Спробувати ще
          </Button>
        </Card>
      )}
      {players.data && !players.isError && (
        <>
          {!players.data.items.length && (
            <Card className="p-6 text-sm text-muted-foreground">
              {page === 0
                ? 'Після першої спільної гри тут з’являться твої партнери та суперники. Звідси можна відкрити їхні профілі й статистику.'
                : 'На цій сторінці гравців більше немає.'}
            </Card>
          )}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {players.data.items.map((player) => (
              <Link
                key={player.id}
                href={`/players/${player.id}`}
                className="flex min-w-0 items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/30"
              >
                <PlayerAvatar
                  name={player.name}
                  url={player.avatarUrl}
                  className="size-11 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold">{player.name}</p>
                  <p className="text-xs text-muted-foreground">{player.city.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Спільних матчів: {player.sharedMatches}
                    {player.stars.average != null && ` · ★ ${player.stars.average.toFixed(1)}`}
                  </p>
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-primary" />
              </Link>
            ))}
          </div>
        </>
      )}
      {(page > 0 || players.data?.hasMore) && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={page === 0 || players.isFetching}
            onClick={() => setPage(page - 1)}
          >
            Назад
          </Button>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            Сторінка {page + 1}
          </span>
          <Button
            variant="outline"
            disabled={!players.data?.hasMore || players.isFetching || players.isError}
            onClick={() => setPage(page + 1)}
          >
            Далі
          </Button>
        </div>
      )}
    </section>
  );
}
