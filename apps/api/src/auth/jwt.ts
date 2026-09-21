import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../env.js';

export interface TokenPayload {
  sub: string;
}

export function signToken(userId: string): string {
  const options = { expiresIn: env.JWT_EXPIRES_IN } as SignOptions;
  return jwt.sign({ sub: userId }, env.JWT_SECRET, options);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { sub?: string };
    return decoded.sub ? { sub: decoded.sub } : null;
  } catch {
    return null;
  }
}
