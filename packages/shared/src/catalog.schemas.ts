import { z } from 'zod';
import { paginationQuerySchema } from './common.js';

export const transportModeSchema = z.enum(['FLIGHT', 'BUS', 'CAR_RENTAL', 'BOAT', 'TRAIN']);

export const pricingUnitSchema = z.enum(['PER_PERSON', 'PER_NIGHT', 'PER_DAY', 'PER_TRIP']);

export const activityIntensitySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const moneySchema = z
  .object({
    amountMinor: z
      .number()
      .int('El monto debe ser un entero en unidades menores')
      .nonnegative('El monto no puede ser negativo')
      .max(Number.MAX_SAFE_INTEGER),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, 'La moneda debe ser un código ISO-4217 de 3 letras'),
  })
  .strict();

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El slug solo admite minúsculas, números y guiones')
  .max(160);

const urlSchema = z.string().trim().url('La URL no es válida').max(2048);

const tagSchema = z.string().trim().toLowerCase().min(1).max(40);

const destinationFields = {
  city: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(120),
  slug: slugSchema,
  description: z.string().trim().max(2000).nullable(),
  heroImageUrl: urlSchema.nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().trim().min(1).max(64),
  tags: z.array(tagSchema).max(20),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
};

export const createDestinationSchema = z
  .object({
    ...destinationFields,
    country: destinationFields.country.default('Colombia'),
    slug: destinationFields.slug.optional(),
    description: destinationFields.description.optional(),
    heroImageUrl: destinationFields.heroImageUrl.optional(),
    timezone: destinationFields.timezone.default('America/Bogota'),
    tags: destinationFields.tags.default([]),
    isFeatured: destinationFields.isFeatured.default(false),
    isActive: destinationFields.isActive.default(true),
  })
  .strict();

export const updateDestinationSchema = z
  .object(destinationFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debes enviar al menos un campo para actualizar',
  });

const hotelFields = {
  destinationId: z.string().uuid('El destino no es un UUID válido'),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).nullable(),
  category: z.number().int().min(1).max(5),
  roomType: z.string().trim().min(2).max(80),
  pricePerNight: moneySchema,
  imageUrl: urlSchema.nullable(),
  amenities: z.record(z.string(), z.unknown()).nullable(),
  isActive: z.boolean(),
};

export const createHotelSchema = z
  .object({
    ...hotelFields,
    description: hotelFields.description.optional(),
    imageUrl: hotelFields.imageUrl.optional(),
    amenities: hotelFields.amenities.optional(),
    isActive: hotelFields.isActive.default(true),
  })
  .strict();

export const updateHotelSchema = z
  .object(hotelFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debes enviar al menos un campo para actualizar',
  });

const activityFields = {
  destinationId: z.string().uuid('El destino no es un UUID válido'),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).nullable(),
  intensity: activityIntensitySchema,
  durationMinutes: z.number().int().positive().max(10_080),
  pricePerPerson: moneySchema,
  imageUrl: urlSchema.nullable(),
  tags: z.array(tagSchema).max(20),
  isActive: z.boolean(),
};

export const createActivitySchema = z
  .object({
    ...activityFields,
    description: activityFields.description.optional(),
    intensity: activityFields.intensity.default('LOW'),
    imageUrl: activityFields.imageUrl.optional(),
    tags: activityFields.tags.default([]),
    isActive: activityFields.isActive.default(true),
  })
  .strict();

export const updateActivitySchema = z
  .object(activityFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debes enviar al menos un campo para actualizar',
  });

const transportFields = {
  originDestinationId: z.string().uuid('El origen no es un UUID válido').nullable(),
  destinationId: z.string().uuid('El destino no es un UUID válido'),
  mode: transportModeSchema,
  provider: z.string().trim().min(2).max(120),
  price: moneySchema,
  pricingUnit: pricingUnitSchema,
  durationMinutes: z.number().int().positive().max(10_080),
  isActive: z.boolean(),
};

export const createTransportOptionSchema = z
  .object({
    ...transportFields,
    originDestinationId: transportFields.originDestinationId.optional(),
    isActive: transportFields.isActive.default(true),
  })
  .strict();

export const updateTransportOptionSchema = z
  .object(transportFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debes enviar al menos un campo para actualizar',
  });

export const catalogIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const listDestinationsQuerySchema = paginationQuerySchema
  .extend({
    q: z.string().trim().min(1).max(120).optional(),
    country: z.string().trim().min(2).max(120).optional(),
    featured: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict();

export const listHotelsQuerySchema = paginationQuerySchema
  .extend({
    destinationId: z.string().uuid().optional(),
    maxPriceMinor: z.coerce.number().int().nonnegative().optional(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  })
  .strict();

export const listActivitiesQuerySchema = paginationQuerySchema
  .extend({
    destinationId: z.string().uuid().optional(),
    interest: z.string().trim().toLowerCase().min(1).max(40).optional(),
    intensity: activityIntensitySchema.optional(),
  })
  .strict();

export const listTransportQuerySchema = paginationQuerySchema
  .extend({
    originId: z.string().uuid().optional(),
    destinationId: z.string().uuid().optional(),
    mode: transportModeSchema.optional(),
  })
  .strict();

export type CreateDestinationInput = z.infer<typeof createDestinationSchema>;
export type UpdateDestinationInput = z.infer<typeof updateDestinationSchema>;
export type CreateHotelInput = z.infer<typeof createHotelSchema>;
export type UpdateHotelInput = z.infer<typeof updateHotelSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type CreateTransportOptionInput = z.infer<typeof createTransportOptionSchema>;
export type UpdateTransportOptionInput = z.infer<typeof updateTransportOptionSchema>;
export type ListDestinationsQuery = z.infer<typeof listDestinationsQuerySchema>;
export type ListHotelsQuery = z.infer<typeof listHotelsQuerySchema>;
export type ListActivitiesQuery = z.infer<typeof listActivitiesQuerySchema>;
export type ListTransportQuery = z.infer<typeof listTransportQuerySchema>;
