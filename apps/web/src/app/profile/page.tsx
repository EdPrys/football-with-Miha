'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { clearToken } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const SKILL_LABEL: Record<string, string> = {
  PACE: 'Швидкість',
  DRIBBLING: 'Дриблінг',
  PASSING: 'Пас',
  SHOOTING: 'Удар',
  DEFENDING: 'Захист',
  PHYSICAL: 'Фізика',
};

export default function ProfilePage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const profile = trpc.players.profile.useQuery(
    { userId: me.data?.user.id ?? '' },
    { enabled: !!me.data },
  );
  const history = trpc.players.matchHistory.useQuery(
    { userId: me.data?.user.id ?? '' },
    { enabled: !!me.data },
  );

  if (me.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  if (me.error || !me.data) {
    return (
      <Card className="space-y-4 p-8 text-center">
        <p className="text-sm text-muted-foreground">Увійди, щоб побачити свій профіль.</p>
        <Link href="/login" className={cn(buttonVariants(), 'w-full')}>
          Увійти
        </Link>
      </Card>
    );
  }

  const p = profile.data;
  const logout = async () => {
    clearToken();
    await utils.invalidate();
    router.push('/login');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{me.data.user.name}</h1>
          <Badge variant="secondary" className="mt-1">
            {me.data.user.role}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={logout} aria-label="Вийти">
          <LogOut className="size-5" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Матчі" value={p ? String(p.matchesPlayed) : '—'} />
        <Stat label="Відвідуваність" value={p?.attendance != null ? `${p.attendance}%` : '—'} />
        <Stat label="Оцінок" value={p ? String(p.totalRatings) : '—'} />
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Навички</h2>
        <div className="space-y-3">
          {(p?.skills ?? []).map((s) => (
            <div key={s.skill} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{SKILL_LABEL[s.skill] ?? s.skill}</span>
                <span className="font-medium tabular-nums">{s.value.toFixed(1)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(s.value / 5) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Історія матчів</h2>
        <div className="space-y-2">
          {(history.data ?? []).map((m) => (
            <Card key={m.eventId} className="flex items-center justify-between p-3 text-sm">
              <div>
                <div>{formatDate(m.date)}</div>
                <div className="text-xs text-muted-foreground">
                  {m.venue} · {m.field}
                </div>
              </div>
              <Badge variant="secondary">{m.team ?? m.position}</Badge>
            </Card>
          ))}
          {history.data && history.data.length === 0 && (
            <p className="text-sm text-muted-foreground">Ще немає зіграних матчів.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 text-center">
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}
