import type { PrismaClient } from '@app/db';
import { DomainError } from '../errors.js';

export const PASSWORD_RESET_MINUTES = 30;
export const PASSWORD_RESET_COOLDOWN_SECONDS = 60;
export const INVALID_RESET = 'Password reset link is invalid or expired';

/** Atomic fixed-window budget shared by every API instance. */
export async function takeRecoveryAttempt(
  prisma: PrismaClient,
  key: string,
  limit: number,
  now = new Date(),
): Promise<boolean> {
  const expiresAt = new Date(now.getTime() + 15 * 60_000);
  const [row] = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "AuthRateLimit" ("key", "count", "expiresAt")
    VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "AuthRateLimit"."expiresAt" <= ${now} THEN 1
        ELSE LEAST("AuthRateLimit"."count" + 1, ${limit + 1}) END,
      "expiresAt" = CASE WHEN "AuthRateLimit"."expiresAt" <= ${now}
        THEN ${expiresAt} ELSE "AuthRateLimit"."expiresAt" END
    RETURNING "count"
  `;
  return !!row && row.count <= limit;
}

/** Case-insensitive recovery only when the address identifies exactly one account.
 * Older registrations may differ only by case; never guess which one to reset.
 */
export async function issuePasswordReset(
  prisma: PrismaClient,
  email: string,
  tokenHash: string,
  now = new Date(),
): Promise<{ userId: string; email: string } | null> {
  const users = await prisma.user.findMany({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true },
    take: 2,
  });
  if (users.length !== 1) return null;
  const user = users[0]!;
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
    const previous = await tx.passwordReset.findUnique({ where: { userId: user.id } });
    if (
      previous &&
      now.getTime() - previous.createdAt.getTime() < PASSWORD_RESET_COOLDOWN_SECONDS * 1000
    )
      return null;
    const data = {
      tokenHash,
      createdAt: now,
      expiresAt: new Date(now.getTime() + PASSWORD_RESET_MINUTES * 60_000),
      usedAt: null,
    };
    await tx.passwordReset.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });
    return { userId: user.id, email: user.email };
  });
}

/** Cheap check before spending CPU hashing a proposed password. Consumption is
 * rechecked under the account lock, so concurrent submissions cannot both win.
 */
export async function assertPasswordResetValid(
  prisma: PrismaClient,
  tokenHash: string,
  now = new Date(),
): Promise<void> {
  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash } });
  if (!reset || reset.usedAt || reset.expiresAt <= now)
    throw new DomainError('VALIDATION', INVALID_RESET);
}

export async function completePasswordReset(
  prisma: PrismaClient,
  tokenHash: string,
  passwordHash: string,
  now?: Date,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const reset = await tx.passwordReset.findUnique({ where: { tokenHash } });
    if (!reset) throw new DomainError('VALIDATION', INVALID_RESET);
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${reset.userId} FOR UPDATE`;
    const consumedAt = now ?? new Date();
    const claimed = await tx.passwordReset.updateMany({
      where: { userId: reset.userId, tokenHash, usedAt: null, expiresAt: { gt: consumedAt } },
      data: { usedAt: consumedAt },
    });
    if (claimed.count !== 1) throw new DomainError('VALIDATION', INVALID_RESET);
    await tx.user.update({
      where: { id: reset.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
  });
}
