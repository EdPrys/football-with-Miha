'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { errorMessage } from '@/lib/errors';
import { setToken } from '@/lib/auth';
import { getAttribution, track } from '@/lib/analytics';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

// useSearchParams needs a Suspense boundary for the static build.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const utils = trpc.useUtils();
  // Landing/ad links open straight on signup via /login?mode=register.
  const params = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>(
    params.get('mode') === 'register' ? 'register' : 'login',
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const mismatch = mode === 'register' && confirm.length > 0 && confirm !== password;

  const done = async (token: string) => {
    setToken(token);
    await utils.invalidate();
    toast.success('Ласкаво просимо!');
    router.push('/profile');
  };
  const login = trpc.auth.login.useMutation({
    onSuccess: (d) => {
      track('login');
      return done(d.token);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const register = trpc.auth.register.useMutation({
    onSuccess: (d) => {
      track('sign_up');
      return done(d.token);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const pending = login.isPending || register.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'login') return login.mutate({ email, password });
    if (password !== confirm) return toast.error('Паролі не збігаються');
    register.mutate({ name: name.trim(), email, password, attribution: getAttribution() });
  };

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{mode === 'login' ? 'Вхід' : 'Реєстрація'}</h1>
        <p className="text-sm text-muted-foreground">Kopanka — футбол поруч</p>
      </div>
      <Card className="p-5">
        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Ім&apos;я</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
            {mode === 'register' && (
              <p className="text-xs text-muted-foreground">
                Щонайменше 8 символів, хоча б одна літера і одна цифра
              </p>
            )}
          </div>
          {mode === 'register' && (
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Повторіть пароль</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                aria-invalid={mismatch}
                required
              />
              {mismatch && <p className="text-xs text-destructive">Паролі не збігаються</p>}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? '...' : mode === 'login' ? 'Увійти' : 'Створити акаунт'}
          </Button>
        </form>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        {mode === 'login' ? 'Немає акаунта? ' : 'Вже є акаунт? '}
        <button
          type="button"
          className="font-medium text-primary"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Реєстрація' : 'Вхід'}
        </button>
      </p>
    </div>
  );
}
