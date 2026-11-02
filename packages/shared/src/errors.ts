export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PLAN_NOT_EDITABLE',
  'RATE_LIMITED',
  'AI_UNAVAILABLE',
  'AI_INVALID_OUTPUT',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: ErrorCode;
  detail?: string;
  requestId?: string;
  errors?: Array<{ field: string; message: string }>;
}
