import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@app/db';
import { outreachMetrics } from '@app/domain';
import { z } from 'zod';

/** Dedicated read-only capability; never accepts a user/admin JWT or DB credentials. */
export function registerOutreachMetrics(app: FastifyInstance, prisma: PrismaClient) {
  const token = process.env.OUTREACH_METRICS_TOKEN;
  if (!token) return;
  if (token.length < 32) throw new Error('OUTREACH_METRICS_TOKEN must have 32+ characters');
  const prefix = process.env.OUTREACH_CAMPAIGN_PREFIX ?? 'organizers_pilot';
  if (!/^[a-z0-9_]{1,100}$/.test(prefix)) throw new Error('Invalid OUTREACH_CAMPAIGN_PREFIX');
  const schema = z
    .object({ campaign: z.string().regex(/^[a-z0-9_]{1,100}__[a-f0-9]{16}$/) })
    .strict();
  app.post(
    '/internal/outreach/metrics',
    { bodyLimit: 1024, logLevel: 'silent' },
    async (req, reply) => {
      reply.header('Cache-Control', 'no-store');
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'Unauthorized' });
      const supplied = Buffer.from(auth.slice(7)),
        expected = Buffer.from(token);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
        return reply.code(401).send({ error: 'Unauthorized' });
      const input = schema.safeParse(req.body);
      if (!input.success || !input.data.campaign.startsWith(prefix + '__'))
        return reply.code(400).send({ error: 'Invalid campaign' });
      return outreachMetrics(prisma, input.data.campaign);
    },
  );
}
