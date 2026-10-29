'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { errorMessage } from '@/lib/errors';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StarRating } from '@/components/star-rating';
import { PlayerAvatar } from '@/components/player-avatar';
import { cn } from '@/lib/utils';
import { formatDate, formatTime } from '@/lib/format';

export default function RatePage() {
  const { id } = useParams<{ id: string }>();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const targets = trpc.ratings.rateableTargets.useQuery({ eventId: id }, { enabled: !!me.data });
  const [skipped, setSkipped] = useState<string[]>([]);

  if (me.isLoading || targets.isLoading) return <Skeleton className="h-72 w-full rounded-xl" />;

  if (!me.data)
    return (
      <Card className="mx-auto max-w-md space-y-4 p-8 text-center">
        <p className="text-sm text-muted-foreground">Увійди, щоб оцінювати гравців.</p>
        <Link href="/login" className={cn(buttonVariants(), 'w-full')}>
          Увійти
        </Link>
      </Card>
    );

  const closesAt = targets.data?.closesAt ? new Date(targets.data.closesAt) : null;
  const list = targets.data?.targets ?? [];

  if (list.length === 0)
    return (
      <Card className="mx-auto max-w-md space-y-4 p-8 text-center">
        <p className="text-sm">
          {closesAt && new Date() > closesAt
            ? 'Оцінювати можна було протягом доби після гри — час минув.'
            : 'Готово! Дякуємо, що оцінив гравців.'}
        </p>
        <Link
          href={`/events/${id}`}
          className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
        >
          До гри
        </Link>
      </Card>
    );

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Оцінити гравців</h1>
        <p className="text-sm text-muted-foreground">
          Постав зірки тим, кого хочеш оцінити. Без зірок — без оцінки.
          {closesAt && ` Можна до ${formatDate(closesAt)}, ${formatTime(closesAt)}.`}
        </p>
      </div>
      <RatingList eventId={id} players={list} />
    </div>
  );
}

function RatingList({
  eventId,
  players,
}: {
  eventId: string;
  players: { userId: string; name: string; avatarUrl: string | null }[];
}) {
  const utils = trpc.useUtils();
  // 0 stars = not rated; tapping the current star again clears it back to 0.
  const [stars, setStars] = useState<Record<string, number>>({});
  const rated = players.filter((p) => (stars[p.userId] ?? 0) > 0).length;
  const submit = trpc.ratings.submit.useMutation({
    onSuccess: ({ saved }) => {
      toast.success(`Збережено оцінок: ${saved}`);
      utils.ratings.rateableTargets.invalidate({ eventId });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card className="space-y-1 p-2">
      {players.map((p) => {
        const value = stars[p.userId] ?? 0;
        return (
          <div key={p.userId} className="flex items-center gap-3 rounded-lg p-2">
            <PlayerAvatar name={p.name} url={p.avatarUrl} className="size-10 shrink-0" />
            <p className="min-w-0 flex-1 truncate font-medium">{p.name}</p>
            <StarRating
              value={value}
              onChange={(v) => setStars((s) => ({ ...s, [p.userId]: v === value ? 0 : v }))}
              className="gap-0.5"
              starClassName="size-6"
            />
          </div>
        );
      })}
      <div className="p-2 pt-3">
        <Button
          className="w-full"
          disabled={submit.isPending || rated === 0}
          onClick={() =>
            submit.mutate({
              eventId,
              ratings: players.map((p) => ({ rateeId: p.userId, stars: stars[p.userId] ?? 0 })),
            })
          }
        >
          {submit.isPending
            ? '...'
            : rated === 0
              ? 'Постав комусь зірки'
              : `Зберегти оцінки (${rated})`}
        </Button>
      </div>
    </Card>
  );
}
