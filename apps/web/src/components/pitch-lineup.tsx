'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Formation, LinePosition } from '@/lib/formation';
import { PlayerAvatar } from './player-avatar';
import { cn } from '@/lib/utils';

type Participant = {
  id: string;
  preferredPosition: string;
  teamId: string | null;
  user: { id: string; name: string; avatarUrl: string | null };
};
type Team = { id: string; name: string };

const TEAM_RING = ['ring-emerald-300', 'ring-sky-300', 'ring-amber-300', 'ring-fuchsia-300'];
const TEAM_TEXT = ['text-emerald-200', 'text-sky-200', 'text-amber-200', 'text-fuchsia-200'];
const TEAM_DOT = ['bg-emerald-300', 'bg-sky-300', 'bg-amber-300', 'bg-fuchsia-300'];

// GK nearest the goal (top), FWD nearest the halfway line (bottom of the half-pitch card).
const ORDER: LinePosition[] = ['GK', 'DEF', 'MID', 'FWD'];

const net = {
  backgroundImage:
    'repeating-linear-gradient(90deg, rgba(255,255,255,0.35) 0 1px, transparent 1px 6px),' +
    'repeating-linear-gradient(0deg, rgba(255,255,255,0.35) 0 1px, transparent 1px 6px)',
};

export function PitchLineup({
  participants,
  teams,
  formation,
  playersPerTeam,
  meId,
  canJoinBase,
  isLoggedIn,
  joinPending,
  onJoin,
}: {
  participants: Participant[];
  teams: Team[];
  formation: Formation;
  playersPerTeam: number;
  meId?: string;
  canJoinBase: boolean;
  isLoggedIn: boolean;
  joinPending: boolean;
  onJoin: (position: LinePosition, teamId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToIndex = (i: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  const Slot = ({ line, team, ti }: { line: LinePosition; team: Team; ti: number }) => {
    const players = participants.filter(
      (p) => p.teamId === team.id && p.preferredPosition === line,
    );
    const teamCount = participants.filter((p) => p.teamId === team.id).length;
    const teamFull = teamCount >= playersPerTeam;
    const empty = Math.max(0, formation[line] - players.length);
    if (formation[line] <= 0) return null;

    return (
      <div className="flex flex-wrap items-start justify-center gap-3">
        {players.map((p) => (
          <div key={p.id} className="flex w-16 flex-col items-center gap-1">
            <PlayerAvatar
              name={p.user.name}
              url={p.user.avatarUrl}
              className={cn(
                'size-11 ring-2',
                TEAM_RING[ti % TEAM_RING.length],
                p.user.id === meId && 'ring-primary',
              )}
            />
            <span className="max-w-16 truncate text-[11px] font-medium text-white">
              {p.user.name}
            </span>
          </div>
        ))}
        {Array.from({ length: empty }).map((_, i) =>
          canJoinBase && !teamFull ? (
            isLoggedIn ? (
              <button
                key={i}
                type="button"
                disabled={joinPending}
                onClick={() => onJoin(line, team.id)}
                className="flex size-11 items-center justify-center rounded-full border-2 border-dashed border-white/60 text-white/80 transition hover:border-white hover:bg-white/10 disabled:opacity-50"
                aria-label={`${team.name}: ${line}`}
              >
                <Plus className="size-5" />
              </button>
            ) : (
              <Link
                key={i}
                href="/login"
                className="flex size-11 items-center justify-center rounded-full border-2 border-dashed border-white/60 text-white/80 hover:bg-white/10"
              >
                <Plus className="size-5" />
              </Link>
            )
          ) : (
            <div
              key={i}
              className="size-11 rounded-full border-2 border-dashed border-white/25"
              aria-hidden
            />
          ),
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => scrollToIndex(Math.max(0, active - 1))}
          disabled={active === 0}
          aria-label="Попередня команда"
          className="flex size-8 items-center justify-center rounded-full border bg-card text-foreground disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-xs font-semibold uppercase tracking-wider',
              TEAM_TEXT[active % TEAM_TEXT.length],
            )}
          >
            {teams[active]?.name}
          </span>
          <div className="flex items-center gap-1.5">
            {teams.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => scrollToIndex(i)}
                aria-label={`Показати ${t.name}`}
                className={cn(
                  'size-1.5 rounded-full transition',
                  i === active ? TEAM_DOT[i % TEAM_DOT.length] : 'bg-muted-foreground/30',
                )}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => scrollToIndex(Math.min(teams.length - 1, active + 1))}
          disabled={active === teams.length - 1}
          aria-label="Наступна команда"
          className="flex size-8 items-center justify-center rounded-full border bg-card text-foreground disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {teams.map((team, ti) => (
          <div key={team.id} className="w-full shrink-0 snap-center">
            <div className="relative min-h-[26rem] overflow-hidden bg-gradient-to-b from-emerald-600 to-emerald-800 px-4 pb-10 pt-6 shadow-inner">
              {/* half-pitch boundary: goal end at top, halfway line at the bottom edge */}
              <div className="pointer-events-none absolute inset-x-3 top-3 bottom-3 rounded-t-lg border-2 border-white/25" />
              {/* centre-circle arc bulging up from the halfway line */}
              <div className="pointer-events-none absolute bottom-3 left-1/2 size-20 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white/20" />
              {/* goal */}
              <div
                className="pointer-events-none absolute left-1/2 top-3 h-4 w-16 -translate-x-1/2 rounded-t-sm border-2 border-b-0 border-white/70"
                style={net}
              />
              <div className="relative flex h-full flex-col justify-evenly gap-3 pt-3">
                {ORDER.map((line) => (
                  <Slot key={line} line={line} team={team} ti={ti} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
