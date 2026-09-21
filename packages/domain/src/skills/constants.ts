export const ALL_SKILLS = [
  'PACE',
  'DRIBBLING',
  'PASSING',
  'SHOOTING',
  'DEFENDING',
  'PHYSICAL',
] as const;

export type SkillName = (typeof ALL_SKILLS)[number];
