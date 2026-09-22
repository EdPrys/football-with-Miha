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
      className="rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
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
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/venues" className="flex items-center gap-2 font-semibold tracking-tight">
            <Logo className="size-6 text-foreground" />
            Football — Адмін
          </Link>
          {!isLogin && (
            <nav className="flex items-center gap-1">
              {tabs.map((t) => {
                const active = pathname.startsWith(t.href);
                const Icon = t.icon;
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
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
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <LogOut className="size-4" />
                {me.data.user.name}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
