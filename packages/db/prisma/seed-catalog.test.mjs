import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildCatalogPlan, createCatalogRuntime, importCatalog } from './seed-catalog.mjs';

function research(overrides = {}) {
  return {
    cityId: 'kyiv',
    name: 'Арена «Тест»',
    address: 'Вулиця, 1',
    sourceUrl: 'https://example.com/arena',
    checkedAt: '2026-10-31',
    availability: 'rental-confirmed',
    fields: [
      {
        name: 'Основне поле',
        capacity: null,
        formatEvidence: 'Поле підтверджено оператором; число гравців невідоме.',
      },
    ],
    ...overrides,
  };
}

function database(venues = [], fields = []) {
  const state = { venues: structuredClone(venues), fields: structuredClone(fields) };
  const operations = [];
  const table = (key) => ({
    async findMany({ where }) {
      return structuredClone(
        state[key].filter((row) => Object.entries(where).every(([k, value]) => row[k] === value)),
      );
    },
    async create({ data }) {
      assert.ok(
        !state[key].some((row) => row.id === data.id),
        'duplicate IDs must not be silently overwritten',
      );
      state[key].push(structuredClone(data));
      operations.push(['create', key, structuredClone(data)]);
      return structuredClone(data);
    },
    async update({ where, data }) {
      const row = state[key].find((row) => row.id === where.id);
      assert.ok(row);
      Object.assign(row, structuredClone(data));
      operations.push(['update', key, structuredClone(data)]);
      return structuredClone(row);
    },
  });
  const tx = {
    city: {
      async findMany() {
        return [{ id: 'kyiv' }];
      },
    },
    venue: table('venues'),
    field: table('fields'),
  };
  return {
    state,
    operations,
    async $transaction(callback, options) {
      assert.equal(options.isolationLevel, 'Serializable');
      const before = structuredClone(state);
      try {
        return await callback(tx);
      } catch (error) {
        Object.assign(state, before);
        throw error;
      }
    },
  };
}

test('planning accepts unknown capacity, rejects unconfirmed access and keeps IDs stable', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kopanka-catalog-test-'));
  try {
    const write = (entries) =>
      writeFileSync(join(directory, 'research-test.json'), JSON.stringify({ entries }));
    write([
      research(),
      research({ name: 'Закрита арена', availability: 'existence-only' }),
      research({
        name: 'Неприпустиме поле',
        fields: [{ name: 'Поле', capacity: 0, formatEvidence: 'Невідоме' }],
      }),
    ]);
    const first = buildCatalogPlan(directory);
    assert.equal(first.ready.length, 1);
    assert.equal(first.ready[0].fields[0].capacity, null);
    assert.equal(first.deferred.length, 2);
    write([
      research({
        name: 'АРЕНА Тест',
        fields: [{ name: 'ОСНОВНЕ ПОЛЕ', capacity: null, formatEvidence: 'Підтверджено' }],
      }),
    ]);
    const second = buildCatalogPlan(directory);
    assert.equal(first.ready[0].id, second.ready[0].id);
    assert.equal(first.ready[0].fields[0].id, second.ready[0].fields[0].id);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('imports fill only unknown data, preserve false/zero/inactive/known capacity and are idempotent', async () => {
  const incoming = {
    ...research({ hasParking: true, latitude: 50, totalFields: 2 }),
    id: 'catalog_venue_example',
    fields: [
      {
        id: 'catalog_field_existing',
        name: 'ОСНОВНЕ ПОЛЕ',
        capacity: 22,
        environment: 'INDOOR',
        hasLighting: true,
        formatEvidence: 'Confirmed',
      },
      {
        id: 'catalog_field_new',
        name: 'Друге поле',
        capacity: null,
        hasLighting: false,
        formatEvidence: 'Existence confirmed; capacity unknown',
      },
    ],
  };
  const db = database(
    [
      {
        id: 'user_venue',
        name: 'Арена Тест',
        cityId: 'kyiv',
        address: 'Адреса користувача',
        latitude: 0,
        totalFields: 0,
        hasParking: false,
        sourceUrl: null,
        verifiedAt: null,
      },
    ],
    [
      {
        id: 'user_field',
        venueId: 'user_venue',
        name: 'Основне поле',
        capacity: 12,
        environment: null,
        hasLighting: false,
        isActive: false,
      },
    ],
  );
  const result = await importCatalog(db, { ready: [incoming] });
  assert.equal(result.createdVenues.length, 0);
  assert.equal(result.createdFields.length, 1);
  assert.equal(db.state.venues[0].address, 'Адреса користувача');
  assert.equal(db.state.venues[0].latitude, 0);
  assert.equal(db.state.venues[0].totalFields, 0);
  assert.equal(db.state.venues[0].hasParking, false);
  assert.equal(db.state.venues[0].sourceUrl, 'https://example.com/arena');
  assert.ok(db.state.venues[0].verifiedAt instanceof Date);
  assert.equal(db.state.fields[0].capacity, 12);
  assert.equal(db.state.fields[0].isActive, false);
  assert.equal(db.state.fields[0].hasLighting, false);
  assert.equal(db.state.fields[0].environment, 'INDOOR');
  assert.equal(db.state.fields[1].capacity, null);
  assert.equal(db.state.fields[1].hasLighting, false);
  assert.equal(db.state.fields[1].isActive, true);
  const before = structuredClone(db.state);
  const operationsBefore = db.operations.length;
  const repeat = await importCatalog(db, { ready: [incoming] });
  assert.deepEqual(db.state, before);
  assert.equal(db.operations.length, operationsBefore);
  assert.equal(repeat.updatedFields.length + repeat.updatedVenues.length, 0);
});

test('same-name field with unknown capacity gains confirmed count without reactivation', async () => {
  const db = database(
    [{ id: 'v', cityId: 'kyiv', name: 'Арена Тест' }],
    [{ id: 'f', venueId: 'v', name: 'Основне поле', capacity: null, isActive: false }],
  );
  await importCatalog(db, {
    ready: [
      {
        ...research(),
        id: 'incoming-v',
        fields: [
          { id: 'incoming-f', name: 'Основне поле', capacity: 10, formatEvidence: '5×5 confirmed' },
        ],
      },
    ],
  });
  assert.equal(db.state.fields.length, 1);
  assert.equal(db.state.fields[0].capacity, 10);
  assert.equal(db.state.fields[0].isActive, false);
});

test('serialized Railway runtime has the same validation and rejects bad plans before writes', async () => {
  const serialized = new Function(`return (${createCatalogRuntime.toString()})()`)();
  const db = database();
  const venue = {
    ...research(),
    id: 'v',
    fields: [{ id: 'f', name: 'Поле', capacity: null, formatEvidence: 'Confirmed' }],
  };
  assert.equal(
    serialized.normalize('Арена «Тест»'),
    createCatalogRuntime().normalize('Арена «Тест»'),
  );
  await assert.rejects(
    serialized.importCatalog(db, { ready: [{ ...venue, availability: 'existence-only' }] }),
    /INVALID_PLAN/,
  );
  await assert.rejects(
    serialized.importCatalog(db, { ready: [{ ...venue, hasParking: 'yes' }] }),
    /INVALID_METADATA/,
  );
  assert.equal(db.operations.length, 0);
  const result = await serialized.importCatalog(db, { ready: [venue] });
  assert.equal(result.createdFields[0].capacity, null);
});
