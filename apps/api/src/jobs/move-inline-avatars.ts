import type { FastifyBaseLogger } from 'fastify';
import { prisma } from '@app/db';
import { avatarStorageEnabled, storeAvatar } from '../integrations/avatar-storage.js';

/**
 * One-off on startup: move avatars still stored inline (data URLs from before
 * the bucket existed) into the bucket. Idempotent — once none are left it's a
 * single cheap query. A user who changed their avatar meanwhile is skipped.
 */
export async function moveInlineAvatars(log: FastifyBaseLogger): Promise<void> {
  if (!avatarStorageEnabled) return;
  const users = await prisma.user.findMany({
    where: { avatarUrl: { startsWith: 'data:' } },
    select: { id: true, avatarUrl: true },
  });
  let moved = 0;
  for (const u of users) {
    try {
      const url = await storeAvatar(u.id, u.avatarUrl!);
      const { count } = await prisma.user.updateMany({
        where: { id: u.id, avatarUrl: u.avatarUrl },
        data: { avatarUrl: url },
      });
      moved += count;
    } catch (err) {
      log.error({ err, userId: u.id }, 'avatars: failed to move inline avatar');
    }
  }
  if (users.length)
    log.info({ moved, found: users.length }, 'avatars: moved inline avatars to bucket');
}
