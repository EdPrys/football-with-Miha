import Link from 'next/link';
import { Search, Shirt, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STEPS = [
  { icon: Search, title: 'Знайди гру', body: 'Матчі поруч на найближчі дні' },
  { icon: Shirt, title: 'Займи місце', body: 'Обери команду й позицію на полі' },
  { icon: Star, title: 'Грай', body: 'Після гри партнери ставлять зірки' },
];

// Intro for visitors who aren't signed in yet (e.g. arriving from an ad).
export function WelcomeHero() {
  return (
    <Card className="space-y-5 bg-primary/5 p-5 md:p-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight md:text-4xl">
          Футбол поруч — без пошуку команди
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          Kopanka збирає аматорські ігри у твоєму місті. Приходь сам — команда вже чекає.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.title} className="flex items-start gap-3">
            <s.icon className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <div className="text-sm font-medium">{s.title}</div>
              <div className="text-xs text-muted-foreground">{s.body}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/login?mode=register" className={buttonVariants({ size: 'lg' })}>
          Зареєструватись безкоштовно
        </Link>
        <Link href="/help" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
          Як це працює
        </Link>
      </div>
    </Card>
  );
}
