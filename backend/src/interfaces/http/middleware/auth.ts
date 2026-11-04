import type { RequestHandler } from 'express';
import type { AccessTokenService } from '../../../domain/identity/ports.js';
import type { Role } from '@trazo/shared';
import { ForbiddenError, UnauthenticatedError } from '../../../domain/shared/app-error.js';

export function requireAuth(accessTokens: AccessTokenService): RequestHandler {
  return async (req, _res, next) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        throw new UnauthenticatedError();
      }

      const token = header.slice('Bearer '.length).trim();
      if (!token) throw new UnauthenticatedError();

      req.auth = await accessTokens.verify(token);
      next();
    } catch {
      next(new UnauthenticatedError('Token inválido o expirado'));
    }
  };
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new UnauthenticatedError());
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}
