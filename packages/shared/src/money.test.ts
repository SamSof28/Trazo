import { describe, expect, it } from 'vitest';
import {
  addMoney,
  formatMoney,
  money,
  multiplyMoney,
  percentageOf,
  roundHalfUp,
} from './money.js';

describe('money', () => {
  it('rejects non-integer minor units', () => {
    expect(() => money(10.5, 'COP')).toThrow(RangeError);
  });

  it('rejects invalid currencies', () => {
    expect(() => money(100, 'pesos')).toThrow(RangeError);
  });

  it('adds only same-currency values', () => {
    expect(addMoney(money(1000, 'COP'), money(500, 'COP')).amountMinor).toBe(1500);
    expect(() => addMoney(money(1000, 'COP'), money(500, 'USD'))).toThrow(/mismatch/);
  });

  it('multiplies by a positive integer quantity', () => {
    expect(multiplyMoney(money(32000000, 'COP'), 4).amountMinor).toBe(128000000);
    expect(() => multiplyMoney(money(100, 'COP'), 0)).toThrow(RangeError);
  });

  it('rounds percentages once, half-up', () => {
    expect(roundHalfUp(0.5)).toBe(1);
    expect(roundHalfUp(1.49)).toBe(1);
    expect(percentageOf(money(254000000, 'COP'), 12).amountMinor).toBe(30480000);
  });

  it('formats COP without decimals', () => {
    expect(formatMoney(money(59909900, 'COP'))).toContain('599.099');
  });
});
