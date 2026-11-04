import { describe, expect, it } from 'vitest';
import {
  computePlanBudget,
  type PlanDayProps,
} from '../src/domain/planning/plan.js';
import {
  ConflictError,
  PlanNotEditableError,
  ValidationError,
} from '../src/domain/shared/app-error.js';
import { makePlan, PLAN_ITEM_ACTIVITY, PLAN_ITEM_HOTEL } from './planning-fakes.js';

const LATER = new Date('2026-11-04T15:00:00.000Z');

describe('Plan budget', () => {
  it('groups subtotals by category and rounds the margin half-up once', () => {
    const plan = makePlan({ marginPercent: 10 });
    const budget = plan.budget;

    expect(budget.flightsMinor).toBe(0);
    expect(budget.hotelsMinor).toBe(512_000_000);
    expect(budget.activitiesMinor).toBe(24_000_000);
    expect(budget.subtotalMinor).toBe(536_000_000);
    expect(budget.marginMinor).toBe(53_600_000);
    expect(budget.totalMinor).toBe(589_600_000);
  });

  it('rounds a half minor unit up', () => {
    const days: PlanDayProps[] = [
      {
        id: 'day-1',
        dayNumber: 1,
        date: '2026-12-10',
        title: null,
        notes: null,
        items: [
          {
            id: 'item-1',
            type: 'ACTIVITY',
            catalogItemId: 'catalog-1',
            nameSnapshot: 'Actividad',
            imageUrl: null,
            unitPriceMinor: 1,
            quantity: 1,
            pricingUnit: 'PER_PERSON',
            subtotalMinor: 1,
            startTime: null,
            endTime: null,
            notes: null,
            position: 0,
          },
        ],
      },
    ];

    const budget = computePlanBudget(days, 50);
    expect(budget.subtotalMinor).toBe(1);
    expect(budget.marginMinor).toBe(1);
    expect(budget.totalMinor).toBe(2);
  });

  it('rejects margins outside 0..100', () => {
    expect(() => makePlan({ marginPercent: 100.01 })).toThrow(ValidationError);
    expect(() => makePlan({ marginPercent: -1 })).toThrow(ValidationError);
  });
});

describe('Plan editing', () => {
  it('adds, updates, moves and removes items while recalculating the budget', () => {
    const plan = makePlan();
    const added = plan.addItem(
      1,
      {
        id: 'new-item',
        type: 'ACTIVITY',
        catalogItemId: '99999999-9999-4999-8999-999999999999',
        nameSnapshot: 'Otra actividad',
        unitPriceMinor: 5_000_000,
        quantity: 2,
        pricingUnit: 'PER_PERSON',
        startTime: '16:00',
      },
      LATER,
    );

    expect(added.days[0]!.items).toHaveLength(3);
    expect(added.budget.activitiesMinor).toBe(34_000_000);

    const updated = added.updateItem(PLAN_ITEM_ACTIVITY, { quantity: 3 }, LATER);
    expect(updated.days[0]!.items[1]!.subtotalMinor).toBe(36_000_000);

    const moved = updated.moveItem('new-item', 1, 0, LATER);
    expect(moved.days[0]!.items[0]!.id).toBe('new-item');

    const removed = moved.removeItem(PLAN_ITEM_HOTEL, LATER);
    expect(removed.days[0]!.items.map((item) => item.id)).not.toContain(PLAN_ITEM_HOTEL);
    expect(removed.budget.hotelsMinor).toBe(0);
  });

  it('rejects replacements of a different type', () => {
    const plan = makePlan();
    expect(() =>
      plan.replaceItem(
        PLAN_ITEM_HOTEL,
        {
          id: PLAN_ITEM_HOTEL,
          type: 'ACTIVITY',
          catalogItemId: '99999999-9999-4999-8999-999999999999',
          nameSnapshot: 'Actividad',
          unitPriceMinor: 1,
          quantity: 1,
          pricingUnit: 'PER_PERSON',
        },
        LATER,
      ),
    ).toThrow(ValidationError);
  });

  it('does not allow more than six items per day', () => {
    let plan = makePlan();
    for (let index = 0; index < 4; index += 1) {
      plan = plan.addItem(
        1,
        {
          id: `extra-${index}`,
          type: 'ACTIVITY',
          catalogItemId: '99999999-9999-4999-8999-999999999999',
          nameSnapshot: 'Actividad extra',
          unitPriceMinor: 1_000_000,
          quantity: 1,
          pricingUnit: 'PER_PERSON',
        },
        LATER,
      );
    }
    expect(plan.days[0]!.items).toHaveLength(6);
    expect(() =>
      plan.addItem(
        1,
        {
          id: 'too-many',
          type: 'ACTIVITY',
          catalogItemId: '99999999-9999-4999-8999-999999999999',
          nameSnapshot: 'Actividad extra',
          unitPriceMinor: 1_000_000,
          quantity: 1,
          pricingUnit: 'PER_PERSON',
        },
        LATER,
      ),
    ).toThrow(ValidationError);
  });

  it('marks a draft as SAVED and keeps it editable', () => {
    const saved = makePlan().save(LATER);
    expect(saved.status).toBe('SAVED');
    expect(saved.canEdit).toBe(true);
    expect(saved.withMetadata({ title: 'Nuevo título' }, LATER).title).toBe('Nuevo título');
  });

  it('rejects edits on a published plan', () => {
    const published = makePlan().publish(LATER);
    expect(published.status).toBe('PUBLISHED');
    expect(() => published.withMetadata({ title: 'Cambio' }, LATER)).toThrow(
      PlanNotEditableError,
    );
    expect(() => published.addItem(
      1,
      {
        id: 'new-item',
        type: 'ACTIVITY',
        catalogItemId: '99999999-9999-4999-8999-999999999999',
        nameSnapshot: 'Actividad',
        unitPriceMinor: 1,
        quantity: 1,
        pricingUnit: 'PER_PERSON',
      },
      LATER,
    )).toThrow(PlanNotEditableError);
  });
});

describe('Plan lifecycle', () => {
  it('requires a title and at least one item to publish', () => {
    expect(() => makePlan({ title: null }).publish(LATER)).toThrow(ValidationError);
    expect(() =>
      makePlan({
        days: [
          {
            id: 'empty-day',
            dayNumber: 1,
            date: '2026-12-10',
            title: null,
            notes: null,
            items: [],
          },
        ],
      }).publish(LATER),
    ).toThrow(ValidationError);
  });

  it('rejects publishing twice', () => {
    const published = makePlan().publish(LATER);
    expect(() => published.publish(LATER)).toThrow(ConflictError);
  });

  it('archives a plan and refuses to publish it again', () => {
    const archived = makePlan().archive(LATER);
    expect(archived.status).toBe('ARCHIVED');
    expect(() => archived.publish(LATER)).toThrow(PlanNotEditableError);
  });

  it('increments the version on every mutation', () => {
    const plan = makePlan();
    const updated = plan.withMetadata({ title: 'Otro título' }, LATER);
    expect(updated.version).toBe(plan.version + 1);
    expect(updated.updatedAt).toEqual(LATER);
  });
});
