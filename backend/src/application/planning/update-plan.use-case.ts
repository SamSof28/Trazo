import type { UpdatePlanInput } from '@trazo/shared';
import type { AccessTokenPayload } from '../../domain/identity/ports.js';
import type { DestinationRepository } from '../../domain/catalog/ports.js';
import type { PlanRepository } from '../../domain/planning/ports.js';
import type { Clock } from '../../domain/shared/clock.js';
import { NotFoundError } from '../../domain/shared/app-error.js';
import { loadPlanForActor } from './access.js';
import type { PlanView } from './views.js';

export class UpdatePlanUseCase {
  constructor(
    private readonly plans: PlanRepository,
    private readonly destinations: DestinationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    id: string,
    input: UpdatePlanInput,
    actor: AccessTokenPayload,
  ): Promise<PlanView> {
    const plan = await loadPlanForActor(this.plans, id, actor);
    const now = this.clock.now();

    let updated = plan;
    if (input.title !== undefined || input.summary !== undefined || input.tags !== undefined) {
      updated = updated.withMetadata(
        { title: input.title, summary: input.summary, tags: input.tags },
        now,
      );
    }
    if (input.marginPercent !== undefined) {
      updated = updated.withMargin(input.marginPercent, now);
    }

    const saved = await this.plans.update(updated);
    if (!saved) throw new NotFoundError('Plan');

    const destination = await this.destinations.findById(saved.destinationId);
    if (!destination) throw new NotFoundError('Destino del plan');
    return { plan: saved, destination };
  }
}
