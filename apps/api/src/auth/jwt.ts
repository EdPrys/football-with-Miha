import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../env.js';

export interface TokenPayload {
  sub: string;
  sessionVersion: number;
}

export function signToken(userId: string, sessionVersion = 0): string {
  const options = { expiresIn: env.JWT_EXPIRES_IN } as SignOptions;
  return jwt.sign({ sub: userId, sv: sessionVersion }, env.JWT_SECRET, options);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as {
      sub?: unknown;
      sv?: unknown;
    };
    // Existing tokens without sv remain valid until the first password reset.
    const version = decoded.sv ?? 0;
    return typeof decoded.sub === 'string' &&
      Number.isSafeInteger(version) &&
      (version as number) >= 0
      ? { sub: decoded.sub, sessionVersion: version as number }
      : null;
  } catch {
    return null;
  }
}
