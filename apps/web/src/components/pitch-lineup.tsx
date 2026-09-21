'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PlayerAvatar } from './player-avatar';
import { cn } from '@/lib/utils';
import { POSITION_LABEL, type PositionValue } from '@/lib/format';

type Participant = {
  id: string;
  preferredPosition: string;
  teamId: string | null;
  user: { id: string; name: string; avatarUrl: string | null };
};
type Team = { id: string; name: string };

// Attacking upward: forwards on top, keeper at the bottom.
const LINES: PositionValue[] = ['FWD', 'MID', 'DEF', 'GK'];
const TEAM_RING = ['ring-emerald-300', 'ring-sky-300', 'ring-amber-300', 'ring-fuchsia-300'];

export function PitchLineup({
  participants,
  teams,
  meId,
  canJoin,
  isLoggedIn,
  joinPending,
  onJoin,
}: {
  participants: Participant[];
  teams: Team[];
  meId?: string;
  canJoin: boolean;
  isLoggedIn: boolean;
  joinPending: boolean;
  onJoin: (position: PositionValue) => void;
}) {
  const teamRing = (teamId: string | null) => {
    if (!teamId) return '';
    const i = teams.findIndex((t) => t.id === teamId);
    return i >= 0 ? TEAM_RING[i % TEAM_RING.length] : '';
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-800 p-4 shadow-inner">
      {/* pitch markings */}
      <div className="pointer-events-none absolute inset-3 rounded-xl border-2 border-white/25" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/25" />
      <div className="pointer-events-none absolute inset-x-3 top-1/2 h-0.5 -translate-y-px bg-white/25" />

      <div className="relative flex min-h-[27rem] flex-col justify-between gap-2 py-2">
        {LINES.map((line) => {
          const players = participants.filter((p) => p.preferredPosition === line);
          return (
            <div key={line} className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/55">
                {POSITION_LABEL[line]}
              </span>
              <div className="flex flex-wrap items-start justify-center gap-3">
                {players.map((p) => (
                  <div key={p.id} className="flex w-16 flex-col items-center gap-1">
                    <PlayerAvatar
                      name={p.user.name}
                      url={p.user.avatarUrl}
                      className={cn(
                        'size-12 ring-2 ring-white/70',
                        teamRing(p.teamId),
                        p.user.id === meId && 'ring-primary',
                      )}
                    />
                    <span className="max-w-16 truncate text-[11px] font-medium text-white">
                      {p.user.name}
                    </span>
                  </div>
                ))}

                {canJoin &&
                  (isLoggedIn ? (
                    <button
                      type="button"
                      disabled={joinPending}
                      onClick={() => onJoin(line)}
                      className="flex size-12 items-center justify-center rounded-full border-2 border-dashed border-white/60 text-white/80 transition hover:border-white hover:bg-white/10 disabled:opacity-50"
                      aria-label={`Приєднатися: ${POSITION_LABEL[line]}`}
                    >
                      <Plus className="size-5" />
                    </button>
                  ) : (
                    <Link
                      href="/login"
                      className="flex size-12 items-center justify-center rounded-full border-2 border-dashed border-white/60 text-white/80 transition hover:bg-white/10"
                      aria-label="Увійти, щоб приєднатися"
                    >
                      <Plus className="size-5" />
                    </Link>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
