'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function RequireAdmin({ children }: { children: ReactNode }) {
  // No `enabled: !!getToken()` gate here on purpose: reading localStorage
  // during render disagrees between the server's first paint (no window)
  // and the client's first paint (window exists as soon as hydration
  // starts), which caused a hydration mismatch. Letting the query always
  // run keeps both renders starting from the same isLoading:true state —
  // the auth header itself is only read inside the query fn, not render.
  const me = trpc.auth.me.useQuery(undefined, { retry: false });

  if (me.isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;

  if (!me.data)
    return (
      <Card className="space-y-4 p-8 text-center">
        <p className="text-sm text-muted-foreground">Увійди як адміністратор.</p>
        <Link href="/login" className={cn(buttonVariants(), 'w-full')}>
          Увійти
        </Link>
      </Card>
    );

  if (me.data.user.role !== 'ADMIN')
    return (
      <Card className="space-y-2 p-8 text-center">
        <p className="text-sm font-medium">Доступ лише для адміністраторів</p>
        <p className="text-sm text-muted-foreground">
          Цей акаунт ({me.data.user.email}) не має прав ADMIN.
        </p>
      </Card>
    );

  return <>{children}</>;
}
