'use client';

import Link from 'next/link';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatRange } from '@/lib/format';

export default function DiscoverPage() {
  const { data, isLoading } = trpc.events.list.useQuery({});

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Знайти гру</h1>
        <p className="text-sm text-muted-foreground">Найближчі матчі поруч</p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {data && data.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Поки що немає ігор. Створи першу!
        </Card>
      )}

      <div className="space-y-3">
        {data?.map((e) => (
          <Link key={e.id} href={`/events/${e.id}`} className="block">
            <Card className="p-4 transition-colors hover:border-primary/50">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <CalendarDays className="size-4 text-primary" />
                    {formatDate(e.startAt)} · {formatRange(e.startAt, e.endAt)}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-4" />
                    {e.venue}, {e.city} · {e.field}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {e.playersPerTeam} на {e.playersPerTeam}
                  </div>
                </div>
                <Badge
                  variant={e.availableSlots > 0 ? 'default' : 'secondary'}
                  className="shrink-0"
                >
                  <Users className="mr-1 size-3" />
                  {e.availableSlots > 0 ? `${e.availableSlots} вільно` : 'Повна'}
                </Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
