import type { PricingUnit } from './catalog.types.js';
import type { Money } from './money.js';

export type PlanStatus = 'DRAFT' | 'SAVED' | 'PUBLISHED' | 'ARCHIVED';

export type PlanItemType = 'ACCOMMODATION' | 'ACTIVITY' | 'TRANSPORT';

export interface PlanDestinationDto {
  id: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  heroImageUrl: string | null;
}

export interface PlanItemDto {
  id: string;
  type: PlanItemType;
  catalogItemId: string;
  name: string;
  imageUrl: string | null;
  unitPrice: Money;
  quantity: number;
  pricingUnit: PricingUnit;
  subtotal: Money;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  position: number;
}

export interface PlanDayDto {
  id: string;
  dayNumber: number;
  date: string;
  title: string | null;
  notes: string | null;
  subtotal: Money;
  items: PlanItemDto[];
}

export interface PlanBudgetDto {
  flights: Money;
  hotels: Money;
  activities: Money;
  subtotal: Money;
  marginPercent: number;
  margin: Money;
  total: Money;
}

export interface PlanDto {
  id: string;
  tripRequestId: string;
  title: string | null;
  status: PlanStatus;
  summary: string | null;
  heroImageUrl: string | null;
  tags: string[];
  destination: PlanDestinationDto;
  currency: string;
  days: PlanDayDto[];
  budget: PlanBudgetDto;
  version: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanResponse {
  plan: PlanDto;
}

export interface PlanAlternativeDto {
  id: string;
  type: PlanItemType;
  name: string;
  imageUrl: string | null;
  price: Money;
  pricingUnit: PricingUnit;
  tags: string[];
  category: number | null;
  durationMinutes: number | null;
}

export interface PlanAlternativesResponse {
  itemId: string;
  alternatives: PlanAlternativeDto[];
}

export interface PlanGenerationAccepted {
  tripRequestId: string;
  jobId: string;
  status: 'GENERATING';
  pollAfterMs: number;
}

export interface PlanReportDayDto {
  dayNumber: number;
  date: string;
  subtotal: Money;
  items: Array<{
    type: PlanItemType;
    name: string;
    quantity: number;
    startTime: string | null;
    endTime: string | null;
    notes: string | null;
    subtotal: Money;
  }>;
}

export interface PlanReportDto {
  planId: string;
  title: string | null;
  status: PlanStatus;
  destination: string;
  summary: string | null;
  tags: string[];
  heroImageUrl: string | null;
  days: PlanReportDayDto[];
  budget: PlanBudgetDto;
  generatedAt: string;
}
