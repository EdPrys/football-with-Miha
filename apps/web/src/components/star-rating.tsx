'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StarRating({
  value,
  onChange,
  max = 5,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`Оцінка ${n}`}>
          <Star
            className={cn(
              'size-8 transition-colors',
              n <= value ? 'fill-primary text-primary' : 'text-muted-foreground/30',
            )}
          />
        </button>
      ))}
    </div>
  );
}
