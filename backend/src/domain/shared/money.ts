import { ValidationError } from './app-error.js';

/** Validates a money amount expressed as a non-negative safe integer in minor units. */
export function assertSafeMinor(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ValidationError(`${field} debe ser un entero no negativo en unidades menores`);
  }
  return value;
}
