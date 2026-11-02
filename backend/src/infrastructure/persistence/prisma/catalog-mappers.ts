import { Prisma } from '@prisma/client';

export function toSafeMinor(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Catalog amount exceeds the safe integer range');
  }
  return Number(value);
}

export function toDecimalNumber(value: Prisma.Decimal | number | string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('Catalog coordinate is not a finite number');
  }
  return parsed;
}

export function toAmenities(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function toJsonInput(value: Record<string, unknown> | null) {
  return value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}
