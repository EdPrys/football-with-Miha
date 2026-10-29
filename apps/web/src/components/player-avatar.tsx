import { Crown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** "1 раз", "3 рази", "5 разів", "21 раз". */
function timesWord(n: number) {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return 'раз';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'рази';
  return 'разів';
}

export function PlayerAvatar({
  name,
  url,
  className,
  mvpCount = 0,
}: {
  name: string;
  url?: string | null;
  className?: string;
  /** Times this player was MVP of a match; shown as a crown badge on top when > 0. */
  mvpCount?: number;
}) {
  const avatar = (
    <Avatar className={className}>
      {url ? <AvatarImage src={url} alt={name} /> : null}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
  if (mvpCount <= 0) return avatar;

  return (
    <span className="relative inline-flex">
      {avatar}
      <span
        className="absolute -top-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-px text-[10px] font-bold leading-none text-amber-950 shadow ring-1 ring-white/70"
        title={`MVP матчу: ${mvpCount} ${timesWord(mvpCount)}`}
        aria-label={`MVP матчу: ${mvpCount}`}
      >
        <Crown className="size-2.5" />
        {mvpCount}
      </span>
    </span>
  );
}
