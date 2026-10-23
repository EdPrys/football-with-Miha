import type { FastifyBaseLogger } from 'fastify';
import { prisma } from '@app/db';
import { finishOverdueEvents } from '@app/domain';

const INTERVAL_MS = 5 * 60 * 1000;

/**
 * Every 5 minutes, close games the organizer forgot to finish (see
 * finishOverdueEvents). In-process and cheap: one indexed query per tick.
 * The domain logic is idempotent, so overlapping runs or replicas are safe.
 */
export function startAutoFinishJob(log: FastifyBaseLogger): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const { finished, cancelled } = await finishOverdueEvents(prisma);
      if (finished.length || cancelled.length) {
        log.info({ finished, cancelled }, 'auto-finish: closed overdue games');
      }
    } catch (err) {
      log.error(err, 'auto-finish failed');
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
