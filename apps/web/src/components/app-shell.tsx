'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, CalendarCheck, PlusCircle, User, Moon, Sun, Bell } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Logo } from '@/components/logo';

const tabs = [
  { href: '/', label: 'Пошук', icon: Compass },
  { href: '/my', label: 'Мої ігри', icon: CalendarCheck },
  { href: '/events/new', label: 'Створити', icon: PlusCircle },
  { href: '/notifications', label: 'Сповіщення', icon: Bell },
  { href: '/profile', label: 'Профіль', icon: User },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Перемкнути тему"
    >
      <Sun className="size-5 dark:hidden" />
      <Moon className="hidden size-5 dark:block" />
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const mine = trpc.notifications.mine.useQuery(undefined, {
    enabled: !!me.data,
    refetchInterval: 30_000,
  });
  const unreadCount = mine.data?.unreadCount ?? 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Logo className="size-6 text-foreground" />
            Football
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {tabs.map((t) => {
            const active = t.href === '/' ? pathname === '/' : pathname.startsWith(t.href);
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  'relative flex flex-col items-center gap-1 py-2.5 text-xs transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="relative">
                  <Icon className="size-5" />
                  {t.href === '/notifications' && unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
