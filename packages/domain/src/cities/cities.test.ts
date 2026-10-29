import { describe, it, expect } from 'vitest';
import { sortCities } from './cities.js';

describe('sortCities', () => {
  it('puts Kyiv first, then sorts by Ukrainian alphabet', () => {
    const sorted = sortCities([
      { id: 'izmail', name: 'Ізмаїл' },
      { id: 'lviv', name: 'Львів' },
      { id: 'kyiv', name: 'Київ' },
      { id: 'ivano-frankivsk', name: 'Івано-Франківськ' },
      { id: 'yahotyn', name: 'Яготин' },
      { id: 'bila-tserkva', name: 'Біла Церква' },
    ]);
    expect(sorted.map((c) => c.id)).toEqual([
      'kyiv',
      'bila-tserkva',
      'ivano-frankivsk',
      'izmail',
      'lviv',
      'yahotyn',
    ]);
  });
});
