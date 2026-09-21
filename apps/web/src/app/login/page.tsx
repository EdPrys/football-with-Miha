'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { setToken } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const done = async (token: string) => {
    setToken(token);
    await utils.invalidate();
    toast.success('Ласкаво просимо!');
    router.push('/profile');
  };
  const login = trpc.auth.login.useMutation({
    onSuccess: (d) => done(d.token),
    onError: (e) => toast.error(e.message),
  });
  const register = trpc.auth.register.useMutation({
    onSuccess: (d) => done(d.token),
    onError: (e) => toast.error(e.message),
  });
  const pending = login.isPending || register.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'login') login.mutate({ email, password });
    else register.mutate({ name, email, password });
  };

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{mode === 'login' ? 'Вхід' : 'Реєстрація'}</h1>
        <p className="text-sm text-muted-foreground">Football pickup games</p>
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
              required
            />
          </div>
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
