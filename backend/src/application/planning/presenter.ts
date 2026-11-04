import type {
  Money,
  PlanBudgetDto,
  PlanDayDto,
  PlanDto,
  PlanItemDto,
  PlanReportDto,
} from '@turiviaje/shared';
import type { Destination } from '../../domain/catalog/destination.js';
import type { Plan, PlanDayProps, PlanItemProps } from '../../domain/planning/plan.js';

function money(amountMinor: number, currency: string): Money {
  return { amountMinor, currency };
}

function daySubtotal(day: PlanDayProps): number {
  return day.items.reduce((total, item) => total + item.subtotalMinor, 0);
}

function toItemDto(item: PlanItemProps, currency: string): PlanItemDto {
  return {
    id: item.id,
    type: item.type,
    catalogItemId: item.catalogItemId,
    name: item.nameSnapshot,
    imageUrl: item.imageUrl,
    unitPrice: money(item.unitPriceMinor, currency),
    quantity: item.quantity,
    pricingUnit: item.pricingUnit,
    subtotal: money(item.subtotalMinor, currency),
    startTime: item.startTime,
    endTime: item.endTime,
    notes: item.notes,
    position: item.position,
  };
}

function toDayDto(day: PlanDayProps, currency: string): PlanDayDto {
  return {
    id: day.id,
    dayNumber: day.dayNumber,
    date: day.date,
    title: day.title,
    notes: day.notes,
    subtotal: money(daySubtotal(day), currency),
    items: day.items.map((item) => toItemDto(item, currency)),
  };
}

export function toPlanBudgetDto(plan: Plan): PlanBudgetDto {
  const budget = plan.budget;
  return {
    flights: money(budget.flightsMinor, plan.currency),
    hotels: money(budget.hotelsMinor, plan.currency),
    activities: money(budget.activitiesMinor, plan.currency),
    subtotal: money(budget.subtotalMinor, plan.currency),
    marginPercent: budget.marginPercent,
    margin: money(budget.marginMinor, plan.currency),
    total: money(budget.totalMinor, plan.currency),
  };
}

export function toPlanDto(plan: Plan, destination: Destination): PlanDto {
  return {
    id: plan.id,
    tripRequestId: plan.tripRequestId,
    title: plan.title,
    status: plan.status,
    summary: plan.summary,
    heroImageUrl: plan.heroImageUrl,
    tags: plan.tags,
    destination: {
      id: destination.id,
      city: destination.city,
      country: destination.country,
      latitude: destination.latitude,
      longitude: destination.longitude,
      timezone: destination.timezone,
      heroImageUrl: destination.heroImageUrl,
    },
    currency: plan.currency,
    days: plan.days.map((day) => toDayDto(day, plan.currency)),
    budget: toPlanBudgetDto(plan),
    version: plan.version,
    publishedAt: plan.publishedAt?.toISOString() ?? null,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

export function toPlanReportDto(plan: Plan, destination: Destination): PlanReportDto {
  return {
    planId: plan.id,
    title: plan.title,
    status: plan.status,
    destination: `${destination.city}, ${destination.country}`,
    days: plan.days.map((day) => ({
      dayNumber: day.dayNumber,
      date: day.date,
      subtotal: money(daySubtotal(day), plan.currency),
      items: day.items.map((item) => ({
        type: item.type,
        name: item.nameSnapshot,
        quantity: item.quantity,
        subtotal: money(item.subtotalMinor, plan.currency),
      })),
    })),
    budget: toPlanBudgetDto(plan),
    generatedAt: new Date().toISOString(),
  };
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function reportToCsv(report: PlanReportDto): string {
  const rows: string[][] = [
    ['plan', report.planId],
    ['titulo', report.title ?? ''],
    ['estado', report.status],
    ['destino', report.destination],
    ['dia', 'fecha', 'tipo', 'item', 'cantidad', 'subtotal_minor', 'moneda'],
  ];

  for (const day of report.days) {
    for (const item of day.items) {
      rows.push([
        String(day.dayNumber),
        day.date,
        item.type,
        item.name,
        String(item.quantity),
        String(item.subtotal.amountMinor),
        item.subtotal.currency,
      ]);
    }
  }

  rows.push([]);
  rows.push(['subtotal', String(report.budget.subtotal.amountMinor), report.budget.subtotal.currency]);
  rows.push(['margen_pct', String(report.budget.marginPercent)]);
  rows.push(['margen', String(report.budget.margin.amountMinor), report.budget.margin.currency]);
  rows.push(['total', String(report.budget.total.amountMinor), report.budget.total.currency]);

  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}
