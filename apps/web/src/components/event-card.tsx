import Link from 'next/link';
import { ArrowUpRight, MapPin, Users } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/format';

export type DiscoverEvent = {
  id: string;
  startAt: Date;
  endAt: Date;
  venue: string;
  city: string;
  field: string;
  playersPerTeam: number;
  numberOfTeams: number;
  joinedCount: number;
  capacity: number;
  availableSlots: number;
  canAddTeam: boolean;
};

function dayLabel(date: Date) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if (key(new Date(date)) === key(today)) return 'Сьогодні';
  if (key(new Date(date)) === key(tomorrow)) return 'Завтра';
  return formatDate(date);
}

export function EventCard({ event: e }: { event: DiscoverEvent }) {
  const open = e.availableSlots > 0 || e.canAddTeam;
  const fill = e.capacity > 0 ? Math.min(100, (e.joinedCount / e.capacity) * 100) : 0;
  return (
    <Link
      href={`/events/${e.id}`}
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 text-card-foreground transition duration-200 hover:border-primary/60 motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {dayLabel(e.startAt)}
          </p>
          <p className="mt-1 text-[2rem] font-semibold leading-tight tracking-tight tabular-nums">
            {formatTime(e.startAt)}
          </p>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            до {formatTime(e.endAt)}
          </p>
        </div>
        <span className="rounded-lg bg-secondary px-2.5 py-1.5 text-sm font-semibold tabular-nums">
          {e.playersPerTeam} × {e.playersPerTeam}
        </span>
      </div>
      <div className="my-5 min-w-0 flex-1">
        <h3 className="break-words text-lg font-semibold leading-snug">{e.venue}</h3>
        <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">
            {e.city} · {e.field}
          </span>
        </p>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="size-3.5" />
            {e.joinedCount} із {e.capacity} гравців
          </span>
          <span className={open ? 'font-medium text-primary' : 'text-muted-foreground'}>
            {e.availableSlots > 0
              ? `${e.availableSlots} вільно`
              : e.canAddTeam
                ? 'Можна додати команду'
                : 'Місць немає'}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
          <div className="h-full rounded-full bg-primary" style={{ width: `${fill}%` }} />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm font-semibold">
          <span>Переглянути гру</span>
          <ArrowUpRight className="size-4 text-primary transition-transform motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
