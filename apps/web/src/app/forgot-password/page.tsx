'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { trpc } from '@/lib/trpc';
import { errorMessage } from '@/lib/errors';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const availability = trpc.auth.passwordRecoveryAvailable.useQuery();
  const request = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setSent(true);
      setCooldown(true);
    },
  });
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(false), 60_000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    request.mutate({ email: email.trim() });
  };

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-6">
      <h1 className="text-center text-2xl font-bold">Відновлення пароля</h1>
      <Card className="space-y-4 p-5">
        {availability.isPending ? (
          <p role="status">Перевіряємо доступність…</p>
        ) : availability.error ? (
          <div role="alert" className="space-y-3">
            <p>{errorMessage(availability.error)}</p>
            <Button variant="outline" onClick={() => void availability.refetch()}>
              Спробувати ще раз
            </Button>
          </div>
        ) : !availability.data?.available ? (
          <p role="status">Відновлення пароля тимчасово недоступне. Спробуй пізніше.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Введи email свого акаунта — надішлемо посилання для встановлення нового пароля.
            </p>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="recovery-email">Email</Label>
                <Input
                  id="recovery-email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {request.error && (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage(request.error)}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={request.isPending || cooldown}>
                {request.isPending
                  ? 'Надсилаємо…'
                  : cooldown
                    ? 'Повторити можна через хвилину'
                    : sent
                      ? 'Надіслати ще раз'
                      : 'Надіслати посилання'}
              </Button>
            </form>
            {sent && (
              <div role="status" className="space-y-2 text-sm">
                <p>
                  Якщо акаунт із цим email існує, лист із посиланням надійде на пошту. Посилання діє
                  30 хвилин.
                </p>
                <p className="text-muted-foreground">
                  Перевір також папку «Спам» і правильність адреси. Повторні запити обмежені — якщо
                  лист не надійшов, зачекай 15 хвилин і спробуй знову.
                </p>
              </div>
            )}
          </>
        )}
      </Card>
      <p className="text-center text-sm">
        <Link href="/login" className="text-primary underline">
          Повернутися до входу
        </Link>
      </p>
    </div>
  );
}
