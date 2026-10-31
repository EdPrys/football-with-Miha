import { writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildCatalogPlan, catalogDirectory, createCatalogRuntime } from './seed-catalog.mjs';

const SENTINEL = 'CATALOG_RESULT=';

// The factory is serialized from the same helper imported by seed.ts. No
// duplicate normalization, access criteria or preservation rules live here.
async function remoteMain(command, plan, createRuntime) {
  const { PrismaClient } = require('/app/packages/db/node_modules/@prisma/client');
  const prisma = new PrismaClient({ log: [] });
  const emit = (value) => console.log('CATALOG_RESULT=' + JSON.stringify(value));
  try {
    if (command === 'audit') {
      const [cityCount, venueCount, fieldCount, cities, venues] = await Promise.all([
        prisma.city.count(),
        prisma.venue.count(),
        prisma.field.count(),
        prisma.city.findMany({
          take: 1000,
          orderBy: { id: 'asc' },
          select: { id: true, name: true, _count: { select: { venues: true } } },
        }),
        prisma.venue.findMany({
          take: 1000,
          orderBy: [{ cityId: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            cityId: true,
            address: true,
            latitude: true,
            longitude: true,
            contactPhone: true,
            websiteUrl: true,
            totalFields: true,
            hasChangingRooms: true,
            hasShowers: true,
            hasParking: true,
            sourceUrl: true,
            verifiedAt: true,
            _count: { select: { fields: true } },
            fields: {
              take: 100,
              orderBy: { id: 'asc' },
              select: {
                id: true,
                name: true,
                capacity: true,
                isActive: true,
                environment: true,
                surface: true,
                hasLighting: true,
                lengthMeters: true,
                widthMeters: true,
                _count: { select: { events: true } },
              },
            },
          },
        }),
      ]);
      emit({
        ok: true,
        command,
        cityCount,
        venueCount,
        fieldCount,
        cities,
        venues,
        truncated:
          cityCount > cities.length ||
          venueCount > venues.length ||
          venues.some((venue) => venue._count.fields > venue.fields.length),
      });
      return;
    }
    if (command !== 'apply') throw new Error('INVALID_PLAN');
    const result = await createRuntime().importCatalog(prisma, plan);
    emit({ ok: true, command, ...result });
  } catch (error) {
    const safe = new Set([
      'INVALID_PLAN',
      'INVALID_METADATA',
      'CITY_NOT_FOUND',
      'AMBIGUOUS_EXISTING_VENUE',
      'AMBIGUOUS_EXISTING_FIELD',
    ]);
    emit({
      ok: false,
      command,
      code: safe.has(error.message)
        ? error.message
        : /^P\d{4}$/.test(error.code ?? '')
          ? error.code
          : 'CATALOG_OPERATION_FAILED',
    });
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

function main() {
  const command = process.argv[2] ?? 'plan';
  if (command === 'plan') {
    const plan = buildCatalogPlan();
    const planPath = join(catalogDirectory, 'import-ready.json');
    writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
    console.log(
      JSON.stringify({
        command,
        file: relative(process.cwd(), planPath),
        checkedAt: plan.checkedAt,
        readyVenues: plan.ready.length,
        readyFields: plan.ready.reduce((sum, venue) => sum + venue.fields.length, 0),
        unknownCapacityFields: plan.ready.reduce(
          (sum, venue) => sum + venue.fields.filter((field) => field.capacity == null).length,
          0,
        ),
        deferred: plan.deferred.length,
      }),
    );
    return;
  }
  if (!['apply', 'audit'].includes(command)) throw new Error('Use plan, apply, or audit');
  // Both seed and apply rebuild from reviewed research. import-ready.json is a
  // reviewable snapshot, never an alternate write source or hand-edited override.
  const plan = command === 'apply' ? { ready: buildCatalogPlan().ready } : null;
  const script = `(${remoteMain.toString()})(${JSON.stringify(command)},${JSON.stringify(plan)},${createCatalogRuntime.toString()}).catch(()=>{console.log('CATALOG_RESULT='+JSON.stringify({ok:false,code:'CATALOG_RUNTIME_FAILED'}));process.exitCode=1;});`;
  const child = spawnSync(
    'railway',
    ['ssh', '--service', 'api', '--environment', 'production', '--', 'node', '-e', script],
    { encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 },
  );
  // Provider diagnostics can contain connection details. Emit only our bounded
  // constructed JSON instead of forwarding arbitrary stdout/stderr.
  const line = (child.stdout ?? '').split(/\r?\n/).findLast((item) => item.startsWith(SENTINEL));
  if (!line) throw new Error('No catalogue result received; Railway diagnostics suppressed');
  const result = JSON.parse(line.slice(SENTINEL.length));
  console.log(SENTINEL + JSON.stringify(result));
  if (child.error || child.status !== 0 || !result.ok) process.exitCode = 1;
}

try {
  main();
} catch {
  console.error(
    'Catalogue command failed. No credentials or raw provider diagnostics were printed.',
  );
  process.exitCode = 1;
}
