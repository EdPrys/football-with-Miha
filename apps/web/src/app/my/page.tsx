'use client';

import Link from 'next/link';
import { CalendarDays, MapPin } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDate, formatRange } from '@/lib/format';

const STATUS_LABEL: Record<string, string> = {
  UPCOMING: 'Незабаром',
  IN_PROGRESS: 'Триває',
  FINISHED: 'Завершено',
  CANCELLED: 'Скасовано',
};

export default function MyGamesPage() {
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const mine = trpc.events.mine.useQuery(undefined, { enabled: !!me.data });

  if (me.isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (!me.data)
    return (
      <Card className="space-y-4 p-8 text-center">
        <p className="text-sm text-muted-foreground">Увійди, щоб бачити свої ігри.</p>
        <Link href="/login" className={cn(buttonVariants(), 'w-full')}>
          Увійти
        </Link>
      </Card>
    );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Мої ігри</h1>
      {mine.isLoading && <Skeleton className="h-28 w-full rounded-xl" />}
      {mine.data && mine.data.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Ти ще не в жодній грі.{' '}
          <Link href="/" className="text-primary">
            Знайти
          </Link>
        </Card>
      )}
      <div className="space-y-3">
        {mine.data?.map((e) => (
          <Link key={e.id} href={`/events/${e.id}`} className="block">
            <Card className="space-y-2 p-4 transition-colors hover:border-primary/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <CalendarDays className="size-4 text-primary" />
                  {formatDate(e.startAt)} · {formatRange(e.startAt, e.endAt)}
                </div>
                <Badge variant={e.status === 'UPCOMING' ? 'default' : 'secondary'}>
                  {STATUS_LABEL[e.status] ?? e.status}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" />
                {e.venue} · {e.field}
              </div>
              {e.isOrganizer && (
                <Badge variant="outline" className="text-xs">
                  Ти організатор
                </Badge>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
