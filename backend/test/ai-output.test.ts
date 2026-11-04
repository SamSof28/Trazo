import { describe, expect, it } from 'vitest';
import {
  validatePlanOutput,
  type PlanCatalogEntry,
} from '../src/application/ai/plan-output.js';
import { AiInvalidOutputError } from '../src/domain/shared/app-error.js';

const HOTEL_ID = '11111111-1111-4111-8111-111111111111';
const ACTIVITY_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ACTIVITY_ID = '33333333-3333-4333-8333-333333333333';

const entries: PlanCatalogEntry[] = [
  {
    catalogItemId: HOTEL_ID,
    type: 'HOTEL',
    name: 'Hotel',
    imageUrl: null,
    currency: 'COP',
    pricingUnit: 'PER_NIGHT',
  },
  {
    catalogItemId: ACTIVITY_ID,
    type: 'ACTIVITY',
    name: 'Actividad',
    imageUrl: null,
    currency: 'COP',
    pricingUnit: 'PER_PERSON',
  },
  {
    catalogItemId: OTHER_ACTIVITY_ID,
    type: 'ACTIVITY',
    name: 'Otra actividad',
    imageUrl: null,
    currency: 'COP',
    pricingUnit: 'PER_PERSON',
  },
];

function output(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Cartagena 3 días',
    summary: 'Un plan de prueba',
    days: [
      {
        dayNumber: 1,
        title: 'Llegada',
        items: [
          { type: 'ACCOMMODATION', catalogItemId: HOTEL_ID },
          { type: 'ACTIVITY', catalogItemId: ACTIVITY_ID },
        ],
      },
      {
        dayNumber: 2,
        items: [{ type: 'ACTIVITY', catalogItemId: OTHER_ACTIVITY_ID }],
      },
      {
        dayNumber: 3,
        items: [{ type: 'ACTIVITY', catalogItemId: ACTIVITY_ID }],
      },
    ],
    ...overrides,
  };
}

describe('validatePlanOutput', () => {
  it('accepts a grounded itinerary and keeps catalog order', () => {
    const result = validatePlanOutput(output(), 3, entries);
    expect(result.title).toBe('Cartagena 3 días');
    expect(result.days).toHaveLength(3);
    expect(result.days[0]!.items.map((item) => item.catalogItemId)).toEqual([
      HOTEL_ID,
      ACTIVITY_ID,
    ]);
  });

  it('parses a JSON string', () => {
    const result = validatePlanOutput(JSON.stringify(output()), 3, entries);
    expect(result.days[1]!.items[0]!.catalogItemId).toBe(OTHER_ACTIVITY_ID);
  });

  it('drops unknown ids but keeps the rest of the day', () => {
    const result = validatePlanOutput(
      output({
        days: [
          {
            dayNumber: 1,
            items: [
              { type: 'ACTIVITY', catalogItemId: 'unknown-id' },
              { type: 'ACTIVITY', catalogItemId: ACTIVITY_ID },
            ],
          },
          { dayNumber: 2, items: [{ type: 'ACTIVITY', catalogItemId: ACTIVITY_ID }] },
          { dayNumber: 3, items: [{ type: 'ACTIVITY', catalogItemId: ACTIVITY_ID }] },
        ],
      }),
      3,
      entries,
    );
    expect(result.days[0]!.items).toHaveLength(1);
    expect(result.days[0]!.items[0]!.catalogItemId).toBe(ACTIVITY_ID);
  });

  it('rejects a day that only had unknown ids', () => {
    expect(() =>
      validatePlanOutput(
        output({
          days: [
            { dayNumber: 1, items: [{ type: 'ACTIVITY', catalogItemId: 'unknown-id' }] },
            { dayNumber: 2, items: [{ type: 'ACTIVITY', catalogItemId: ACTIVITY_ID }] },
            { dayNumber: 3, items: [{ type: 'ACTIVITY', catalogItemId: ACTIVITY_ID }] },
          ],
        }),
        3,
        entries,
      ),
    ).toThrow(AiInvalidOutputError);
  });

  it('drops an item whose type does not match the catalog entry', () => {
    const result = validatePlanOutput(
      output({
        days: [
          {
            dayNumber: 1,
            items: [
              { type: 'ACTIVITY', catalogItemId: HOTEL_ID },
              { type: 'ACTIVITY', catalogItemId: ACTIVITY_ID },
            ],
          },
          { dayNumber: 2, items: [{ type: 'ACTIVITY', catalogItemId: ACTIVITY_ID }] },
          { dayNumber: 3, items: [{ type: 'ACTIVITY', catalogItemId: ACTIVITY_ID }] },
        ],
      }),
      3,
      entries,
    );
    expect(result.days[0]!.items).toHaveLength(1);
    expect(result.days[0]!.items[0]!.catalogItemId).toBe(ACTIVITY_ID);
  });

  it('keeps at most one accommodation', () => {
    const result = validatePlanOutput(
      output({
        days: [
          {
            dayNumber: 1,
            items: [
              { type: 'ACCOMMODATION', catalogItemId: HOTEL_ID },
              { type: 'ACCOMMODATION', catalogItemId: HOTEL_ID },
            ],
          },
          { dayNumber: 2, items: [{ type: 'ACTIVITY', catalogItemId: ACTIVITY_ID }] },
          { dayNumber: 3, items: [{ type: 'ACTIVITY', catalogItemId: ACTIVITY_ID }] },
        ],
      }),
      3,
      entries,
    );
    expect(result.days[0]!.items).toHaveLength(1);
  });

  it('rejects a different number of days', () => {
    expect(() => validatePlanOutput(output(), 5, entries)).toThrow(AiInvalidOutputError);
  });

  it('rejects non-consecutive days', () => {
    expect(() =>
      validatePlanOutput(
        output({
          days: [
            { dayNumber: 2, items: [{ type: 'ACTIVITY', catalogItemId: ACTIVITY_ID }] },
            { dayNumber: 3, items: [{ type: 'ACTIVITY', catalogItemId: ACTIVITY_ID }] },
            { dayNumber: 4, items: [{ type: 'ACTIVITY', catalogItemId: ACTIVITY_ID }] },
          ],
        }),
        3,
        entries,
      ),
    ).toThrow(AiInvalidOutputError);
  });

  it('rejects extra fields and invalid times', () => {
    expect(() =>
      validatePlanOutput(
        output({
          title: 'Plan',
          extra: true,
        }),
        3,
        entries,
      ),
    ).toThrow(AiInvalidOutputError);

    expect(() =>
      validatePlanOutput(
        output({
          days: [
            {
              dayNumber: 1,
              items: [
                { type: 'ACTIVITY', catalogItemId: ACTIVITY_ID, startTime: '25:00' },
              ],
            },
            { dayNumber: 2, items: [{ type: 'ACTIVITY', catalogItemId: ACTIVITY_ID }] },
            { dayNumber: 3, items: [{ type: 'ACTIVITY', catalogItemId: ACTIVITY_ID }] },
          ],
        }),
        3,
        entries,
      ),
    ).toThrow(AiInvalidOutputError);
  });

  it('rejects malformed JSON', () => {
    expect(() => validatePlanOutput('{not json', 3, entries)).toThrow(AiInvalidOutputError);
  });
});
