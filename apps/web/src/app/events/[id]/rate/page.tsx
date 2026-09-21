'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StarRating } from '@/components/star-rating';
import { PlayerAvatar } from '@/components/player-avatar';
import { cn } from '@/lib/utils';

const SKILLS = [
  ['pace', 'Швидкість'],
  ['dribbling', 'Дриблінг'],
  ['passing', 'Пас'],
  ['shooting', 'Удар'],
  ['defending', 'Захист'],
  ['physical', 'Фізика'],
] as const;

type Scores = Record<(typeof SKILLS)[number][0], number>;
const DEFAULTS: Scores = {
  pace: 3,
  dribbling: 3,
  passing: 3,
  shooting: 3,
  defending: 3,
  physical: 3,
};

export default function RatePage() {
  const { id } = useParams<{ id: string }>();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const targets = trpc.ratings.rateableTargets.useQuery({ eventId: id }, { enabled: !!me.data });

  if (me.isLoading || targets.isLoading) return <Skeleton className="h-72 w-full rounded-xl" />;

  if (!me.data)
    return (
      <Card className="space-y-4 p-8 text-center">
        <p className="text-sm text-muted-foreground">Увійди, щоб оцінювати гравців.</p>
        <Link href="/login" className={cn(buttonVariants(), 'w-full')}>
          Увійти
        </Link>
      </Card>
    );

  const list = targets.data ?? [];
  const current = list[0];

  if (!current)
    return (
      <Card className="space-y-4 p-8 text-center">
        <p className="text-sm">🎉 Ти оцінив усіх, з ким грав. Дякуємо!</p>
        <Link
          href={`/events/${id}`}
          className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
        >
          До гри
        </Link>
      </Card>
    );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Оцінити гравців</h1>
        <p className="text-sm text-muted-foreground">Залишилось: {list.length}</p>
      </div>
      <RatingForm
        key={current.userId}
        eventId={id}
        userId={current.userId}
        name={current.name}
        avatarUrl={current.avatarUrl}
      />
    </div>
  );
}

function RatingForm({
  eventId,
  userId,
  name,
  avatarUrl,
}: {
  eventId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
}) {
  const utils = trpc.useUtils();
  const [scores, setScores] = useState<Scores>(DEFAULTS);
  const submit = trpc.ratings.submit.useMutation({
    onSuccess: () => {
      toast.success(`Оцінку для ${name} збережено`);
      utils.ratings.rateableTargets.invalidate({ eventId });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-center gap-3">
        <PlayerAvatar name={name} url={avatarUrl} className="size-11" />
        <p className="text-lg font-semibold">{name}</p>
      </div>
      <div className="space-y-4">
        {SKILLS.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <span className="text-sm">{label}</span>
            <StarRating
              value={scores[key]}
              onChange={(v) => setScores((s) => ({ ...s, [key]: v }))}
            />
          </div>
        ))}
      </div>
      <Button
        className="w-full"
        disabled={submit.isPending}
        onClick={() => submit.mutate({ eventId, rateeId: userId, scores })}
      >
        {submit.isPending ? '...' : 'Зберегти оцінку'}
      </Button>
    </Card>
  );
}
