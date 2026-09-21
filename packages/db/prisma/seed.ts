import { prisma } from '../src/index.js';

async function main() {
  // Venues with fields (MVP assumes fields already exist in the system).
  const hub = await prisma.venue.upsert({
    where: { id: 'seed-venue-hub' },
    update: {},
    create: {
      id: 'seed-venue-hub',
      name: 'Football Hub',
      city: 'Kyiv',
      fields: {
        create: [
          { id: 'seed-field-hub-1', name: 'Field #1', capacity: 10 },
          { id: 'seed-field-hub-2', name: 'Field #2', capacity: 12 },
          { id: 'seed-field-hub-3', name: 'Field #3', capacity: 14 },
        ],
      },
    },
  });

  const arena = await prisma.venue.upsert({
    where: { id: 'seed-venue-arena' },
    update: {},
    create: {
      id: 'seed-venue-arena',
      name: 'City Arena',
      city: 'Kyiv',
      fields: {
        create: [{ id: 'seed-field-arena-1', name: 'Main Pitch', capacity: 22 }],
      },
    },
  });

  console.log('Seeded venues:', hub.name, '/', arena.name);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
