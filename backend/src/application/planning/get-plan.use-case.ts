import type { AccessTokenPayload } from '../../domain/identity/ports.js';
import type { DestinationRepository } from '../../domain/catalog/ports.js';
import type { PlanRepository } from '../../domain/planning/ports.js';
import { NotFoundError } from '../../domain/shared/app-error.js';
import { loadPlanForActor } from './access.js';
import type { PlanView } from './views.js';

export class GetPlanUseCase {
  constructor(
    private readonly plans: PlanRepository,
    private readonly destinations: DestinationRepository,
  ) {}

  async execute(id: string, actor: AccessTokenPayload): Promise<PlanView> {
    const plan = await loadPlanForActor(this.plans, id, actor);
    const destination = await this.destinations.findById(plan.destinationId);
    if (!destination) throw new NotFoundError('Destino del plan');
    return { plan, destination };
  }
}
