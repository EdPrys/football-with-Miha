import type { PrismaClient } from '@app/db';
import { skillAggregator } from './aggregate.js';
import { ALL_SKILLS, type SkillName } from './constants.js';

/** Maps a SkillType enum value to the Rating column that stores its score. */
const RATING_FIELD: Record<
  SkillName,
  'pace' | 'dribbling' | 'passing' | 'shooting' | 'defending' | 'physical'
> = {
  PACE: 'pace',
  DRIBBLING: 'dribbling',
  PASSING: 'passing',
  SHOOTING: 'shooting',
  DEFENDING: 'defending',
  PHYSICAL: 'physical',
};

/**
 * Recomputes every skill for a player from ALL ratings they have received,
 * using the swappable {@link skillAggregator}. Called after a rating is submitted.
 */
export async function recomputePlayerSkills(prisma: PrismaClient, userId: string): Promise<void> {
  const profile = await prisma.playerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return;

  const ratings = await prisma.rating.findMany({
    where: { rateeId: userId },
    select: {
      pace: true,
      dribbling: true,
      passing: true,
      shooting: true,
      defending: true,
      physical: true,
    },
  });

  for (const skill of ALL_SKILLS) {
    const values = ratings.map((r) => r[RATING_FIELD[skill]]);
    const agg = skillAggregator.aggregate(values);
    await prisma.playerSkill.upsert({
      where: { profileId_skill: { profileId: profile.id, skill } },
      update: { value: agg.value, ratingsCount: agg.count },
      create: { profileId: profile.id, skill, value: agg.value, ratingsCount: agg.count },
    });
  }
}
