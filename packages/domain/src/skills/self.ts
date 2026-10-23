import type { PrismaClient } from '@app/db';
import { DomainError } from '../errors.js';
import { ALL_SKILLS, type SkillName } from './constants.js';

export const MIN_SKILL = 1;
export const MAX_SKILL = 100;

export type SkillValues = Record<SkillName, number>;

/** Pure validation of a self-assessment: every skill, whole numbers 1–100. */
export function assertValidSkills(values: SkillValues): void {
  for (const skill of ALL_SKILLS) {
    const v = values[skill];
    if (!Number.isInteger(v) || v < MIN_SKILL || v > MAX_SKILL) {
      throw new DomainError('VALIDATION', 'Each skill must be from 1 to 100');
    }
  }
}

/** Players assess their own skills; peers only give overall stars. */
export async function setOwnSkills(
  prisma: PrismaClient,
  userId: string,
  values: SkillValues,
): Promise<void> {
  assertValidSkills(values);
  const profile = await prisma.playerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) throw new DomainError('NOT_FOUND', 'Player not found');

  await prisma.$transaction(
    ALL_SKILLS.map((skill) =>
      prisma.playerSkill.upsert({
        where: { profileId_skill: { profileId: profile.id, skill } },
        update: { value: values[skill] },
        create: { profileId: profile.id, skill, value: values[skill] },
      }),
    ),
  );
}
