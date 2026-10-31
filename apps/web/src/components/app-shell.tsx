'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass,
  CalendarCheck,
  PlusCircle,
  User,
  Moon,
  Sun,
  Bell,
  CircleHelp,
} from 'lucide-react';
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
      className="inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label="Перемкнути тему"
    >
      <Sun className="size-5 dark:hidden" />
      <Moon className="hidden size-5 dark:block" />
    </button>
  );
}

function UnreadBadge({ count }: { count: number }) {
  return (
    <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold text-white">
      {count > 9 ? '9+' : count}
    </span>
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
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-lg bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only"
      >
        Перейти до вмісту
      </a>
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4 md:h-16 md:max-w-6xl md:px-6">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2.5 rounded-lg text-lg font-bold tracking-tight"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Logo className="size-6" />
            </span>
            Kopanka
          </Link>

          {/* Desktop nav — the bottom tab bar takes over below md */}
          <nav aria-label="Основна навігація" className="hidden items-center gap-1 md:flex">
            {tabs.map((t) => {
              const active = isActive(t.href);
              const Icon = t.icon;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={t.label}
                  className={cn(
                    'flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <span className="relative">
                    <Icon className="size-4" />
                    {t.href === '/notifications' && unreadCount > 0 && (
                      <UnreadBadge count={unreadCount} />
                    )}
                  </span>
                  <span className="hidden lg:inline">{t.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center">
            <Link
              href="/help"
              aria-label="Як це працює"
              className={cn(
                'inline-flex size-11 items-center justify-center rounded-xl transition-colors hover:bg-muted hover:text-foreground',
                pathname === '/help' ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <CircleHelp className="size-5" />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto w-full max-w-md flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 md:max-w-6xl md:px-6 md:pb-12 md:pt-8"
      >
        {children}
      </main>

      <nav
        aria-label="Основна навігація"
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {tabs.map((t) => {
            const active = isActive(t.href);
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  // 5 tabs on a 320px phone: smaller labels so they don't touch.
                  'relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors min-[360px]:text-xs',
                  active
                    ? 'bg-primary/8 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span className="relative">
                  <Icon className="size-5" />
                  {t.href === '/notifications' && unreadCount > 0 && (
                    <UnreadBadge count={unreadCount} />
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
