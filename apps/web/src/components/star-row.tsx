import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StarSummary = { average: number | null; count: number };

/**
 * Read-only 5-star row filled in proportion to the average (3.4 → three full
 * stars and the fourth 40% filled), like a ride-hailing driver rating.
 * Renders nothing until the player has been rated.
 */
export function StarRow({
  stars,
  className,
  starClassName,
}: {
  stars?: StarSummary | null;
  className?: string;
  starClassName?: string;
}) {
  if (!stars || stars.average == null) return null;
  const avg = stars.average;
  return (
    <div
      className={cn('flex items-center gap-px', className)}
      title={`${avg.toFixed(1)} з 5 · оцінок: ${stars.count}`}
      aria-label={`Рейтинг ${avg.toFixed(1)} з 5`}
    >
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.min(1, Math.max(0, avg - i));
        return (
          <span key={i} className="relative inline-flex">
            <Star className={cn('size-2.5 text-current opacity-30', starClassName)} />
            {fill > 0 && (
              <span
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star className={cn('size-2.5 fill-amber-400 text-amber-400', starClassName)} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
