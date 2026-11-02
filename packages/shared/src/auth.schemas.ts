import { z } from 'zod';

export const roleSchema = z.enum(['ADVISOR', 'ADMIN']);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Email inválido')
  .max(320);

export const passwordSchema = z
  .string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres')
  .max(128, 'La contraseña no puede superar 128 caracteres');

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'La contraseña es obligatoria').max(128),
  })
  .strict();

export const createUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: emailSchema,
    password: passwordSchema,
    role: roleSchema.default('ADVISOR'),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
