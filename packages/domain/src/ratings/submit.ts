import type { EventStatus, PrismaClient, Rating } from '@app/db';
import { DomainError } from '../errors.js';
import { recomputePlayerSkills } from '../skills/recompute.js';

export interface RatingScores {
  pace: number;
  dribbling: number;
  passing: number;
  shooting: number;
  defending: number;
  physical: number;
}

export interface RatableContext {
  eventStatus: EventStatus;
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
  scores: RatingScores;
}

/** Submit a rating (immutable) and recompute the ratee's skills. */
export async function submitRating(
  prisma: PrismaClient,
  input: SubmitRatingInput,
): Promise<Rating> {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { status: true },
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
    isSelf: input.raterId === input.rateeId,
    raterAttended: rater?.status === 'ATTENDED',
    rateeAttended: ratee?.status === 'ATTENDED',
    alreadyRated: !!already,
  });

  const rating = await prisma.rating.create({
    data: {
      eventId: input.eventId,
      raterId: input.raterId,
      rateeId: input.rateeId,
      ...input.scores,
    },
  });

  await recomputePlayerSkills(prisma, input.rateeId);
  return rating;
}
