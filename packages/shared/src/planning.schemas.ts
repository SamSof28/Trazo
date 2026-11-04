import { z } from 'zod';
import { paginationQuerySchema } from './common.js';

export const planStatusSchema = z.enum(['DRAFT', 'SAVED', 'PUBLISHED', 'ARCHIVED']);

export const planItemTypeSchema = z.enum(['ACCOMMODATION', 'ACTIVITY', 'TRANSPORT']);

export const planIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const planItemParamsSchema = z
  .object({ id: z.string().uuid(), itemId: z.string().uuid() })
  .strict();

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe usar el formato HH:mm');

const marginPercentSchema = z
  .number()
  .min(0, 'El margen no puede ser negativo')
  .max(100, 'El margen no puede superar 100')
  .refine((value) => Number.isInteger(Math.round(value * 100)), {
    message: 'El margen admite máximo dos decimales',
  });

export const updatePlanSchema = z
  .object({
    title: z.string().trim().min(2).max(120).nullable().optional(),
    summary: z.string().trim().max(1000).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    marginPercent: marginPercentSchema.optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Debes enviar al menos un campo para actualizar',
  });

export const listPlansQuerySchema = paginationQuerySchema
  .extend({
    status: planStatusSchema.optional(),
    q: z.string().trim().max(120).optional(),
    destinationId: z.string().uuid().optional(),
  })
  .strict();

export const replacePlanItemSchema = z
  .object({ catalogItemId: z.string().uuid() })
  .strict();

export const addPlanItemSchema = z
  .object({
    dayNumber: z.number().int().min(1).max(30),
    type: planItemTypeSchema,
    catalogItemId: z.string().uuid(),
    quantity: z.number().int().min(1).max(99).optional(),
    startTime: timeSchema.nullable().optional(),
    endTime: timeSchema.nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const updatePlanItemSchema = z
  .object({
    quantity: z.number().int().min(1).max(99).optional(),
    startTime: timeSchema.nullable().optional(),
    endTime: timeSchema.nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Debes enviar al menos un campo para actualizar',
  });

export const movePlanItemSchema = z
  .object({
    dayNumber: z.number().int().min(1).max(30),
    position: z.number().int().min(0).max(99).optional(),
  })
  .strict();

export const planReportQuerySchema = z
  .object({ format: z.enum(['json', 'csv']).default('json') })
  .strict();

export const planAlternativesQuerySchema = z
  .object({ itemId: z.string().uuid() })
  .strict();

export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type ListPlansQuery = z.infer<typeof listPlansQuerySchema>;
export type ReplacePlanItemInput = z.infer<typeof replacePlanItemSchema>;
export type AddPlanItemInput = z.infer<typeof addPlanItemSchema>;
export type UpdatePlanItemInput = z.infer<typeof updatePlanItemSchema>;
export type MovePlanItemInput = z.infer<typeof movePlanItemSchema>;
export type PlanReportQuery = z.infer<typeof planReportQuerySchema>;
export type PlanAlternativesQuery = z.infer<typeof planAlternativesQuerySchema>;
