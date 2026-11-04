import type { PlanStatus } from '@turiviaje/shared';
import type { AccessTokenPayload } from '../../domain/identity/ports.js';
import type { Destination } from '../../domain/catalog/destination.js';
import type { DestinationRepository } from '../../domain/catalog/ports.js';
import type { PlanRepository } from '../../domain/planning/ports.js';
import { NotFoundError } from '../../domain/shared/app-error.js';
import type { PlanView } from './views.js';

export interface ListPlansInput {
  actor: AccessTokenPayload;
  status?: PlanStatus;
  query?: string;
  destinationId?: string;
  page: number;
  pageSize: number;
}

export class ListPlansUseCase {
  constructor(
    private readonly plans: PlanRepository,
    private readonly destinations: DestinationRepository,
  ) {}

  async execute(input: ListPlansInput): Promise<{ items: PlanView[]; total: number }> {
    const result = await this.plans.search({
      advisorId: input.actor.role === 'ADMIN' ? undefined : input.actor.userId,
      status: input.status,
      query: input.query,
      destinationId: input.destinationId,
      page: input.page,
      pageSize: input.pageSize,
    });

    const cache = new Map<string, Destination>();
    const items: PlanView[] = [];
    for (const plan of result.items) {
      let destination = cache.get(plan.destinationId);
      if (!destination) {
        const found = await this.destinations.findById(plan.destinationId);
        if (!found) throw new NotFoundError('Destino del plan');
        destination = found;
        cache.set(found.id, found);
      }
      items.push({ plan, destination });
    }

    return { items, total: result.total };
  }
}
