import { describe, it, expect } from 'vitest';
import { passwordViolations, assertValidPassword } from './password.js';
import { DomainError } from '../errors.js';

describe('password policy', () => {
  it('accepts a valid password', () => {
    expect(passwordViolations('secret123')).toEqual([]);
  });

  it('rejects short passwords', () => {
    expect(passwordViolations('ab1')).toContain('Password must be at least 8 characters');
  });

  it('requires a letter and a digit', () => {
    expect(passwordViolations('12345678')).toContain('Password must contain a letter');
    expect(passwordViolations('abcdefgh')).toContain('Password must contain a digit');
  });

  it('assertValidPassword throws a DomainError', () => {
    expect(() => assertValidPassword('short')).toThrowError(DomainError);
  });
});
