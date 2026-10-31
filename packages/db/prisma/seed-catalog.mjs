import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const catalogDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../data/venues',
);

/**
 * Self-contained so Railway can execute exactly the same validation/import code
 * as the seed. Do not close over module imports or constants in this function.
 */
export function createCatalogRuntime() {
  const accessStatuses = new Set(['rental-confirmed', 'amateur-use-confirmed']);
  const environments = new Set(['OPEN_AIR', 'COVERED', 'INDOOR']);
  const surfaces = new Set([
    'NATURAL_GRASS',
    'ARTIFICIAL_TURF',
    'PARQUET',
    'RUBBER',
    'HARD_COURT',
    'OTHER',
  ]);
  const venueKeys = [
    'address',
    'latitude',
    'longitude',
    'contactPhone',
    'websiteUrl',
    'totalFields',
    'hasChangingRooms',
    'hasShowers',
    'hasParking',
    'sourceUrl',
    'verifiedAt',
  ];
  const fieldKeys = [
    'capacity',
    'environment',
    'surface',
    'hasLighting',
    'lengthMeters',
    'widthMeters',
  ];
  const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
  const normalize = (value) =>
    value
      .normalize('NFKC')
      .toLocaleLowerCase('uk-UA')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  const httpUrl = (value) => {
    if (!nonempty(value)) return false;
    try {
      return ['https:', 'http:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  };
  const validDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const nullable = (value) => value === null || value === undefined;
  const positive = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;
  const validCapacity = (value) => nullable(value) || (Number.isSafeInteger(value) && value > 0);
  const assertOptional = (object, key, valid) => {
    if (!nullable(object[key]) && !valid(object[key])) throw new Error('INVALID_METADATA');
  };
  const venueMetadata = (venue) => {
    for (const key of ['address', 'contactPhone']) assertOptional(venue, key, nonempty);
    assertOptional(venue, 'websiteUrl', httpUrl);
    assertOptional(venue, 'latitude', (n) => Number.isFinite(n) && n >= -90 && n <= 90);
    assertOptional(venue, 'longitude', (n) => Number.isFinite(n) && n >= -180 && n <= 180);
    assertOptional(venue, 'totalFields', (n) => Number.isSafeInteger(n) && n >= 0);
    for (const key of ['hasChangingRooms', 'hasShowers', 'hasParking'])
      assertOptional(venue, key, (value) => typeof value === 'boolean');
    if (!httpUrl(venue.sourceUrl) || !validDate(venue.checkedAt)) throw new Error('INVALID_PLAN');
    // Copy only explicit, supported values. Never infer facilities, covering,
    // playing surface, coordinates or player count from names or dimensions.
    return Object.fromEntries([
      ...venueKeys
        .filter((key) => !['sourceUrl', 'verifiedAt'].includes(key) && !nullable(venue[key]))
        .map((key) => [key, typeof venue[key] === 'string' ? venue[key].trim() : venue[key]]),
      ['sourceUrl', venue.sourceUrl],
      ['verifiedAt', new Date(`${venue.checkedAt}T00:00:00.000Z`)],
    ]);
  };
  const fieldMetadata = (field) => {
    if (!validCapacity(field.capacity)) throw new Error('INVALID_METADATA');
    assertOptional(field, 'environment', (value) => environments.has(value));
    assertOptional(field, 'surface', (value) => surfaces.has(value));
    assertOptional(field, 'hasLighting', (value) => typeof value === 'boolean');
    assertOptional(field, 'lengthMeters', positive);
    assertOptional(field, 'widthMeters', positive);
    return Object.fromEntries(
      fieldKeys.filter((key) => !nullable(field[key])).map((key) => [key, field[key]]),
    );
  };
  const fieldEligible = (field) =>
    nonempty(field?.name) &&
    normalize(field.name).length > 0 &&
    validCapacity(field.capacity) &&
    nonempty(field.formatEvidence);

  function validatePlan(plan) {
    if (!Array.isArray(plan?.ready) || plan.ready.length > 500) throw new Error('INVALID_PLAN');
    const seenVenues = new Set();
    const seenIds = new Set();
    for (const venue of plan.ready) {
      if (
        !accessStatuses.has(venue.availability) ||
        !nonempty(venue.id) ||
        !nonempty(venue.cityId) ||
        !nonempty(venue.name) ||
        !normalize(venue.name) ||
        !Array.isArray(venue.fields) ||
        !venue.fields.length ||
        venue.fields.length > 100
      )
        throw new Error('INVALID_PLAN');
      const key = `${venue.cityId}\u0000${normalize(venue.name)}`;
      if (seenVenues.has(key) || seenIds.has(venue.id)) throw new Error('INVALID_PLAN');
      seenVenues.add(key);
      seenIds.add(venue.id);
      venueMetadata(venue);
      const seenFields = new Set();
      for (const field of venue.fields) {
        if (!nonempty(field.id) || !fieldEligible(field)) throw new Error('INVALID_PLAN');
        const fieldKey = normalize(field.name);
        if (seenFields.has(fieldKey) || seenIds.has(field.id)) throw new Error('INVALID_PLAN');
        seenFields.add(fieldKey);
        seenIds.add(field.id);
        fieldMetadata(field);
      }
    }
  }

  // false, 0 and '' are known values, not missing. Respect user-entered data and
  // inactive fields. This importer never changes isActive on existing records.
  const fillUnknown = (current, incoming) =>
    Object.fromEntries(
      Object.entries(incoming).filter(([key, value]) => nullable(current[key]) && !nullable(value)),
    );
  const venueSelect = Object.fromEntries(['id', 'name', ...venueKeys].map((key) => [key, true]));
  const fieldSelect = Object.fromEntries(
    ['id', 'name', 'isActive', ...fieldKeys].map((key) => [key, true]),
  );

  async function importCatalog(prisma, plan) {
    validatePlan(plan);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.$transaction(
          async (tx) => {
            const summary = {
              createdVenues: [],
              matchedVenues: [],
              updatedVenues: [],
              createdFields: [],
              preservedFields: [],
              updatedFields: [],
            };
            const cities = await tx.city.findMany({
              where: { id: { in: [...new Set(plan.ready.map((venue) => venue.cityId))] } },
              select: { id: true },
            });
            const cityIds = new Set(cities.map((city) => city.id));
            for (const incoming of plan.ready) {
              if (!cityIds.has(incoming.cityId)) throw new Error('CITY_NOT_FOUND');
              const candidates = await tx.venue.findMany({
                where: { cityId: incoming.cityId },
                select: venueSelect,
              });
              const matches = candidates.filter(
                (venue) => normalize(venue.name) === normalize(incoming.name),
              );
              if (matches.length > 1) throw new Error('AMBIGUOUS_EXISTING_VENUE');
              let venue = matches[0];
              const metadata = venueMetadata(incoming);
              if (!venue) {
                venue = await tx.venue.create({
                  data: {
                    id: incoming.id,
                    name: incoming.name,
                    cityId: incoming.cityId,
                    ...metadata,
                  },
                  select: venueSelect,
                });
                summary.createdVenues.push({
                  id: venue.id,
                  cityId: incoming.cityId,
                  name: venue.name,
                });
              } else {
                summary.matchedVenues.push({
                  id: venue.id,
                  cityId: incoming.cityId,
                  name: venue.name,
                });
                const data = fillUnknown(venue, metadata);
                if (Object.keys(data).length) {
                  await tx.venue.update({ where: { id: venue.id }, data });
                  summary.updatedVenues.push({ id: venue.id, properties: Object.keys(data) });
                }
              }
              const fields = await tx.field.findMany({
                where: { venueId: venue.id },
                select: fieldSelect,
              });
              for (const incomingField of incoming.fields) {
                const matches = fields.filter(
                  (field) => normalize(field.name) === normalize(incomingField.name),
                );
                if (matches.length > 1) throw new Error('AMBIGUOUS_EXISTING_FIELD');
                const current = matches[0];
                const metadata = fieldMetadata(incomingField);
                if (current) {
                  const data = fillUnknown(current, metadata);
                  if (Object.keys(data).length) {
                    await tx.field.update({ where: { id: current.id }, data });
                    Object.assign(current, data);
                    summary.updatedFields.push({
                      id: current.id,
                      venueId: venue.id,
                      properties: Object.keys(data),
                    });
                  }
                  summary.preservedFields.push({
                    id: current.id,
                    name: current.name,
                    capacity: current.capacity,
                    isActive: current.isActive,
                    venueId: venue.id,
                  });
                  continue;
                }
                const field = await tx.field.create({
                  data: {
                    id: incomingField.id,
                    venueId: venue.id,
                    name: incomingField.name,
                    capacity: null,
                    ...metadata,
                    isActive: true,
                  },
                  select: fieldSelect,
                });
                fields.push(field);
                summary.createdFields.push({
                  id: field.id,
                  venueId: venue.id,
                  name: field.name,
                  capacity: field.capacity,
                  isActive: field.isActive,
                });
              }
            }
            return summary;
          },
          { isolationLevel: 'Serializable', maxWait: 10000, timeout: 60000 },
        );
      } catch (error) {
        if (error.code !== 'P2034' || attempt === 2) throw error;
      }
    }
    throw new Error('CATALOG_OPERATION_FAILED');
  }
  return {
    normalize,
    fieldEligible,
    validatePlan,
    importCatalog,
    accessStatuses,
    venueMetadata,
    fieldMetadata,
  };
}

const runtime = createCatalogRuntime();
export const normalizeCatalogName = runtime.normalize;
export const importCatalog = runtime.importCatalog;
const stableId = (kind, ...parts) =>
  `catalog_${kind}_${createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32)}`;

export function buildCatalogPlan(directory = catalogDirectory) {
  const readyByVenue = new Map();
  const deferred = [];
  const dates = [];
  for (const filename of readdirSync(directory)
    .filter((name) => /^research-.*\.json$/.test(name))
    .sort()) {
    const research = JSON.parse(readFileSync(join(directory, filename), 'utf8'));
    const entries = Array.isArray(research) ? research : research.entries;
    if (!Array.isArray(entries)) throw new Error('INVALID_RESEARCH');
    for (const entry of entries) {
      const base = { ...entry, researchFile: `data/venues/${filename}` };
      const fields = Array.isArray(entry.fields) ? entry.fields : [];
      const reasons = [];
      if (!entry.cityId?.trim() || !entry.name?.trim() || !normalizeCatalogName(entry.name))
        reasons.push('Missing cityId or venue name');
      if (!runtime.accessStatuses.has(entry.availability))
        reasons.push('Amateur field access not confirmed');
      try {
        runtime.venueMetadata(entry);
      } catch {
        reasons.push('Invalid or missing source, verification date, or venue metadata');
      }
      const eligible = fields.filter(runtime.fieldEligible);
      if (!eligible.length)
        reasons.push('No field with verified existence and valid known-or-unknown capacity');
      if (reasons.length) {
        deferred.push({ ...base, reasons });
        continue;
      }
      dates.push(entry.checkedAt);
      const key = `${entry.cityId}\u0000${normalizeCatalogName(entry.name)}`;
      let venue = readyByVenue.get(key);
      if (!venue) {
        const { fields: unused, ...metadata } = base;
        void unused;
        venue = {
          ...metadata,
          id: stableId('venue', entry.cityId, normalizeCatalogName(entry.name)),
          fields: [],
          researchFiles: [base.researchFile],
        };
        readyByVenue.set(key, venue);
      } else {
        if (!venue.researchFiles.includes(base.researchFile))
          venue.researchFiles.push(base.researchFile);
        // Duplicate research may fill unknown metadata; conflicting known
        // source attributes fail planning instead of choosing by file order.
        const incomingMetadata = runtime.venueMetadata(entry);
        for (const [property, value] of Object.entries(incomingMetadata)) {
          if (['verifiedAt', 'sourceUrl'].includes(property)) continue;
          if (venue[property] == null) venue[property] = value;
          else if (venue[property] !== value) throw new Error('CONFLICTING_RESEARCH_METADATA');
        }
      }
      for (const field of fields) {
        if (!runtime.fieldEligible(field)) {
          deferred.push({
            cityId: entry.cityId,
            name: entry.name,
            field,
            researchFile: base.researchFile,
            reasons: ['Invalid field evidence or capacity; unknown capacity must be null'],
          });
          continue;
        }
        runtime.fieldMetadata(field);
        const known = venue.fields.find(
          (candidate) => normalizeCatalogName(candidate.name) === normalizeCatalogName(field.name),
        );
        if (known) {
          for (const [property, value] of Object.entries(runtime.fieldMetadata(field))) {
            if (known[property] == null) known[property] = value;
            else if (known[property] !== value) throw new Error('CONFLICTING_RESEARCH_METADATA');
          }
        } else
          venue.fields.push({
            ...field,
            capacity: field.capacity ?? null,
            id: stableId(
              'field',
              entry.cityId,
              normalizeCatalogName(entry.name),
              normalizeCatalogName(field.name),
            ),
          });
      }
    }
    for (const missing of Array.isArray(research.missing) ? research.missing : [])
      deferred.push({
        ...missing,
        researchFile: `data/venues/${filename}`,
        reasons: ['Research incomplete'],
      });
  }
  const ready = [...readyByVenue.values()].sort((a, b) =>
    `${a.cityId}/${normalizeCatalogName(a.name)}`.localeCompare(
      `${b.cityId}/${normalizeCatalogName(b.name)}`,
      'uk-UA',
    ),
  );
  for (const venue of ready)
    venue.fields.sort((a, b) =>
      normalizeCatalogName(a.name).localeCompare(normalizeCatalogName(b.name), 'uk-UA'),
    );
  const plan = { checkedAt: dates.sort().at(-1) ?? null, ready, deferred };
  runtime.validatePlan(plan);
  return plan;
}
