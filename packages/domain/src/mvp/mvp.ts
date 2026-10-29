import type { EventStatus, MvpVote, PrismaClient } from '@app/db';
import { DomainError } from '../errors.js';
import { ratingClosesAt, RATING_WINDOW_HOURS } from '../ratings/submit.js';
import { notifyMany } from '../notifications/create.js';

export interface MvpVoteContext {
  eventStatus: EventStatus;
  finishedAt: Date | null;
  mvpResolved: boolean;
  now: Date;
  isSelf: boolean;
  voterAttended: boolean;
  nomineeAttended: boolean;
  alreadyVoted: boolean;
}

/** Pure invariant check for an MVP vote. Voting shares the 24h star window. */
export function assertCanVoteMvp(ctx: MvpVoteContext): void {
  if (ctx.isSelf) throw new DomainError('FORBIDDEN', 'You cannot vote for yourself');
  if (ctx.eventStatus !== 'FINISHED') {
    throw new DomainError('INVALID_STATE', 'MVP voting opens after the event is finished');
  }
  const closesAt = ratingClosesAt(ctx.finishedAt);
  if (ctx.mvpResolved || (closesAt && ctx.now > closesAt)) {
    throw new DomainError('INVALID_STATE', 'MVP voting is closed');
  }
  if (!ctx.voterAttended || !ctx.nomineeAttended) {
    throw new DomainError('FORBIDDEN', 'Only players of this match can vote and be voted for');
  }
  if (ctx.alreadyVoted)
    throw new DomainError('CONFLICT', 'You already voted for MVP in this match');
}

/**
 * Winners from a list of nominee ids (one entry per vote): whoever has the
 * most votes; on a tie every tied player is MVP. No votes → no MVP.
 */
export function pickMvpWinners(nomineeIds: string[]): { userId: string; votes: number }[] {
  const tally = new Map<string, number>();
  for (const id of nomineeIds) tally.set(id, (tally.get(id) ?? 0) + 1);
  const top = Math.max(0, ...tally.values());
  if (top === 0) return [];
  return [...tally]
    .filter(([, votes]) => votes === top)
    .map(([userId, votes]) => ({ userId, votes }));
}

export interface CastMvpVoteInput {
  eventId: string;
  voterId: string;
  nomineeId: string;
}

/**
 * Cast one MVP vote. When every player of the match has voted, the result is
 * decided right away instead of waiting for the window to close.
 */
export async function castMvpVote(prisma: PrismaClient, input: CastMvpVoteInput): Promise<MvpVote> {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { status: true, finishedAt: true, mvpResolvedAt: true },
  });
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');

  const [voter, nominee, already] = await Promise.all([
    prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId: input.eventId, userId: input.voterId } },
      select: { status: true },
    }),
    prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId: input.eventId, userId: input.nomineeId } },
      select: { status: true },
    }),
    prisma.mvpVote.findUnique({
      where: { eventId_voterId: { eventId: input.eventId, voterId: input.voterId } },
      select: { id: true },
    }),
  ]);

  assertCanVoteMvp({
    eventStatus: event.status,
    finishedAt: event.finishedAt,
    mvpResolved: !!event.mvpResolvedAt,
    now: new Date(),
    isSelf: input.voterId === input.nomineeId,
    voterAttended: voter?.status === 'ATTENDED',
    nomineeAttended: nominee?.status === 'ATTENDED',
    alreadyVoted: !!already,
  });

  const vote = await prisma.mvpVote.create({ data: input });

  const [votes, players] = await Promise.all([
    prisma.mvpVote.count({ where: { eventId: input.eventId } }),
    prisma.eventParticipant.count({ where: { eventId: input.eventId, status: 'ATTENDED' } }),
  ]);
  if (votes >= players) await resolveMvp(prisma, input.eventId);
  return vote;
}

/**
 * Close MVP voting for one game: write the winner(s) to EventMvp and notify
 * them. `mvpResolvedAt` is claimed with a conditional update, so concurrent
 * callers (last vote vs. background job) resolve a game exactly once.
 */
export async function resolveMvp(prisma: PrismaClient, eventId: string): Promise<string[] | null> {
  const winners = await prisma.$transaction(async (tx) => {
    const claimed = await tx.event.updateMany({
      where: { id: eventId, status: 'FINISHED', mvpResolvedAt: null },
      data: { mvpResolvedAt: new Date() },
    });
    if (claimed.count === 0) return null;
    const votes = await tx.mvpVote.findMany({ where: { eventId }, select: { nomineeId: true } });
    const picked = pickMvpWinners(votes.map((v) => v.nomineeId));
    if (picked.length) {
      await tx.eventMvp.createMany({ data: picked.map((w) => ({ eventId, ...w })) });
    }
    return picked;
  });
  if (!winners) return null;

  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { startAt: true },
  });
  await notifyMany(
    prisma,
    winners.map((w) => ({
      userId: w.userId,
      type: 'MVP_AWARDED' as const,
      payload: { eventId, eventStartAt: event.startAt.toISOString(), votes: w.votes },
    })),
  );
  return winners.map((w) => w.userId);
}

/** Background job: close MVP voting for games whose 24h window has passed. */
export async function resolveDueMvps(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<string[]> {
  const windowMs = RATING_WINDOW_HOURS * 60 * 60 * 1000;
  const due = await prisma.event.findMany({
    where: {
      status: 'FINISHED',
      mvpResolvedAt: null,
      finishedAt: { lt: new Date(now.getTime() - windowMs) },
    },
    select: { id: true },
  });
  const resolved: string[] = [];
  for (const e of due) {
    if (await resolveMvp(prisma, e.id)) resolved.push(e.id);
  }
  return resolved;
}

/** MVP award counts for many players at once (avatars on the pitch, profile). */
export async function mvpCountsFor(
  prisma: PrismaClient,
  userIds: string[],
): Promise<Map<string, number>> {
  const rows = userIds.length
    ? await prisma.eventMvp.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      })
    : [];
  const counts = new Map(rows.map((r) => [r.userId, r._count._all]));
  return new Map(userIds.map((id) => [id, counts.get(id) ?? 0]));
}
