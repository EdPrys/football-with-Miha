process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DATABASE_URL = 'postgresql://test';

import jwt from 'jsonwebtoken';
import { describe, it, expect } from 'vitest';
const { signToken, verifyToken } = await import('./jwt.js');

describe('jwt token service', () => {
  it('signs and verifies a user id', () => {
    const token = signToken('user-123');
    expect(verifyToken(token)).toEqual({ sub: 'user-123', sessionVersion: 0 });
  });

  it('preserves a session version and supports pre-recovery legacy tokens', () => {
    expect(verifyToken(signToken('u1', 2))).toEqual({ sub: 'u1', sessionVersion: 2 });
    expect(verifyToken(jwt.sign({ sub: 'u1' }, 'test-secret'))).toEqual({
      sub: 'u1',
      sessionVersion: 0,
    });
    expect(verifyToken(jwt.sign({ sub: 'u1', sv: '2' }, 'test-secret'))).toBeNull();
  });

  it('returns null for a tampered token', () => {
    expect(verifyToken('not.a.jwt')).toBeNull();
  });
});
