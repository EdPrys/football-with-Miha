import type { PrismaClient } from '@app/db';

/** Cohort observations, never proof that a specific Telegram person signed up.
 * No emails, names, phones, messages, or user/event IDs leave this service. */
export async function outreachMetrics(prisma: PrismaClient, campaign: string) {
  return prisma.$transaction(
    async (tx) => {
      const users = await tx.user.findMany({
        where: { signupSource: 'telegram', signupMedium: 'outreach', signupCampaign: campaign },
        select: { id: true, role: true },
      });
      const ids = users.map((u) => u.id),
        cohort = new Set(ids);
      const games = ids.length
        ? await tx.event.findMany({
            where: { organizerId: { in: ids }, status: { not: 'CANCELLED' } },
            select: {
              organizerId: true,
              status: true,
              participants: {
                where: { status: { in: ['JOINED', 'ATTENDED'] } },
                select: { userId: true, status: true },
              },
            },
          })
        : [];
      const players = new Set<string>(),
        newPlayers = new Set<string>(),
        attended = new Set<string>();
      const createdBy = new Map<string, number>(),
        finishedBy = new Map<string, number>();
      for (const game of games) {
        createdBy.set(game.organizerId, (createdBy.get(game.organizerId) ?? 0) + 1);
        if (game.status === 'FINISHED')
          finishedBy.set(game.organizerId, (finishedBy.get(game.organizerId) ?? 0) + 1);
        for (const p of game.participants) {
          if (p.userId === game.organizerId) continue;
          players.add(p.userId);
          if (cohort.has(p.userId)) newPlayers.add(p.userId);
          if (game.status === 'FINISHED' && p.status === 'ATTENDED') attended.add(p.userId);
        }
      }
      return {
        registeredUsers: users.length,
        organizers: users.filter((u) => u.role === 'MANAGER' || u.role === 'ADMIN').length,
        gamesCreated: games.length,
        gamesFinished: games.filter((g) => g.status === 'FINISHED').length,
        playersJoined: players.size,
        newPlayersJoined: newPlayers.size,
        playersAttended: attended.size,
        organizersWithRepeatGames: [...createdBy.values()].filter((n) => n >= 2).length,
        organizersWithRepeatFinishedGames: [...finishedBy.values()].filter((n) => n >= 2).length,
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
