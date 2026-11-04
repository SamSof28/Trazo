import { Plan } from '../src/domain/planning/plan.js';
import type {
  PlanPage,
  PlanRepository,
  PlanSearchCriteria,
} from '../src/domain/planning/ports.js';
import type { AiJob } from '../src/domain/ai/job.js';
import type { AiJobRepository, PlanGenerationRunner } from '../src/domain/ai/ports.js';
import type { RunGenerationJobUseCase } from '../src/application/planning/run-generation-job.use-case.js';
import { NOW } from './fakes.js';
import { DEST_CARTAGENA, HOTEL_CASA_SAN_AGUSTIN } from './catalog-fakes.js';

export const PLAN_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
export const PLAN_DAY_1 = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
export const PLAN_ITEM_HOTEL = '12121212-1212-4212-8212-121212121212';
export const PLAN_ITEM_ACTIVITY = '34343434-3434-4434-8434-343434343434';

export function makePlan(
  overrides: Partial<Parameters<typeof Plan.fromPersistence>[0]> = {},
): Plan {
  return Plan.fromPersistence({
    id: PLAN_ID,
    tripRequestId: 'trip-request-1',
    advisorId: 'user-1',
    destinationId: DEST_CARTAGENA,
    title: 'Cartagena Esencial 5 días',
    status: 'DRAFT',
    summary: 'Un plan de prueba con catálogo real.',
    heroImageUrl: 'https://example.com/cartagena.jpg',
    tags: ['playa', 'cultura'],
    currency: 'COP',
    marginPercent: 10,
    version: 1,
    publishedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    days: [
      {
        id: PLAN_DAY_1,
        dayNumber: 1,
        date: '2026-12-10',
        title: 'Llegada a Cartagena',
        notes: null,
        items: [
          {
            id: PLAN_ITEM_HOTEL,
            type: 'ACCOMMODATION',
            catalogItemId: HOTEL_CASA_SAN_AGUSTIN,
            nameSnapshot: 'Hotel Casa San Agustín',
            imageUrl: null,
            unitPriceMinor: 128_000_000,
            quantity: 4,
            pricingUnit: 'PER_NIGHT',
            subtotalMinor: 512_000_000,
            startTime: '15:00',
            endTime: null,
            notes: 'Check-in',
            position: 0,
          },
          {
            id: PLAN_ITEM_ACTIVITY,
            type: 'ACTIVITY',
            catalogItemId: '99999999-9999-4999-8999-999999999999',
            nameSnapshot: 'City tour por la ciudad amurallada',
            imageUrl: null,
            unitPriceMinor: 12_000_000,
            quantity: 2,
            pricingUnit: 'PER_PERSON',
            subtotalMinor: 24_000_000,
            startTime: '09:00',
            endTime: '12:00',
            notes: null,
            position: 1,
          },
        ],
      },
    ],
    ...overrides,
  });
}

export class InMemoryPlanRepository implements PlanRepository {
  private readonly items = new Map<string, Plan>();

  constructor(items: Plan[] = []) {
    for (const item of items) this.items.set(item.id, item);
  }

  async create(plan: Plan): Promise<Plan> {
    this.items.set(plan.id, plan);
    return plan;
  }

  async findById(id: string): Promise<Plan | null> {
    return this.items.get(id) ?? null;
  }

  async findByTripRequestId(tripRequestId: string): Promise<Plan | null> {
    return (
      [...this.items.values()].find(
        (plan) => plan.tripRequestId === tripRequestId && plan.deletedAt === null,
      ) ?? null
    );
  }

  async update(plan: Plan): Promise<Plan | null> {
    if (!this.items.has(plan.id)) return null;
    this.items.set(plan.id, plan);
    return plan;
  }

  async search(criteria: PlanSearchCriteria): Promise<PlanPage<Plan>> {
    const query = criteria.query?.toLowerCase();
    const filtered = [...this.items.values()]
      .filter((plan) => plan.deletedAt === null)
      .filter((plan) => !criteria.advisorId || plan.advisorId === criteria.advisorId)
      .filter((plan) => !criteria.status || plan.status === criteria.status)
      .filter((plan) => !criteria.destinationId || plan.destinationId === criteria.destinationId)
      .filter(
        (plan) =>
          !query ||
          (plan.title ?? '').toLowerCase().includes(query) ||
          (plan.summary ?? '').toLowerCase().includes(query),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const start = (criteria.page - 1) * criteria.pageSize;
    return {
      items: filtered.slice(start, start + criteria.pageSize),
      total: filtered.length,
    };
  }
}

export class InMemoryAiJobRepository implements AiJobRepository {
  private readonly items = new Map<string, AiJob>();

  constructor(items: AiJob[] = []) {
    for (const item of items) this.items.set(item.id, item);
  }

  async create(job: AiJob): Promise<AiJob> {
    this.items.set(job.id, job);
    return job;
  }

  async findById(id: string): Promise<AiJob | null> {
    return this.items.get(id) ?? null;
  }

  async update(job: AiJob): Promise<AiJob | null> {
    if (!this.items.has(job.id)) return null;
    this.items.set(job.id, job);
    return job;
  }

  all(): AiJob[] {
    return [...this.items.values()];
  }
}

/** Lets HTTP tests wait until the in-process generation job finishes. */
export class DeferredGenerationRunner implements PlanGenerationRunner {
  private pending: Promise<void>[] = [];

  constructor(private readonly runJob: RunGenerationJobUseCase) {}

  run(jobId: string): void {
    this.pending.push(this.runJob.execute(jobId));
  }

  async drain(): Promise<void> {
    await Promise.all(this.pending);
    this.pending = [];
  }
}
