'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <Card role="alert" className="mx-auto max-w-md space-y-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Не вдалося відкрити сторінку</h1>
      <p className="text-sm text-muted-foreground">
        Спробуй ще раз. Збережену в цьому браузері чернетку гри можна відновити на сторінці
        створення.
      </p>
      <Button onClick={reset}>Спробувати ще</Button>
      <Link href="/" className="block text-sm text-primary">
        Повернутися до ігор
      </Link>
    </Card>
  );
}
