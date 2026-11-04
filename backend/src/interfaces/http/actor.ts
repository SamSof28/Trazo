import type { Request } from 'express';
import type { AccessTokenPayload } from '../../domain/identity/ports.js';
import { UnauthenticatedError } from '../../domain/shared/app-error.js';

export function actorOf(req: Request): AccessTokenPayload {
  if (!req.auth) throw new UnauthenticatedError();
  return req.auth;
}
