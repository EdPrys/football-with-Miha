import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { DomainError, type DomainErrorCode } from '@app/domain';
import type { Context } from './context.js';

const t = initTRPC.context<Context>().create({ transformer: superjson });

const CODE_MAP: Record<DomainErrorCode, TRPCError['code']> = {
  VALIDATION: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_STATE: 'BAD_REQUEST',
};

/** Translate thrown DomainErrors into the matching tRPC error code. */
const mapDomainErrors = t.middleware(async ({ next }) => {
  const result = await next();
  // tRPC captures a thrown error on the result (as a TRPCError whose `cause`
  // is the original), rather than rejecting — so inspect it here.
  if (!result.ok && result.error.cause instanceof DomainError) {
    const domain = result.error.cause;
    throw new TRPCError({ code: CODE_MAP[domain.code], message: domain.message });
  }
  return result;
});

export const router = t.router;
export const publicProcedure = t.procedure.use(mapDomainErrors);

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
