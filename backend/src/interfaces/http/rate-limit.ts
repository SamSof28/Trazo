import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import type { ProblemDetails } from '@trazo/shared';
import { env } from '../../config/env.js';

function tooManyRequests(req: Request, res: Response): void {
  const id = (req as { id?: unknown }).id;
  const body: ProblemDetails = {
    type: 'https://api.trazo.co/problems/rate_limited',
    title: 'Demasiadas solicitudes',
    status: 429,
    code: 'RATE_LIMITED',
    detail: 'Espera un momento antes de volver a intentar',
    ...(typeof id === 'string' ? { requestId: id } : {}),
  };
  res.status(429).type('application/problem+json').json(body);
}

const common = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  skip: () => !env.RATE_LIMIT_ENABLED,
  handler: tooManyRequests,
};

export const globalLimiter = rateLimit({
  ...common,
  windowMs: 60_000,
  limit: 300,
});

export const loginLimiter = rateLimit({
  ...common,
  windowMs: 60_000,
  limit: 5,
});

export const refreshLimiter = rateLimit({
  ...common,
  windowMs: 60_000,
  limit: 30,
});

export const tripRequestLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60_000,
  limit: 20,
  keyGenerator: (req) => req.auth?.userId ?? req.ip ?? 'unknown',
});

export const generationLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60_000,
  limit: 10,
  keyGenerator: (req) => req.auth?.userId ?? req.ip ?? 'unknown',
});
