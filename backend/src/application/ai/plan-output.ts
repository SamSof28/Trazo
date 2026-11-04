import type { PlanItemType, PricingUnit } from '@turiviaje/shared';
import { AiInvalidOutputError } from '../../domain/shared/app-error.js';
import { planOutputSchema } from './plan-output.schema.js';

export interface PlanCatalogEntry {
  catalogItemId: string;
  type: 'HOTEL' | 'ACTIVITY' | 'TRANSPORT';
  name: string;
  imageUrl: string | null;
  currency: string;
  pricingUnit: PricingUnit;
}

export interface ValidatedPlanItem {
  type: PlanItemType;
  catalogItemId: string;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
}

export interface ValidatedPlanDay {
  dayNumber: number;
  title: string | null;
  notes: string | null;
  items: ValidatedPlanItem[];
}

export interface ValidatedPlanOutput {
  title: string;
  summary: string | null;
  days: ValidatedPlanDay[];
}

const TYPE_MATCH: Record<PlanItemType, PlanCatalogEntry['type']> = {
  ACCOMMODATION: 'HOTEL',
  ACTIVITY: 'ACTIVITY',
  TRANSPORT: 'TRANSPORT',
};

function parseJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AiInvalidOutputError('La IA no devolvió JSON válido');
  }
}

/**
 * Validates the model output and grounds every catalog id against the shortlist.
 * Unknown ids are dropped (the rest of the plan survives), but a day cannot stay empty.
 */
export function validatePlanOutput(
  raw: unknown,
  expectedDays: number,
  entries: readonly PlanCatalogEntry[],
): ValidatedPlanOutput {
  const result = planOutputSchema.safeParse(parseJson(raw));
  if (!result.success) {
    const detail = result.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new AiInvalidOutputError(`El itinerario no cumple el esquema: ${detail}`);
  }

  if (expectedDays < 1 || expectedDays > 30) {
    throw new AiInvalidOutputError('La duración de la solicitud no permite generar un plan');
  }
  if (result.data.days.length !== expectedDays) {
    throw new AiInvalidOutputError(
      `El itinerario debe tener exactamente ${expectedDays} días y llegaron ${result.data.days.length}`,
    );
  }

  const byId = new Map(entries.map((entry) => [entry.catalogItemId, entry]));
  let accommodationUsed = false;

  const days = result.data.days.map((day, index) => {
    const expectedNumber = index + 1;
    if (day.dayNumber !== expectedNumber) {
      throw new AiInvalidOutputError('Los días del itinerario deben ser consecutivos desde 1');
    }

    const items: ValidatedPlanItem[] = [];
    for (const item of day.items) {
      const entry = byId.get(item.catalogItemId);
      if (!entry || entry.type !== TYPE_MATCH[item.type]) continue;
      if (item.type === 'ACCOMMODATION') {
        if (accommodationUsed) continue;
        accommodationUsed = true;
      }
      items.push({
        type: item.type,
        catalogItemId: entry.catalogItemId,
        startTime: item.startTime ?? null,
        endTime: item.endTime ?? null,
        notes: item.notes ?? null,
      });
    }

    if (items.length === 0) {
      throw new AiInvalidOutputError(`El día ${expectedNumber} no tiene ítems válidos del catálogo`);
    }

    return {
      dayNumber: expectedNumber,
      title: day.title ?? null,
      notes: day.notes ?? null,
      items,
    };
  });

  return {
    title: result.data.title,
    summary: result.data.summary ?? null,
    days,
  };
}
