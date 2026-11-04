import type { PlanStatus } from '@trazo/shared';
import type { Plan } from './plan.js';

export interface PlanPage<T> {
  items: T[];
  total: number;
}

export interface PlanSearchCriteria {
  /** Only used by ADMIN. ADVISOR queries are always scoped to their own userId. */
  advisorId?: string;
  status?: PlanStatus;
  query?: string;
  destinationId?: string;
  page: number;
  pageSize: number;
}

export interface PlanRepository {
  create(plan: Plan): Promise<Plan>;
  findById(id: string): Promise<Plan | null>;
  findByTripRequestId(tripRequestId: string): Promise<Plan | null>;
  update(plan: Plan): Promise<Plan | null>;
  search(criteria: PlanSearchCriteria): Promise<PlanPage<Plan>>;
}
