import type { ErrorCode } from '@turiviaje/shared';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    readonly title: string,
    readonly detail?: string,
  ) {
    super(detail ?? title);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(detail: string, readonly field?: string) {
    super('VALIDATION_ERROR', 422, 'Datos inválidos', detail);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(detail = 'Se requiere autenticación') {
    super('UNAUTHENTICATED', 401, 'No autenticado', detail);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    super('UNAUTHENTICATED', 401, 'Credenciales inválidas', 'Email o contraseña incorrectos');
  }
}

export class InvalidRefreshTokenError extends AppError {
  constructor() {
    super('UNAUTHENTICATED', 401, 'Sesión inválida', 'Vuelve a iniciar sesión');
  }
}

export class ForbiddenError extends AppError {
  constructor(detail = 'No tienes permisos para esta acción') {
    super('FORBIDDEN', 403, 'Acceso denegado', detail);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Recurso') {
    super('NOT_FOUND', 404, 'No encontrado', `${resource} no existe`);
  }
}

export class ConflictError extends AppError {
  constructor(detail: string, code: ErrorCode = 'CONFLICT') {
    super(code, 409, 'Conflicto', detail);
  }
}

export class PlanNotEditableError extends AppError {
  constructor(detail = 'El plan no se puede editar en su estado actual') {
    super('PLAN_NOT_EDITABLE', 409, 'Plan no editable', detail);
  }
}

export class AiUnavailableError extends AppError {
  constructor(detail = 'El proveedor de IA no está disponible') {
    super('AI_UNAVAILABLE', 503, 'IA no disponible', detail);
  }
}

export class AiInvalidOutputError extends AppError {
  constructor(detail = 'La IA devolvió un itinerario inválido') {
    super('AI_INVALID_OUTPUT', 502, 'Salida de IA inválida', detail);
  }
}
