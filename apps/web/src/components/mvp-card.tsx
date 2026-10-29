'use client';

import { useState } from 'react';
import { Crown } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatTime } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/player-avatar';
import { cn } from '@/lib/utils';

/** MVP of a finished game: the vote for its players, then the winner(s). */
export function MvpCard({ eventId, className }: { eventId: string; className?: string }) {
  const utils = trpc.useUtils();
  const status = trpc.mvp.status.useQuery({ eventId });
  const [picked, setPicked] = useState<string | null>(null);
  const vote = trpc.mvp.vote.useMutation({
    onSuccess: async () => {
      toast.success('Голос зараховано');
      await Promise.all([utils.mvp.status.invalidate({ eventId }), utils.events.get.invalidate()]);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const s = status.data;
  if (!s || (!s.resolved && !s.open)) return null;

  const title = (
    <div className="flex items-center gap-2 text-sm font-semibold">
      <Crown className="size-4 text-amber-500" />
      MVP матчу
    </div>
  );

  if (s.resolved) {
    return (
      <Card className={cn('space-y-3 p-4', className)}>
        {title}
        {s.winners.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ніхто не проголосував — без MVP.</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {s.winners.map((w) => (
              <div key={w.userId} className="flex items-center gap-2">
                <PlayerAvatar name={w.name} url={w.avatarUrl} className="size-9" />
                <div className="text-sm">
                  <div className="font-medium">{w.name}</div>
                  <div className="text-xs text-muted-foreground">голосів: {w.votes}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }

  const deadline = s.closesAt
    ? `${formatDate(new Date(s.closesAt))}, ${formatTime(new Date(s.closesAt))}`
    : '';

  if (!s.canVote) {
    const mine = s.candidates.find((c) => c.userId === s.myVote);
    return (
      <Card className={cn('space-y-1 p-4', className)}>
        {title}
        <p className="text-sm text-muted-foreground">
          {mine ? `Твій голос: ${mine.name}. ` : 'Гравці обирають найкращого. '}
          Результат — {deadline} або коли проголосують усі.
        </p>
      </Card>
    );
  }

  return (
    <Card className={cn('space-y-3 p-4', className)}>
      {title}
      <p className="text-xs text-muted-foreground">
        Хто зіграв найкраще? Один голос, до {deadline}.
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {s.candidates.map((c) => (
          <button
            key={c.userId}
            type="button"
            onClick={() => setPicked(c.userId)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition',
              picked === c.userId
                ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
                : 'hover:bg-muted',
            )}
            aria-pressed={picked === c.userId}
          >
            <PlayerAvatar name={c.name} url={c.avatarUrl} className="size-10" />
            <span className="max-w-full truncate">{c.name}</span>
          </button>
        ))}
      </div>
      <Button
        className="w-full"
        disabled={!picked || vote.isPending}
        onClick={() => picked && vote.mutate({ eventId, nomineeId: picked })}
      >
        {vote.isPending ? '...' : 'Проголосувати'}
      </Button>
    </Card>
  );
}
