'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MapPin, CalendarDays, Users } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatRange } from '@/lib/format';

export default function VenuePage() {
  const { id } = useParams<{ id: string }>();
  const v = trpc.venues.get.useQuery({ id });

  if (v.isLoading) return <Skeleton className="h-72 w-full rounded-xl" />;
  if (v.error || !v.data)
    return <Card className="p-8 text-center text-sm">Стадіон не знайдено</Card>;

  const venue = v.data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{venue.name}</h1>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4" />
          {venue.city}
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Поля ({venue.fields.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          {venue.fields.map((f) => (
            <Badge key={f.id} variant={f.isActive ? 'secondary' : 'outline'}>
              {f.name} · до {f.capacity}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Найближчі ігри</h2>
        {venue.events.length === 0 && (
          <p className="text-sm text-muted-foreground">Поки без запланованих ігор.</p>
        )}
        <div className="space-y-2">
          {venue.events.map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className="block">
              <Card className="flex flex-row items-center justify-between p-3 transition-colors hover:border-primary/50">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <CalendarDays className="size-4 text-primary" />
                    {formatDate(e.startAt)} · {formatRange(e.startAt, e.endAt)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {e.field} · {e.playersPerTeam} на {e.playersPerTeam}
                  </div>
                </div>
                <Badge variant={e.availableSlots > 0 ? 'default' : 'secondary'}>
                  <Users className="mr-1 size-3" />
                  {e.availableSlots > 0 ? `${e.availableSlots} вільно` : 'Повна'}
                </Badge>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
