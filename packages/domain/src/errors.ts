export type DomainErrorCode =
  'VALIDATION' | 'NOT_FOUND' | 'CONFLICT' | 'FORBIDDEN' | 'INVALID_STATE';

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
