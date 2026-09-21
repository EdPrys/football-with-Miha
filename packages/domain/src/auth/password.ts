import { DomainError } from '../errors.js';

export const PASSWORD_MIN_LENGTH = 8;

/** Returns a list of human-readable policy violations (empty = valid). */
export function passwordViolations(password: string): string[] {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (!/[a-zA-Z]/.test(password)) errors.push('Password must contain a letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain a digit');
  return errors;
}

export function assertValidPassword(password: string): void {
  const errors = passwordViolations(password);
  if (errors.length > 0) throw new DomainError('VALIDATION', errors.join('; '));
}
