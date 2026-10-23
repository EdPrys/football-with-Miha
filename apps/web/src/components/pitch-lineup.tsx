'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { PlayerAvatar } from './player-avatar';
import { StarRow, type StarSummary } from './star-row';
import { cn } from '@/lib/utils';

type Participant = {
  id: string;
  preferredPosition: string;
  teamId: string | null;
  user: { id: string; name: string; avatarUrl: string | null; stars?: StarSummary };
};
type Team = { id: string; name: string };

const TEAM_RING = ['ring-emerald-300', 'ring-sky-300', 'ring-amber-300', 'ring-fuchsia-300'];
// Used only for the carousel header label, which sits on the page background
// (not the green pitch) — needs to hold contrast in light mode too.
const TEAM_TEXT = [
  'text-emerald-700 dark:text-emerald-300',
  'text-sky-700 dark:text-sky-300',
  'text-amber-700 dark:text-amber-300',
  'text-fuchsia-700 dark:text-fuchsia-300',
];
const TEAM_DOT = ['bg-emerald-300', 'bg-sky-300', 'bg-amber-300', 'bg-fuchsia-300'];

export type JoinPosition = 'GK' | 'MID';

// One goalkeeper by the goal; everyone else is an outfield player, laid out
// in rows of three. Outfield joins are stored as MID (see OUTFIELD_POSITION
// in @app/domain); older DEF/FWD rows render as outfield players too.
const OUTFIELD_PER_ROW = 3;

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

const net = {
  backgroundImage:
    'repeating-linear-gradient(90deg, rgba(255,255,255,0.35) 0 1px, transparent 1px 6px),' +
    'repeating-linear-gradient(0deg, rgba(255,255,255,0.35) 0 1px, transparent 1px 6px)',
};

export function PitchLineup({
  participants,
  teams,
  playersPerTeam,
  meId,
  canJoinBase,
  isLoggedIn,
  joinPending,
  onJoin,
}: {
  participants: Participant[];
  teams: Team[];
  playersPerTeam: number;
  meId?: string;
  canJoinBase: boolean;
  isLoggedIn: boolean;
  joinPending: boolean;
  onJoin: (position: JoinPosition, teamId: string) => void;
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

  type Cell = { kind: 'player'; p: Participant } | { kind: 'empty'; key: string };

  const PlayerChip = ({ p, ti }: { p: Participant; ti: number }) => (
    <div className="flex w-16 flex-col items-center gap-1">
      <PlayerAvatar
        name={p.user.name}
        url={p.user.avatarUrl}
        className={cn(
          'size-11 ring-2',
          TEAM_RING[ti % TEAM_RING.length],
          p.user.id === meId && 'ring-primary',
        )}
      />
      <span className="max-w-16 truncate text-[11px] font-medium text-white">{p.user.name}</span>
      <StarRow stars={p.user.stars} className="-mt-0.5 text-white" />
    </div>
  );

  const EmptySlot = ({
    position,
    team,
    open,
    label,
  }: {
    position: JoinPosition;
    team: Team;
    open: boolean;
    label: string;
  }) => (
    <div className="flex w-16 flex-col items-center gap-1">
      {open ? (
        isLoggedIn ? (
          <button
            type="button"
            disabled={joinPending}
            onClick={() => onJoin(position, team.id)}
            className="flex size-11 items-center justify-center rounded-full border-2 border-dashed border-white/60 text-white/80 transition hover:border-white hover:bg-white/10 disabled:opacity-50"
            aria-label={`${team.name}: ${label}`}
          >
            <Plus className="size-5" />
          </button>
        ) : (
          <Link
            href="/login"
            className="flex size-11 items-center justify-center rounded-full border-2 border-dashed border-white/60 text-white/80 hover:bg-white/10"
            aria-label={`${team.name}: ${label}`}
          >
            <Plus className="size-5" />
          </Link>
        )
      ) : (
        <div className="size-11 rounded-full border-2 border-dashed border-white/25" aria-hidden />
      )}
      {position === 'GK' && <span className="text-[11px] text-white/70">{label}</span>}
    </div>
  );

  const TeamHalf = ({ team, ti }: { team: Team; ti: number }) => {
    const mine = participants.filter((p) => p.teamId === team.id);
    const keepers = mine.filter((p) => p.preferredPosition === 'GK');
    const outfield = mine.filter((p) => p.preferredPosition !== 'GK');
    const open = canJoinBase && mine.length < playersPerTeam;

    const outfieldCells: Cell[] = [
      ...outfield.map((p) => ({ kind: 'player' as const, p })),
      ...Array.from({ length: Math.max(0, playersPerTeam - 1 - outfield.length) }, (_, i) => ({
        kind: 'empty' as const,
        key: `empty-${i}`,
      })),
    ];

    return (
      <div className="relative flex flex-1 flex-col justify-evenly gap-3 pt-3">
        <div className="flex justify-center gap-3">
          {keepers.map((p) => (
            <PlayerChip key={p.id} p={p} ti={ti} />
          ))}
          {keepers.length === 0 && (
            <EmptySlot position="GK" team={team} open={open} label="Воротар" />
          )}
        </div>
        {chunk(outfieldCells, OUTFIELD_PER_ROW).map((row, ri) => (
          <div key={ri} className="flex justify-center gap-3">
            {row.map((c) =>
              c.kind === 'player' ? (
                <PlayerChip key={c.p.id} p={c.p} ti={ti} />
              ) : (
                <EmptySlot
                  key={c.key}
                  position="MID"
                  team={team}
                  open={open}
                  label="Польовий гравець"
                />
              ),
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Carousel controls — on desktop all halves are shown side by side instead */}
      <div className="flex items-center justify-between px-1 lg:hidden">
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
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl scroll-smooth lg:grid lg:grid-cols-2 lg:gap-4 lg:overflow-visible lg:rounded-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {teams.map((team, ti) => (
          <div key={team.id} className="w-full shrink-0 snap-center lg:w-auto lg:space-y-2">
            <div
              className={cn(
                'hidden px-1 text-xs font-semibold uppercase tracking-wider lg:block',
                TEAM_TEXT[ti % TEAM_TEXT.length],
              )}
            >
              {team.name}
            </div>
            <div className="relative flex min-h-[26rem] flex-col overflow-hidden lg:min-h-[30rem] lg:rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-800 px-4 pb-10 pt-6 shadow-inner">
              {/* half-pitch boundary: goal end at top, halfway line at the bottom edge */}
              <div className="pointer-events-none absolute inset-x-3 top-3 bottom-3 rounded-t-lg border-2 border-white/25" />
              {/* centre-circle arc bulging up from the halfway line */}
              <div className="pointer-events-none absolute bottom-3 left-1/2 size-20 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white/20" />
              {/* goal */}
              <div
                className="pointer-events-none absolute left-1/2 top-3 h-4 w-16 -translate-x-1/2 rounded-t-sm border-2 border-b-0 border-white/70"
                style={net}
              />
              <TeamHalf team={team} ti={ti} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
