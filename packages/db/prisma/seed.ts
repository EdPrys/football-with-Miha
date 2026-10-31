import { prisma } from '../src/index.js';
import { buildCatalogPlan, importCatalog } from './seed-catalog.mjs';

async function main() {
  // Use the same verified research, deterministic IDs and null-only enrichment
  // as the Railway utility. Seed never recreates fictional demonstration venues.
  const plan = buildCatalogPlan();
  const result = await importCatalog(prisma, plan);
  console.log('Verified catalogue seeded:', {
    createdVenues: result.createdVenues.length,
    createdFields: result.createdFields.length,
    updatedVenues: result.updatedVenues.length,
    updatedFields: result.updatedFields.length,
    deferred: plan.deferred.length,
  });
}

main()
  .catch(() => {
    console.error(
      'Verified catalogue seed failed. Apply migrations and check catalogue source data.',
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
