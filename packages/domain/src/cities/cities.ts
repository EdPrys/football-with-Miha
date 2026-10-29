import type { PrismaClient } from '@app/db';
import { DomainError } from '../errors.js';

/** Everyone is based in Kyiv until they pick another city. */
export const DEFAULT_CITY_ID = 'kyiv';

/** Kyiv first (where most players are), then alphabetically in Ukrainian. */
export function sortCities<T extends { id: string; name: string }>(cities: T[]): T[] {
  return [...cities].sort((a, b) => {
    if (a.id === DEFAULT_CITY_ID) return -1;
    if (b.id === DEFAULT_CITY_ID) return 1;
    return a.name.localeCompare(b.name, 'uk');
  });
}

/** Throws NOT_FOUND unless the city exists, so users/venues never point at a missing one. */
export async function assertCityExists(prisma: PrismaClient, cityId: string): Promise<void> {
  const city = await prisma.city.findUnique({ where: { id: cityId }, select: { id: true } });
  if (!city) throw new DomainError('NOT_FOUND', 'City not found');
}

/** A player changes the city they are based in. */
export async function setUserCity(
  prisma: PrismaClient,
  userId: string,
  cityId: string,
): Promise<void> {
  await assertCityExists(prisma, cityId);
  await prisma.user.update({ where: { id: userId }, data: { cityId } });
}
