'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MapPin, CalendarDays, Users } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  environmentLabels,
  surfaceLabels,
  externalHttpUrl,
} from '@/components/venue-details-controls';
import { formatDate, formatRange } from '@/lib/format';

export default function VenuePage() {
  const { id } = useParams<{ id: string }>();
  const v = trpc.venues.get.useQuery({ id });

  if (v.isLoading) return <Skeleton className="h-72 w-full rounded-xl" />;
  if (v.error || !v.data)
    return <Card className="p-8 text-center text-sm">Стадіон не знайдено</Card>;

  const venue = v.data;
  const websiteUrl = externalHttpUrl(venue.websiteUrl);
  const sourceUrl = externalHttpUrl(venue.sourceUrl);

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start lg:gap-8 lg:space-y-0">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{venue.name}</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4" />
            {venue.city}
          </p>
        </div>

        {(venue.address ||
          venue.contactPhone ||
          websiteUrl ||
          (venue.latitude != null && venue.longitude != null) ||
          venue.totalFields != null ||
          venue.hasChangingRooms != null ||
          venue.hasShowers != null ||
          venue.hasParking != null ||
          sourceUrl ||
          venue.verifiedAt) && (
          <Card className="space-y-3 p-5">
            {venue.address && <p className="text-sm">{venue.address}</p>}
            {venue.contactPhone && (
              <a
                className="block text-sm text-primary underline underline-offset-4"
                href={`tel:${venue.contactPhone}`}
              >
                {venue.contactPhone}
              </a>
            )}
            {websiteUrl && (
              <a
                className="block break-all text-sm text-primary underline underline-offset-4"
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Вебсайт майданчика ↗
              </a>
            )}
            {venue.latitude != null && venue.longitude != null && (
              <a
                className="block text-sm text-primary underline underline-offset-4"
                href={`https://www.google.com/maps?q=${venue.latitude},${venue.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Відкрити на карті ↗
              </a>
            )}
            {venue.totalFields != null && (
              <p className="text-sm">Полів на території: {venue.totalFields}</p>
            )}
            {(
              [
                ['hasChangingRooms', 'Роздягальні'],
                ['hasShowers', 'Душові'],
                ['hasParking', 'Паркування'],
              ] as const
            ).map(
              ([key, label]) =>
                venue[key] != null && (
                  <p key={key} className="text-sm">
                    {label}: {venue[key] ? 'є' : 'немає'}
                  </p>
                ),
            )}
            {(sourceUrl || venue.verifiedAt) && (
              <div className="border-t border-border pt-3 text-xs text-muted-foreground">
                {sourceUrl && (
                  <a
                    className="text-primary underline underline-offset-4"
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Джерело відомостей ↗
                  </a>
                )}
                {venue.verifiedAt && (
                  <p className="mt-1">
                    Дані переглянуто: {new Date(venue.verifiedAt).toLocaleDateString('uk-UA')}
                  </p>
                )}
              </div>
            )}
          </Card>
        )}
        <div>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
            Поля ({venue.fields.length})
          </h2>
          <div className="space-y-3">
            {venue.fields.map((f) => (
              <Card key={f.id} className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium">{f.name}</h3>
                  {!f.isActive && <Badge variant="outline">Неактивне</Badge>}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {f.capacity != null && <Badge variant="secondary">{f.capacity} гравців</Badge>}
                  {f.environment && (
                    <Badge variant="secondary">{environmentLabels[f.environment]}</Badge>
                  )}
                  {f.surface && <Badge variant="secondary">{surfaceLabels[f.surface]}</Badge>}
                  {f.hasLighting != null && (
                    <span>Освітлення: {f.hasLighting ? 'є' : 'немає'}</span>
                  )}
                  {f.lengthMeters != null && f.widthMeters != null ? (
                    <span>
                      {f.lengthMeters} × {f.widthMeters} м
                    </span>
                  ) : (
                    <>
                      {f.lengthMeters != null && <span>Довжина: {f.lengthMeters} м</span>}
                      {f.widthMeters != null && <span>Ширина: {f.widthMeters} м</span>}
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Найближчі ігри</h2>
        {venue.events.length === 0 && (
          <p className="text-sm text-muted-foreground">Поки без запланованих ігор.</p>
        )}
        <div className="grid gap-2 md:grid-cols-2">
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
