'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MapPin, Users as UsersIcon, Moon, Sun, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { clearToken } from '@/lib/auth';
import { Logo } from '@/components/logo';

const tabs = [
  { href: '/venues', label: 'Майданчики', icon: MapPin },
  { href: '/users', label: 'Користувачі', icon: UsersIcon },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Перемкнути тему"
    >
      <Sun className="size-5 dark:hidden" />
      <Moon className="hidden size-5 dark:block" />
    </button>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });

  const logout = async () => {
    clearToken();
    await utils.invalidate();
    router.push('/login');
  };

  const isLogin = pathname === '/login';

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="app-header sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-3xl flex-wrap items-center justify-between gap-x-2 px-4">
          <Link
            href="/venues"
            className="flex min-h-11 items-center gap-2 text-sm font-semibold tracking-tight sm:text-base"
          >
            <Logo className="size-6 text-foreground" />
            Football — Адмін
          </Link>
          {!isLogin && (
            <nav
              aria-label="Адміністрування"
              className="order-last flex w-full items-center gap-1 border-t py-1 sm:order-none sm:w-auto sm:border-0"
            >
              {tabs.map((t) => {
                const active = pathname.startsWith(t.href);
                const Icon = t.icon;
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4" />
                    {t.label}
                  </Link>
                );
              })}
            </nav>
          )}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {me.data && (
              <button
                onClick={logout}
                aria-label="Вийти з облікового запису"
                className="flex min-h-11 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <LogOut className="size-4" />
                <span className="hidden max-w-28 truncate md:inline">{me.data.user.name}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-3xl flex-1 px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] [overflow-wrap:anywhere]">
        {children}
      </main>
    </div>
  );
}
