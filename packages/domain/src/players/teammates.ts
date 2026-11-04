import type { PrismaClient } from '@app/db';
import { starSummariesFor } from '../ratings/stars.js';

const PAGE_SIZE = 24;

/** Players who actually attended the same finished game, on either team.
 * Derived from attendance so old games work too, without a friendship table.
 */
export async function teammatesFor(prisma: PrismaClient, userId: string, page: number) {
  const groups = await prisma.eventParticipant.groupBy({
    by: ['userId'],
    where: {
      userId: { not: userId },
      status: 'ATTENDED',
      event: {
        status: 'FINISHED',
        participants: { some: { userId, status: 'ATTENDED' } },
      },
    },
    _count: { _all: true },
    orderBy: [{ _count: { userId: 'desc' } }, { userId: 'asc' }],
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE + 1,
  });
  const visible = groups.slice(0, PAGE_SIZE);
  const ids = visible.map((g) => g.userId);
  const [users, stars] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, avatarUrl: true, city: { select: { name: true } } },
    }),
    starSummariesFor(prisma, ids),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  return {
    items: visible.flatMap((g) => {
      const user = byId.get(g.userId);
      return user ? [{ ...user, sharedMatches: g._count._all, stars: stars.get(g.userId)! }] : [];
    }),
    hasMore: groups.length > PAGE_SIZE,
  };
}
