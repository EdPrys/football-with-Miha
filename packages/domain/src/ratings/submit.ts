import type { EventStatus, PrismaClient } from '@app/db';
import { DomainError } from '../errors.js';

export const MIN_STARS = 1;
export const MAX_STARS = 5;
/** Players can rate each other only within this window after the game is finished. */
export const RATING_WINDOW_HOURS = 24;

/** When rating closes for an event; null while the game isn't finished yet. */
export function ratingClosesAt(finishedAt: Date | null): Date | null {
  return finishedAt ? new Date(finishedAt.getTime() + RATING_WINDOW_HOURS * 60 * 60 * 1000) : null;
}

export interface RatableContext {
  eventStatus: EventStatus;
  finishedAt: Date | null;
  now: Date;
  isSelf: boolean;
  raterAttended: boolean;
  rateeAttended: boolean;
  alreadyRated: boolean;
}

/** Pure invariant check for whether a rating may be submitted. */
export function assertRatable(ctx: RatableContext): void {
  if (ctx.isSelf) throw new DomainError('FORBIDDEN', 'You cannot rate yourself');
  if (ctx.eventStatus !== 'FINISHED') {
    throw new DomainError('INVALID_STATE', 'Ratings open only after the event is finished');
  }
  const closesAt = ratingClosesAt(ctx.finishedAt);
  if (closesAt && ctx.now > closesAt) {
    throw new DomainError('INVALID_STATE', 'Rating is closed 24 hours after the game');
  }
  if (!ctx.raterAttended || !ctx.rateeAttended) {
    throw new DomainError('FORBIDDEN', 'You can only rate players who attended the same match');
  }
  if (ctx.alreadyRated) {
    throw new DomainError('CONFLICT', 'You already rated this player for this event');
  }
}

export interface RatingEntry {
  rateeId: string;
  stars: number;
}

export interface SubmitRatingsInput {
  eventId: string;
  raterId: string;
  ratings: RatingEntry[];
}

/**
 * Keeps only real ratings: 0 stars means "not rated" and is dropped, anything
 * else must be 1–5. Rating the same player twice in one batch is rejected.
 */
export function ratingsToSave(ratings: RatingEntry[]): RatingEntry[] {
  const kept = ratings.filter((r) => r.stars !== 0);
  for (const r of kept) {
    if (!Number.isInteger(r.stars) || r.stars < MIN_STARS || r.stars > MAX_STARS) {
      throw new DomainError('VALIDATION', 'Stars must be from 1 to 5');
    }
  }
  if (new Set(kept.map((r) => r.rateeId)).size !== kept.length) {
    throw new DomainError('VALIDATION', 'Each player can be rated only once');
  }
  return kept;
}

/**
 * Submit star ratings for several co-players at once (immutable, optional).
 * All-or-nothing: if any rating breaks a rule, none are saved. The DB unique
 * key on (event, rater, ratee) backs up the "only once" rule against races.
 * Returns how many ratings were saved.
 */
export async function submitRatings(
  prisma: PrismaClient,
  input: SubmitRatingsInput,
): Promise<number> {
  const ratings = ratingsToSave(input.ratings);
  if (ratings.length === 0) return 0;

  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { status: true, finishedAt: true },
  });
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');

  const userIds = [input.raterId, ...ratings.map((r) => r.rateeId)];
  const [participants, already] = await Promise.all([
    prisma.eventParticipant.findMany({
      where: { eventId: input.eventId, userId: { in: userIds } },
      select: { userId: true, status: true },
    }),
    prisma.rating.findMany({
      where: {
        eventId: input.eventId,
        raterId: input.raterId,
        rateeId: { in: ratings.map((r) => r.rateeId) },
      },
      select: { rateeId: true },
    }),
  ]);
  const attended = new Set(
    participants.filter((p) => p.status === 'ATTENDED').map((p) => p.userId),
  );
  const alreadyRated = new Set(already.map((r) => r.rateeId));
  const now = new Date();

  for (const r of ratings) {
    assertRatable({
      eventStatus: event.status,
      finishedAt: event.finishedAt,
      now,
      isSelf: input.raterId === r.rateeId,
      raterAttended: attended.has(input.raterId),
      rateeAttended: attended.has(r.rateeId),
      alreadyRated: alreadyRated.has(r.rateeId),
    });
  }

  const { count } = await prisma.rating.createMany({
    data: ratings.map((r) => ({
      eventId: input.eventId,
      raterId: input.raterId,
      rateeId: r.rateeId,
      stars: r.stars,
    })),
  });
  return count;
}
