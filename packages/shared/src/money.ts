export type Currency = string;

export interface Money {
  readonly amountMinor: number;
  readonly currency: Currency;
}

const ISO_4217 = /^[A-Z]{3}$/;

/** Creates a money value. Amounts are always integers in minor units (cents). */
export function money(amountMinor: number, currency: Currency): Money {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError('Money amount must be a safe integer in minor units');
  }
  if (!ISO_4217.test(currency)) {
    throw new RangeError(`Invalid ISO-4217 currency: ${currency}`);
  }
  return { amountMinor, currency };
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function multiplyMoney(value: Money, quantity: number): Money {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new RangeError('Quantity must be a positive integer');
  }
  return money(value.amountMinor * quantity, value.currency);
}

/** Half-up rounding for non-negative money values. */
export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Value must be finite');
  if (value < 0) throw new RangeError('Negative money is not supported');
  return Math.floor(value + 0.5);
}

/** Applies a percentage (for example 12 or 12.5) and rounds once, half-up. */
export function percentageOf(value: Money, percent: number): Money {
  if (!Number.isFinite(percent) || percent < 0) {
    throw new RangeError('Percentage must be a non-negative finite number');
  }
  return money(roundHalfUp((value.amountMinor * percent) / 100), value.currency);
}

/** Formats for display only. COP, USD and EUR use two minor digits. */
export function formatMoney(value: Money, locale = 'es-CO'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currency,
  }).format(value.amountMinor / 100);
}
