import type { PrismaClient } from '@app/db';
import { DomainError } from '../errors.js';

/** City-specific, persistent, in-app only; unsubscribe touches only the caller. */
export async function setCityGameSubscription(
  prisma: PrismaClient,
  userId: string,
  cityId: string,
  subscribed: boolean,
) {
  if (!subscribed) {
    await prisma.cityGameSubscription.deleteMany({ where: { userId, cityId } });
    return { subscribed: false };
  }
  const city = await prisma.city.findUnique({ where: { id: cityId } });
  if (!city) throw new DomainError('NOT_FOUND', 'City not found');
  await prisma.cityGameSubscription.upsert({
    where: { userId_cityId: { userId, cityId } },
    create: { userId, cityId },
    update: {},
  });
  return { subscribed: true };
}
