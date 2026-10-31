import { describe, expect, it } from 'vitest';
import { fieldDetailsSchema, venueDetailsSchema, optionalWebUrl } from './venue-inputs.js';

describe('optional venue details', () => {
  it('distinguishes unknown, omitted, and explicitly unavailable amenities', () => {
    const result = venueDetailsSchema.parse({ hasParking: false, hasShowers: null });
    expect(result.hasParking).toBe(false);
    expect(result.hasShowers).toBeNull();
    expect(result).not.toHaveProperty('hasChangingRooms');
  });

  it('accepts fields whose capacity is not established', () => {
    expect(fieldDetailsSchema.parse({})).toEqual({});
    expect(fieldDetailsSchema.parse({ capacity: null })).toEqual({ capacity: null });
    expect(fieldDetailsSchema.safeParse({ capacity: 0 }).success).toBe(false);
  });

  it('restricts rendered links to web protocols', () => {
    for (const url of [
      'not-a-url',
      'javascript:alert(1)',
      'data:text/html,hello',
      'ftp://example.com',
    ]) {
      expect(optionalWebUrl.safeParse(url).success).toBe(false);
    }
    expect(optionalWebUrl.parse('https://example.com/booking')).toBe('https://example.com/booking');
  });

  it('rejects invalid coordinates, field dimensions, and unsupported enum values', () => {
    expect(venueDetailsSchema.safeParse({ latitude: 91 }).success).toBe(false);
    expect(venueDetailsSchema.safeParse({ longitude: -181 }).success).toBe(false);
    expect(fieldDetailsSchema.safeParse({ widthMeters: -1 }).success).toBe(false);
    expect(fieldDetailsSchema.safeParse({ environment: 'UNKNOWN' }).success).toBe(false);
    expect(fieldDetailsSchema.parse({ environment: null, hasLighting: false })).toEqual({
      environment: null,
      hasLighting: false,
    });
  });
});
