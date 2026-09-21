'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
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

// Bottom team attacks up (FWD nearest the centre line); top team is mirrored.
const UP: LinePosition[] = ['FWD', 'MID', 'DEF', 'GK'];
const DOWN: LinePosition[] = ['GK', 'DEF', 'MID', 'FWD'];

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
  const facing = teams.length === 2;

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

  const TeamLabel = ({ team, ti }: { team: Team; ti: number }) => (
    <div
      className={cn(
        'text-center text-xs font-semibold uppercase tracking-wider',
        TEAM_TEXT[ti % TEAM_TEXT.length],
      )}
    >
      {team.name}
    </div>
  );

  const TeamBlock = ({ team, ti, order }: { team: Team; ti: number; order: LinePosition[] }) => (
    <div className="flex flex-col gap-2">
      {order.map((line) => (
        <Slot key={line} line={line} team={team} ti={ti} />
      ))}
    </div>
  );

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-800 p-4 shadow-inner">
      <div className="pointer-events-none absolute inset-3 rounded-xl border-2 border-white/25" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/25" />
      <div className="pointer-events-none absolute inset-x-3 top-1/2 h-0.5 -translate-y-px bg-white/25" />

      {facing ? (
        <div className="relative flex min-h-[30rem] flex-col justify-between py-1">
          <div className="space-y-2">
            <TeamLabel team={teams[1]} ti={1} />
            <TeamBlock team={teams[1]} ti={1} order={DOWN} />
          </div>
          <div className="space-y-2">
            <TeamBlock team={teams[0]} ti={0} order={UP} />
            <TeamLabel team={teams[0]} ti={0} />
          </div>
        </div>
      ) : (
        <div className="relative space-y-5 py-2">
          {teams.map((team, ti) => (
            <div key={team.id} className="space-y-2">
              <TeamLabel team={team} ti={ti} />
              <TeamBlock team={team} ti={ti} order={UP} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
