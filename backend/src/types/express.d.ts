import type { AccessTokenPayload } from '../domain/identity/ports.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
      validatedQuery?: unknown;
      validatedParams?: unknown;
    }
  }
}

export {};
