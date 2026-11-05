'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { trpc } from '@/lib/trpc';
import { clearToken } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function ResetPasswordPage() {
  const [token, setResetToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const captured = useRef(false);
  const utils = trpc.useUtils();
  useEffect(() => {
    if (captured.current) return;
    captured.current = true;
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
    setResetToken(value && /^[a-f0-9]{64}$/.test(value) ? value : null);
    // Keep the secret only in this page's memory, never localStorage or URLs
    // copied after opening the link. GET/link previews never consume a token.
    window.history.replaceState(window.history.state, '', window.location.pathname);
    setLoaded(true);
  }, []);
  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: async () => {
      clearToken();
      setPassword('');
      setConfirm('');
      setResetToken(null);
      setDone(true);
      await utils.invalidate();
    },
  });
  const mismatch = confirm.length > 0 && confirm !== password;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!token || password !== confirm) return;
    reset.mutate({ token, password });
  };

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-6">
      <h1 className="text-center text-2xl font-bold">Новий пароль</h1>
      <Card className="space-y-4 p-5">
        {!loaded ? (
          <p role="status">Завантажуємо…</p>
        ) : done ? (
          <div role="status" className="space-y-3">
            <p>Пароль змінено. Попередні сесії завершено — увійди з новим паролем.</p>
            <Link href="/login" className="text-primary underline">
              Увійти
            </Link>
          </div>
        ) : !token ? (
          <div role="alert" className="space-y-3">
            <p>
              Посилання неповне або вже закрите. Відкрий посилання з листа ще раз або отримай нове.
            </p>
            <Link href="/forgot-password" className="text-primary underline">
              Отримати нове посилання
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Новий пароль</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Від 8 до 128 символів, хоча б одна латинська літера і одна цифра.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Повторіть пароль</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={mismatch}
                required
              />
              {mismatch && (
                <p role="alert" className="text-sm text-destructive">
                  Паролі не збігаються
                </p>
              )}
            </div>
            {reset.error && (
              <div role="alert" className="space-y-2 text-sm text-destructive">
                <p>{errorMessage(reset.error)}</p>
                <Link href="/forgot-password" className="underline">
                  Отримати нове посилання
                </Link>
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={reset.isPending || password !== confirm}
            >
              {reset.isPending ? 'Зберігаємо…' : 'Зберегти новий пароль'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
