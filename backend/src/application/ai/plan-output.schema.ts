import { z } from 'zod';

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe usar el formato HH:mm');

export const planOutputItemSchema = z
  .object({
    type: z.enum(['ACCOMMODATION', 'ACTIVITY', 'TRANSPORT']),
    catalogItemId: z.string().trim().min(1),
    startTime: timeSchema.nullable().optional(),
    endTime: timeSchema.nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const planOutputDaySchema = z
  .object({
    dayNumber: z.number().int().min(1).max(30),
    title: z.string().trim().max(160).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    items: z.array(planOutputItemSchema).min(1).max(6),
  })
  .strict();

export const planOutputSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    summary: z.string().trim().max(1000).nullable().optional(),
    days: z.array(planOutputDaySchema).min(1).max(30),
  })
  .strict();

export type PlanOutput = z.infer<typeof planOutputSchema>;
export type PlanOutputDay = z.infer<typeof planOutputDaySchema>;
export type PlanOutputItem = z.infer<typeof planOutputItemSchema>;
