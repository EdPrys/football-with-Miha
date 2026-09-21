'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
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
      <RatingForm key={current.userId} eventId={id} userId={current.userId} name={current.name} />
    </div>
  );
}

function RatingForm({ eventId, userId, name }: { eventId: string; userId: string; name: string }) {
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
      <p className="text-lg font-semibold">{name}</p>
      <div className="space-y-4">
        {SKILLS.map(([key, label]) => (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{label}</span>
              <span className="font-medium tabular-nums text-primary">{scores[key]}</span>
            </div>
            <Slider
              min={1}
              max={5}
              step={1}
              value={[scores[key]]}
              onValueChange={(v) =>
                setScores((s) => ({ ...s, [key]: Array.isArray(v) ? v[0] : v }))
              }
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
