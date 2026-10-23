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
  // Rating is optional: skipped players simply drop out of this session's queue.
  const list = (targets.data?.targets ?? []).filter((t) => !skipped.includes(t.userId));
  const current = list[0];

  if (!current)
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
          Залишилось: {list.length}
          {closesAt && ` · можна до ${formatDate(closesAt)}, ${formatTime(closesAt)}`}
        </p>
      </div>
      <RatingForm
        key={current.userId}
        eventId={id}
        userId={current.userId}
        name={current.name}
        avatarUrl={current.avatarUrl}
        onSkip={() => setSkipped((s) => [...s, current.userId])}
      />
    </div>
  );
}

function RatingForm({
  eventId,
  userId,
  name,
  avatarUrl,
  onSkip,
}: {
  eventId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  onSkip: () => void;
}) {
  const utils = trpc.useUtils();
  const [stars, setStars] = useState(0);
  const submit = trpc.ratings.submit.useMutation({
    onSuccess: () => {
      toast.success(`Оцінку для ${name} збережено`);
      utils.ratings.rateableTargets.invalidate({ eventId });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <PlayerAvatar name={name} url={avatarUrl} className="size-16" />
        <p className="text-lg font-semibold">{name}</p>
        <p className="text-sm text-muted-foreground">Як зіграв цей гравець?</p>
      </div>
      <div className="flex justify-center">
        <StarRating value={stars} onChange={setStars} />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" disabled={submit.isPending} onClick={onSkip}>
          Пропустити
        </Button>
        <Button
          className="flex-1"
          disabled={submit.isPending || stars === 0}
          onClick={() => submit.mutate({ eventId, rateeId: userId, stars })}
        >
          {submit.isPending ? '...' : 'Оцінити'}
        </Button>
      </div>
    </Card>
  );
}
