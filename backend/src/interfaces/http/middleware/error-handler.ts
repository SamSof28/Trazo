import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ProblemDetails } from '@trazo/shared';
import { logger } from '../../../config/logger.js';
import { AppError, ValidationError } from '../../../domain/shared/app-error.js';

function requestIdOf(req: Parameters<ErrorRequestHandler>[1]): string | undefined {
  const id = (req as { id?: unknown }).id;
  return typeof id === 'string' ? id : undefined;
}

function problem(
  status: number,
  code: ProblemDetails['code'],
  title: string,
  requestId: string | undefined,
  detail?: string,
  errors?: ProblemDetails['errors'],
): ProblemDetails {
  return {
    type: `https://api.trazo.co/problems/${code.toLowerCase()}`,
    title,
    status,
    code,
    ...(detail ? { detail } : {}),
    ...(requestId ? { requestId } : {}),
    ...(errors ? { errors } : {}),
  };
}

function zodErrors(error: ZodError): ProblemDetails['errors'] {
  return error.issues.flatMap((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({
        field: [...issue.path, key].join('.') || key,
        message: 'Campo no permitido',
      }));
    }
    return [{ field: issue.path.join('.') || '(root)', message: issue.message }];
  });
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = requestIdOf(req);

  if (error instanceof ZodError) {
    const body = problem(
      422,
      'VALIDATION_ERROR',
      'Datos inválidos',
      requestId,
      'Revisa los campos enviados',
      zodErrors(error),
    );
    res.status(422).type('application/problem+json').json(body);
    return;
  }

  if (error instanceof AppError) {
    const body = problem(
      error.status,
      error.code,
      error.title,
      requestId,
      error.detail,
      error instanceof ValidationError && error.field
        ? [{ field: error.field, message: error.detail ?? error.title }]
        : undefined,
    );
    res.status(error.status).type('application/problem+json').json(body);
    return;
  }

  logger.error({ err: error, requestId }, 'unhandled_error');
  const body = problem(
    500,
    'INTERNAL_ERROR',
    'Error interno',
    requestId,
    'No fue posible procesar la solicitud',
  );
  res.status(500).type('application/problem+json').json(body);
};

export const notFoundHandler: RequestHandler = (req, res) => {
  const body = problem(
    404,
    'NOT_FOUND',
    'No encontrado',
    requestIdOf(req),
    `No existe ${req.method} ${req.path}`,
  );
  res.status(404).type('application/problem+json').json(body);
};
