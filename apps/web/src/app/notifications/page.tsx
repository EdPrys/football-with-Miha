'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Bell, Check, X, Mail, XCircle, Star } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDate, formatTime } from '@/lib/format';

type Payload = Record<string, unknown>;
const str = (p: Payload, key: string) => (typeof p[key] === 'string' ? (p[key] as string) : '');

const ICON: Record<string, typeof Mail> = {
  INVITATION_RECEIVED: Mail,
  INVITATION_ACCEPTED: Check,
  EVENT_CANCELLED: XCircle,
  RATING_AVAILABLE: Star,
};

export default function NotificationsPage() {
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const list = trpc.notifications.mine.useQuery(undefined, { enabled: !!me.data });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.mine.invalidate(),
  });
  const respond = trpc.invitations.respond.useMutation({
    onSuccess: (_d, vars) => {
      toast.success(vars.accept ? 'Ти прийняв запрошення!' : 'Запрошення відхилено');
      utils.notifications.mine.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (list.data && list.data.unreadCount > 0) markAllRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data?.unreadCount]);

  if (me.isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (!me.data)
    return (
      <Card className="space-y-4 p-8 text-center">
        <p className="text-sm text-muted-foreground">Увійди, щоб бачити сповіщення.</p>
        <Link href="/login" className={cn(buttonVariants(), 'w-full')}>
          Увійти
        </Link>
      </Card>
    );

  const notifications = list.data?.notifications ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Сповіщення</h1>
      {list.isLoading && <Skeleton className="h-24 w-full rounded-xl" />}
      {list.data && notifications.length === 0 && (
        <Card className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
          <Bell className="size-6 text-muted-foreground/50" />
          Поки що нічого немає
        </Card>
      )}

      <div className="space-y-3">
        {notifications.map((n) => {
          const p = (n.payload ?? {}) as Payload;
          const Icon = ICON[n.type] ?? Bell;
          const eventId = str(p, 'eventId');
          const eventStartAt = str(p, 'eventStartAt');

          return (
            <Card key={n.id} className="space-y-2 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  {n.type === 'INVITATION_RECEIVED' && (
                    <p className="text-sm">
                      <span className="font-medium">{str(p, 'inviterName') || 'Хтось'}</span>{' '}
                      запросив(ла) тебе на гру
                    </p>
                  )}
                  {n.type === 'INVITATION_ACCEPTED' && (
                    <p className="text-sm">
                      <span className="font-medium">{str(p, 'invitedUserName') || 'Гравець'}</span>{' '}
                      прийняв(ла) твоє запрошення
                    </p>
                  )}
                  {n.type === 'EVENT_CANCELLED' && <p className="text-sm">Гру скасовано</p>}
                  {n.type === 'RATING_AVAILABLE' && (
                    <p className="text-sm">Гру завершено — постав оцінки гравцям</p>
                  )}
                  {eventStartAt && (
                    <p className="text-xs text-muted-foreground">
                      {formatDate(new Date(eventStartAt))} · {formatTime(new Date(eventStartAt))}
                    </p>
                  )}

                  {n.type === 'INVITATION_RECEIVED' &&
                    (n.invitationStatus === 'PENDING' ? (
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          disabled={respond.isPending}
                          onClick={() =>
                            respond.mutate({ invitationId: str(p, 'invitationId'), accept: true })
                          }
                        >
                          <Check className="mr-1 size-3.5" /> Прийняти
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={respond.isPending}
                          onClick={() =>
                            respond.mutate({ invitationId: str(p, 'invitationId'), accept: false })
                          }
                        >
                          <X className="mr-1 size-3.5" /> Відхилити
                        </Button>
                      </div>
                    ) : (
                      <p className="pt-1 text-xs text-muted-foreground">
                        {n.invitationStatus === 'ACCEPTED' ? 'Ти прийняв(ла)' : 'Ти відхилив(ла)'}
                      </p>
                    ))}
                  {n.type !== 'INVITATION_RECEIVED' && eventId && (
                    <Link href={`/events/${eventId}`} className="text-xs text-primary">
                      Переглянути гру
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
