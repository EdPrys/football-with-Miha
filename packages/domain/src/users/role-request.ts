import type { PrismaClient, RoleRequest } from '@app/db';
import { DomainError } from '../errors.js';
import { roleAtLeast, type RoleName } from '../auth/roles.js';

/**
 * While the community is small every organizer request is granted on the
 * spot. Flip to false to leave requests PENDING for an admin to review.
 */
export const AUTO_APPROVE_ORGANIZER = true;

export interface OrganizerRequestContext {
  currentRole: RoleName;
  hasPendingRequest: boolean;
}

/** Pure invariant check: who may ask to become an organizer. */
export function assertCanRequestOrganizer(ctx: OrganizerRequestContext): void {
  if (roleAtLeast(ctx.currentRole, 'MANAGER')) {
    throw new DomainError('CONFLICT', 'You already have organizer rights');
  }
  if (ctx.hasPendingRequest) {
    throw new DomainError('CONFLICT', 'Your request is already under review');
  }
}

/**
 * A player asks to become an organizer (MANAGER: create events, venues and
 * fields). The request is recorded and, under auto-approval, the role is
 * raised in the same transaction.
 */
export async function requestOrganizerRole(
  prisma: PrismaClient,
  userId: string,
): Promise<RoleRequest> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new DomainError('NOT_FOUND', 'User not found');
    const pending = await tx.roleRequest.count({ where: { userId, status: 'PENDING' } });
    assertCanRequestOrganizer({ currentRole: user.role, hasPendingRequest: pending > 0 });

    if (!AUTO_APPROVE_ORGANIZER) {
      return tx.roleRequest.create({ data: { userId, role: 'MANAGER' } });
    }
    await tx.user.update({ where: { id: userId }, data: { role: 'MANAGER' } });
    return tx.roleRequest.create({
      data: { userId, role: 'MANAGER', status: 'APPROVED', decidedAt: new Date() },
    });
  });
}
