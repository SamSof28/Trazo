import { randomUUID } from 'node:crypto';
import type { TripRequest } from '../../domain/intake/trip-request.js';
import {
  Plan,
  type PlanDayInput,
  type PlanItemInput,
} from '../../domain/planning/plan.js';
import { AiInvalidOutputError } from '../../domain/shared/app-error.js';
import type { ValidatedPlanOutput } from '../ai/plan-output.js';
import type { ShortlistEntry, TripShortlist } from './shortlist.js';

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function quantityFor(entry: ShortlistEntry, request: TripRequest): number {
  const durationDays = request.slots.durationDays ?? 1;
  const travelers = (request.slots.adults ?? 0) + request.slots.children;

  switch (entry.pricingUnit) {
    case 'PER_NIGHT':
      return Math.max(0, durationDays - 1);
    case 'PER_PERSON':
      return travelers;
    case 'PER_DAY':
      return durationDays;
    case 'PER_TRIP':
      return 1;
  }
}

function defaultStartTime(type: PlanItemInput['type'], activityIndex: number): string {
  if (type === 'TRANSPORT') return '08:00';
  if (type === 'ACCOMMODATION') return '15:00';
  return activityIndex === 0 ? '09:00' : '14:00';
}

function toItemInput(
  entry: ShortlistEntry,
  item: ValidatedPlanOutput['days'][number]['items'][number],
  request: TripRequest,
  activityIndex: number,
): PlanItemInput | null {
  const quantity = quantityFor(entry, request);
  if (quantity <= 0) return null;

  return {
    id: randomUUID(),
    type: item.type,
    catalogItemId: entry.catalogItemId,
    nameSnapshot: entry.name,
    imageUrl: entry.imageUrl,
    unitPriceMinor: entry.priceMinor,
    quantity,
    pricingUnit: entry.pricingUnit,
    startTime: item.startTime ?? defaultStartTime(item.type, activityIndex),
    endTime: item.endTime,
    notes: item.notes,
  };
}

export function createPlanFromOutput(input: {
  request: TripRequest;
  shortlist: TripShortlist;
  output: ValidatedPlanOutput;
  now: Date;
}): Plan {
  const { request, shortlist, output, now } = input;
  const startDate = shortlist.context.tripRequest.startDate;
  const entries = new Map(shortlist.entries.map((entry) => [entry.catalogItemId, entry]));

  const days: PlanDayInput[] = output.days.map((day, dayIndex) => {
    let activityIndex = 0;
    const items = day.items.flatMap((item) => {
      const entry = entries.get(item.catalogItemId);
      if (!entry) return [];
      const built = toItemInput(entry, item, request, activityIndex);
      if (!built) return [];
      if (built.type === 'ACTIVITY') activityIndex += 1;
      return [built];
    });

    if (items.length === 0) {
      throw new AiInvalidOutputError(
        `El día ${day.dayNumber} quedó sin ítems válidos para la solicitud`,
      );
    }

    return {
      id: randomUUID(),
      dayNumber: day.dayNumber,
      date: addDays(startDate, dayIndex),
      title: day.title,
      notes: day.notes,
      items,
    };
  });

  return Plan.createDraft({
    id: randomUUID(),
    tripRequestId: request.id,
    advisorId: request.advisorId,
    destinationId: shortlist.destination.id,
    title: output.title,
    summary: output.summary,
    heroImageUrl: shortlist.destination.heroImageUrl,
    tags: request.slots.interests,
    currency: request.slots.currency,
    marginPercent: 0,
    days,
    now,
  });
}
