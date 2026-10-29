import type { FastifyBaseLogger } from 'fastify';
import { prisma } from '@app/db';
import { finishOverdueEvents, resolveDueMvps } from '@app/domain';

const INTERVAL_MS = 5 * 60 * 1000;

/**
 * Every 5 minutes: close games the organizer forgot to finish
 * (finishOverdueEvents) and decide MVPs whose 24h voting window has passed
 * (resolveDueMvps). In-process and cheap: a couple of indexed queries per
 * tick. Both are idempotent, so overlapping runs or replicas are safe.
 */
export function startScheduler(log: FastifyBaseLogger): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const { finished, cancelled } = await finishOverdueEvents(prisma);
      if (finished.length || cancelled.length) {
        log.info({ finished, cancelled }, 'auto-finish: closed overdue games');
      }
      const mvps = await resolveDueMvps(prisma);
      if (mvps.length) log.info({ events: mvps }, 'mvp: voting closed');
    } catch (err) {
      log.error(err, 'scheduler tick failed');
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
