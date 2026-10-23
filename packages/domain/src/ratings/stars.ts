import type { PrismaClient } from '@app/db';
import { averageAggregator, type SkillAggregator } from '../skills/aggregate.js';

/**
 * How a player's received stars become the number shown under their avatar.
 * Swap the algorithm here (Bayesian, recency-weighted, ...) without touching callers.
 */
export const starAggregator: SkillAggregator = averageAggregator;

export interface StarSummary {
  /** Rounded to 1 decimal; null until someone rated the player. */
  average: number | null;
  count: number;
}

export function summarizeStars(values: number[]): StarSummary {
  const { value, count } = starAggregator.aggregate(values);
  return { average: count > 0 ? value : null, count };
}

/** Star summaries for many players at once (pitch lineups, lists). */
export async function starSummariesFor(
  prisma: PrismaClient,
  userIds: string[],
): Promise<Map<string, StarSummary>> {
  const ratings = userIds.length
    ? await prisma.rating.findMany({
        where: { rateeId: { in: userIds } },
        select: { rateeId: true, stars: true },
      })
    : [];
  const byUser = new Map<string, number[]>();
  for (const r of ratings) byUser.set(r.rateeId, [...(byUser.get(r.rateeId) ?? []), r.stars]);
  return new Map(userIds.map((id) => [id, summarizeStars(byUser.get(id) ?? [])]));
}
