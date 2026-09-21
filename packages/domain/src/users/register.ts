import type { PrismaClient, User } from '@app/db';
import { DomainError } from '../errors.js';
import { ALL_SKILLS } from '../skills/constants.js';

export interface RegisterInput {
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
}

/**
 * Registering a user also creates their football profile with all six skills
 * initialized to zero. Email uniqueness is enforced by the DB; we translate the
 * collision into a domain CONFLICT.
 */
export async function createUserWithProfile(
  prisma: PrismaClient,
  input: RegisterInput,
): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new DomainError('CONFLICT', 'Email is already registered');

  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: input.passwordHash,
      avatarUrl: input.avatarUrl,
      profile: {
        create: {
          skills: {
            create: ALL_SKILLS.map((skill) => ({ skill, value: 0, ratingsCount: 0 })),
          },
        },
      },
    },
  });
}
