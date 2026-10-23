'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { clearToken } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { AvatarEditor } from '@/components/avatar-editor';
import { BecomeOrganizer } from '@/components/become-organizer';
import { SkillsEditor } from '@/components/skills-editor';
import { StarRow } from '@/components/star-row';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const ROLE_LABEL: Record<string, string> = {
  PLAYER: 'Гравець',
  MANAGER: 'Організатор',
  ADMIN: 'Адміністратор',
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
      <Card className="mx-auto max-w-md space-y-4 p-8 text-center">
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
    <div className="space-y-5 md:space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <AvatarEditor name={me.data.user.name} url={me.data.user.avatarUrl} />
            <StarRow stars={p?.stars} starClassName="size-3" />
          </div>
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">{me.data.user.name}</h1>
            <Badge variant="secondary" className="mt-1">
              {ROLE_LABEL[me.data.user.role] ?? me.data.user.role}
            </Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={logout} aria-label="Вийти">
          <LogOut className="size-5" />
        </Button>
      </div>

      {me.data.user.role === 'PLAYER' && <BecomeOrganizer />}

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start lg:gap-8">
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Матчі" value={p ? String(p.matchesPlayed) : '—'} />
            <Stat label="Відвідуваність" value={p?.attendance != null ? `${p.attendance}%` : '—'} />
            <Stat
              label={p?.stars.count ? `Рейтинг · ${p.stars.count}` : 'Рейтинг'}
              value={p?.stars.average != null ? `★ ${p.stars.average.toFixed(1)}` : '—'}
            />
          </div>

          {p && <SkillsEditor key={p.id} skills={p.skills} />}
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Історія матчів</h2>
          <div className="space-y-2">
            {(history.data ?? []).map((m) => (
              <Card
                key={m.eventId}
                className="flex flex-row items-center justify-between p-3 text-sm"
              >
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
