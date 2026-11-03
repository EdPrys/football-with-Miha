'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { errorMessage } from '@/lib/errors';
import { loginFor } from '@/lib/game-flow';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function GameSubscription({ cityId, returnTo }: { cityId: string; returnTo: string }) {
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const subscriptions = trpc.notifications.gameSubscriptions.useQuery(undefined, {
    enabled: !!me.data,
  });
  const setSubscription = trpc.notifications.subscribeCity.useMutation({
    onSuccess: async (data) => {
      await utils.notifications.gameSubscriptions.invalidate();
      toast.success(
        data.subscribed ? 'Повідомимо про нові ігри в цьому місті' : 'Підписку скасовано',
      );
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const subscribed = subscriptions.data?.some((item) => item.cityId === cityId) ?? false;
  return (
    <div className="mx-auto mt-5 max-w-sm space-y-2">
      <p className="text-sm text-muted-foreground">Сповіщати про нові ігри у вибраному місті?</p>
      {me.isLoading ? (
        <p className="text-sm" role="status">
          Перевіряємо підписку…
        </p>
      ) : !me.data ? (
        <Link
          href={loginFor(returnTo, true)}
          className={cn(buttonVariants({ variant: 'outline' }), 'h-11 gap-2')}
        >
          <Bell className="size-4" />
          Увійти та налаштувати
        </Link>
      ) : (
        <Button
          variant="outline"
          className="h-11 gap-2"
          disabled={subscriptions.isLoading || subscriptions.isError || setSubscription.isPending}
          onClick={() => setSubscription.mutate({ cityId, subscribed: !subscribed })}
        >
          <Bell className="size-4" />
          {setSubscription.isPending
            ? 'Зберігаємо…'
            : subscribed
              ? 'Скасувати підписку'
              : 'Сповістити мене'}
        </Button>
      )}
      {subscriptions.isError && (
        <p className="text-sm text-destructive">
          Не вдалося перевірити підписку.{' '}
          <button className="underline" onClick={() => subscriptions.refetch()}>
            Повторити
          </button>
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        У розділі «Сповіщення» Kopanka. Для всіх дат у цьому місті; без email та push. Керувати
        підписками можна у сповіщеннях.
      </p>
    </div>
  );
}
