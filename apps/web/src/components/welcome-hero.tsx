import Link from 'next/link';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// A short introduction keeps real games close to the first screen.
export function WelcomeHero() {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-border bg-card px-6 py-7 md:px-10 md:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 -z-10 size-72 rounded-full border-[32px] border-primary/5 md:right-8 md:size-96"
      />
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-10">
        <div className="max-w-xl space-y-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Kopanka · Футбол поруч
          </p>
          <h1 className="text-[2rem] font-bold leading-[1.08] tracking-tight md:text-5xl">
            Твоя наступна гра <span className="text-primary">починається тут.</span>
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
            Знаходь аматорські матчі, обирай команду й виходь на поле.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:shrink-0 md:flex-col md:items-stretch">
          <a href="#games" className={cn(buttonVariants(), 'h-11 gap-2 px-5')}>
            Обрати гру <ArrowDown className="size-4" />
          </a>
          <Link
            href="/help"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Як це працює <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
