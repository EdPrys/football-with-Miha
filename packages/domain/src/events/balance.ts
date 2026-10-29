import type { ParticipantStatus, PrismaClient } from '@app/db';
import { DomainError } from '../errors.js';
import { starSummariesFor } from '../ratings/stars.js';
import { OUTFIELD_POSITION } from './join.js';

const ACTIVE_STATUSES: ParticipantStatus[] = ['JOINED', 'ATTENDED'];

/** Rating used for a player nobody has rated, when nobody in the game is rated either. */
export const DEFAULT_PLAYER_RATING = 3;

export interface BalancePlayer {
  id: string;
  rating: number;
  goalkeeper: boolean;
}

export interface BalanceSlot {
  id: string;
  team: number; // index into the event's teams
  goalkeeper: boolean;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Splits players into `teamCount` teams of (almost) equal total rating.
 * One goalkeeper per team; keepers beyond that play outfield. Everyone else
 * goes, strongest first, to the weakest team that still has room, with team
 * sizes kept within one of each other. Equal ratings are shuffled, so
 * balancing again can give a different (equally fair) split.
 */
export function balanceTeams(
  players: BalancePlayer[],
  teamCount: number,
  random: () => number = Math.random,
): BalanceSlot[] {
  const byRating = shuffled(players, random).sort((a, b) => b.rating - a.rating);
  const maxSize = Math.ceil(players.length / teamCount);
  // Team order is shuffled so the best keeper doesn't always land in Team A.
  const teams = shuffled(
    Array.from({ length: teamCount }, (_, index) => ({ index, total: 0, size: 0 })),
    random,
  );
  const slots: BalanceSlot[] = [];

  const place = (p: BalancePlayer, team: (typeof teams)[number], goalkeeper: boolean) => {
    team.total += p.rating;
    team.size += 1;
    slots.push({ id: p.id, team: team.index, goalkeeper });
  };

  const keepers = byRating.filter((p) => p.goalkeeper).slice(0, teamCount);
  keepers.forEach((p, i) => place(p, teams[i]!, true));

  for (const p of byRating) {
    if (keepers.includes(p)) continue;
    const open = teams.filter((t) => t.size < maxSize);
    const weakest = open.reduce((best, t) =>
      t.total < best.total || (t.total === best.total && t.size < best.size) ? t : best,
    );
    place(p, weakest, false);
  }
  return slots;
}

/**
 * The organizer reshuffles a not-yet-started game into teams of equal
 * strength by players' stars. Unrated players count as the game's average.
 */
export async function rebalanceEventTeams(
  prisma: PrismaClient,
  input: { eventId: string; organizerId: string },
  random: () => number = Math.random,
): Promise<number> {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: {
      organizerId: true,
      status: true,
      teams: { select: { id: true }, orderBy: { name: 'asc' } },
      participants: {
        where: { status: { in: ACTIVE_STATUSES } },
        select: { id: true, userId: true, preferredPosition: true },
      },
    },
  });
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
  if (event.organizerId !== input.organizerId) {
    throw new DomainError('FORBIDDEN', 'Only the organizer can manage this event');
  }
  if (event.status !== 'UPCOMING') {
    throw new DomainError('INVALID_STATE', 'Teams can only be balanced before the game starts');
  }
  if (event.participants.length < 2) {
    throw new DomainError('INVALID_STATE', 'Not enough players to balance teams');
  }

  const stars = await starSummariesFor(
    prisma,
    event.participants.map((p) => p.userId),
  );
  const rated = [...stars.values()].flatMap((s) => (s.average === null ? [] : [s.average]));
  const fallback = rated.length
    ? rated.reduce((a, b) => a + b, 0) / rated.length
    : DEFAULT_PLAYER_RATING;

  const slots = balanceTeams(
    event.participants.map((p) => ({
      id: p.id,
      rating: stars.get(p.userId)?.average ?? fallback,
      goalkeeper: p.preferredPosition === 'GK',
    })),
    event.teams.length,
    random,
  );

  await prisma.$transaction(
    slots.map((s) => {
      const p = event.participants.find((x) => x.id === s.id)!;
      return prisma.eventParticipant.update({
        where: { id: s.id },
        data: {
          teamId: event.teams[s.team]!.id,
          // A keeper left without a goal plays outfield.
          ...(p.preferredPosition === 'GK' && !s.goalkeeper
            ? { preferredPosition: OUTFIELD_POSITION }
            : {}),
        },
      });
    }),
  );
  return slots.length;
}
