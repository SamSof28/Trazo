import { createHash, randomBytes } from 'node:crypto';
import type { TokenGenerator } from '../../domain/identity/ports.js';

export class RandomTokenGenerator implements TokenGenerator {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
