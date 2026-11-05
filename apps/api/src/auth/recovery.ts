import { createHash, createHmac, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { TRPCError } from '@trpc/server';
import {
  assertPasswordResetValid,
  completePasswordReset,
  issuePasswordReset,
  takeRecoveryAttempt,
  assertValidPassword,
} from '@app/domain';
import type { Context } from '../context.js';
import { env } from '../env.js';
import { hashPassword } from './password.js';
import { passwordMailConfig, sendPasswordResetEmail } from '../integrations/password-mail.js';

export function resetTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function budgetKey(scope: string, value: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(`${scope}:${value}`).digest('hex');
}

async function limitIp(ctx: Context, action: string) {
  if (!(await takeRecoveryAttempt(ctx.prisma, budgetKey(action, ctx.clientIp ?? 'unknown'), 20)))
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
}

export async function requestPasswordRecovery(ctx: Context, email: string) {
  const config = passwordMailConfig();
  if (!config)
    throw new TRPCError({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Password recovery is unavailable',
    });
  await limitIp(ctx, 'recovery-request');
  // Account budgets are silent, including for addresses with no account.
  const started = Date.now();
  try {
    if (
      !(await takeRecoveryAttempt(ctx.prisma, budgetKey('recovery-email', email.toLowerCase()), 3))
    )
      return { ok: true as const };
    const token = randomBytes(32).toString('hex');
    const target = await issuePasswordReset(ctx.prisma, email, resetTokenHash(token));
    if (target) {
      // Provider latency/outcome must not reveal whether the account exists.
      // No automatic retry after an uncertain send. A fresh request is allowed
      // after the account cooldown; failures are visible without secrets in logs.
      void sendPasswordResetEmail(config, target.email, token).catch(() => {
        console.error('Password recovery email delivery failed');
      });
    }
    return { ok: true as const };
  } finally {
    // Mask the small difference between the missing-user and token-write paths.
    await delay(Math.max(0, 300 - (Date.now() - started)));
  }
}

export async function resetPassword(ctx: Context, token: string, password: string) {
  await limitIp(ctx, 'recovery-reset');
  assertValidPassword(password);
  const tokenHash = resetTokenHash(token);
  await assertPasswordResetValid(ctx.prisma, tokenHash);
  const passwordHash = await hashPassword(password);
  await completePasswordReset(ctx.prisma, tokenHash, passwordHash);
  return { ok: true as const };
}
