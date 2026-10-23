import type { EventStatus, PrismaClient, Rating } from '@app/db';
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

export interface SubmitRatingInput {
  eventId: string;
  raterId: string;
  rateeId: string;
  stars: number;
}

/**
 * Submit a star rating (immutable, optional for players). The DB unique key on
 * (event, rater, ratee) backs up the "only once" rule against races.
 */
export async function submitRating(
  prisma: PrismaClient,
  input: SubmitRatingInput,
): Promise<Rating> {
  if (!Number.isInteger(input.stars) || input.stars < MIN_STARS || input.stars > MAX_STARS) {
    throw new DomainError('VALIDATION', 'Stars must be from 1 to 5');
  }

  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { status: true, finishedAt: true },
  });
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');

  const [rater, ratee, already] = await Promise.all([
    prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId: input.eventId, userId: input.raterId } },
      select: { status: true },
    }),
    prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId: input.eventId, userId: input.rateeId } },
      select: { status: true },
    }),
    prisma.rating.findUnique({
      where: {
        eventId_raterId_rateeId: {
          eventId: input.eventId,
          raterId: input.raterId,
          rateeId: input.rateeId,
        },
      },
      select: { id: true },
    }),
  ]);

  assertRatable({
    eventStatus: event.status,
    finishedAt: event.finishedAt,
    now: new Date(),
    isSelf: input.raterId === input.rateeId,
    raterAttended: rater?.status === 'ATTENDED',
    rateeAttended: ratee?.status === 'ATTENDED',
    alreadyRated: !!already,
  });

  return prisma.rating.create({
    data: {
      eventId: input.eventId,
      raterId: input.raterId,
      rateeId: input.rateeId,
      stars: input.stars,
    },
  });
}
