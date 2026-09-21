process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DATABASE_URL = 'postgresql://test';

import { describe, it, expect } from 'vitest';
const { signToken, verifyToken } = await import('./jwt.js');

describe('jwt token service', () => {
  it('signs and verifies a user id', () => {
    const token = signToken('user-123');
    expect(verifyToken(token)).toEqual({ sub: 'user-123' });
  });

  it('returns null for a tampered token', () => {
    expect(verifyToken('not.a.jwt')).toBeNull();
  });
});
