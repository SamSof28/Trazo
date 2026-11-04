import type { PricingUnit } from '@trazo/shared';
import type { AiJob } from './job.js';

export interface AiPlannerContextItem {
  id: string;
  type: 'HOTEL' | 'ACTIVITY' | 'TRANSPORT';
  name: string;
  tags: string[];
  priceHintMinor: number;
  currency: string;
  pricingUnit: PricingUnit;
  durationMinutes?: number;
  intensity?: 'LOW' | 'MEDIUM' | 'HIGH';
  mode?: string;
}

export interface AiPlannerContext {
  destination: {
    id: string;
    city: string;
    country: string;
  };
  tripRequest: {
    destinationId: string;
    startDate: string;
    durationDays: number;
    adults: number;
    children: number;
    travelerType: string | null;
    interests: string[];
    budgetMinMinor: number | null;
    budgetMaxMinor: number | null;
    currency: string;
  };
  shortlist: AiPlannerContextItem[];
}

export interface AiPlannerInput {
  system: string;
  user: string;
  timeoutMs: number;
  /** Structured context for deterministic adapters. Providers must not treat it as instructions. */
  context: AiPlannerContext;
}

export interface AiPlannerResult {
  json: unknown;
  model: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
}

export interface AiPlannerPort {
  generateJson(input: AiPlannerInput): Promise<AiPlannerResult>;
}

export interface AiJobRepository {
  create(job: AiJob): Promise<AiJob>;
  findById(id: string): Promise<AiJob | null>;
  update(job: AiJob): Promise<AiJob | null>;
}

export interface PlanGenerationRunner {
  /** Starts the job without blocking the HTTP response. */
  run(jobId: string): void;
}
