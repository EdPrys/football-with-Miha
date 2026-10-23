import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StarSummary = { average: number | null; count: number };

/** Compact read-only stars for under an avatar; renders nothing until rated. */
export function StarRow({
  stars,
  showValue = false,
  className,
  starClassName,
}: {
  stars?: StarSummary | null;
  showValue?: boolean;
  className?: string;
  starClassName?: string;
}) {
  if (!stars || stars.average == null) return null;
  const filled = Math.round(stars.average);
  return (
    <div
      className={cn('flex items-center gap-px', className)}
      title={`${stars.average.toFixed(1)} з 5 · оцінок: ${stars.count}`}
      aria-label={`Рейтинг ${stars.average.toFixed(1)} з 5`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'size-2.5',
            i < filled ? 'fill-amber-400 text-amber-400' : 'text-current opacity-30',
            starClassName,
          )}
        />
      ))}
      {showValue && (
        <span className="ml-1 text-xs tabular-nums text-muted-foreground">
          {stars.average.toFixed(1)} ({stars.count})
        </span>
      )}
    </div>
  );
}
