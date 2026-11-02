import { ValidationError } from '../shared/app-error.js';

const ISO_CURRENCY = /^[A-Z]{3}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeText(value: string, field: string, min: number, max: number): string {
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new ValidationError(`${field} debe tener entre ${min} y ${max} caracteres`);
  }
  return normalized;
}

export function normalizeOptionalText(
  value: string | null | undefined,
  field: string,
  max: number,
): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (normalized.length > max) {
    throw new ValidationError(`${field} no puede superar ${max} caracteres`);
  }
  return normalized;
}

export function normalizeSlug(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!SLUG.test(normalized) || normalized.length > 160) {
    throw new ValidationError(
      'El slug solo admite minúsculas, números y guiones, con un máximo de 160 caracteres',
    );
  }
  return normalized;
}

export function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) throw new ValidationError('No fue posible derivar un slug del nombre');
  return normalizeSlug(slug);
}

export function normalizeCurrency(value: string): string {
  const currency = value.trim().toUpperCase();
  if (!ISO_CURRENCY.test(currency)) {
    throw new ValidationError('La moneda debe ser un código ISO-4217 de 3 letras');
  }
  return currency;
}

export function assertPrice(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ValidationError(`${field} debe ser un entero no negativo en unidades menores`);
  }
  return value;
}

export function assertLatitude(value: number): number {
  if (!Number.isFinite(value) || value < -90 || value > 90) {
    throw new ValidationError('La latitud debe estar entre -90 y 90');
  }
  return value;
}

export function assertLongitude(value: number): number {
  if (!Number.isFinite(value) || value < -180 || value > 180) {
    throw new ValidationError('La longitud debe estar entre -180 y 180');
  }
  return value;
}

export function assertDuration(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0 || value > 10_080) {
    throw new ValidationError(`${field} debe ser un entero entre 1 y 10080 minutos`);
  }
  return value;
}

export function normalizeTags(tags: string[]): string[] {
  const normalized = [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length > 20) {
    throw new ValidationError('No se permiten más de 20 etiquetas');
  }
  for (const tag of normalized) {
    if (tag.length > 40) {
      throw new ValidationError('Cada etiqueta puede tener máximo 40 caracteres');
    }
  }
  return normalized;
}

export function normalizeHttpUrl(value: string | null | undefined, field: string): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  if (!normalized) return null;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new ValidationError(`${field} no es una URL válida`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError(`${field} debe usar http o https`);
  }
  if (normalized.length > 2048) {
    throw new ValidationError(`${field} no puede superar 2048 caracteres`);
  }
  return normalized;
}

export function normalizeTimezone(value: string): string {
  const timezone = value.trim();
  if (!timezone || timezone.length > 64) {
    throw new ValidationError('La zona horaria es obligatoria y admite máximo 64 caracteres');
  }
  return timezone;
}
