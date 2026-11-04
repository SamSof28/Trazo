import { z } from 'zod';
import { paginationQuerySchema } from './common.js';

export const tripRequestStatusSchema = z.enum([
  'COLLECTING',
  'AWAITING_INPUT',
  'READY',
  'GENERATING',
  'GENERATED',
  'FAILED',
]);

export const travelerTypeSchema = z.enum([
  'SOLO',
  'COUPLE',
  'FAMILY',
  'FRIENDS',
  'BUSINESS',
]);

export const missingFieldSchema = z.enum(['destination', 'duration', 'travelers', 'budget']);

export const createTripRequestSchema = z
  .object({
    prompt: z
      .string()
      .trim()
      .min(1, 'El prompt no puede estar vacío')
      .max(2000, 'El prompt no puede superar 2000 caracteres'),
  })
  .strict();

export const tripRequestIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const tripRequestAnswerSchema = z
  .object({
    field: missingFieldSchema,
    value: z.string().trim().min(1, 'La respuesta no puede estar vacía').max(200),
  })
  .strict();

export const answerTripRequestSchema = z
  .object({
    answers: z.array(tripRequestAnswerSchema).min(1).max(4),
  })
  .strict();

export const listTripRequestsQuerySchema = paginationQuerySchema
  .extend({
    status: tripRequestStatusSchema.optional(),
  })
  .strict();

export type CreateTripRequestInput = z.infer<typeof createTripRequestSchema>;
export type TripRequestIdParams = z.infer<typeof tripRequestIdParamsSchema>;
export type TripRequestAnswerInput = z.infer<typeof tripRequestAnswerSchema>;
export type AnswerTripRequestPayload = z.infer<typeof answerTripRequestSchema>;
export type ListTripRequestsQuery = z.infer<typeof listTripRequestsQuerySchema>;
