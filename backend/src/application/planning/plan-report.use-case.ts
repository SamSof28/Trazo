import type { PlanReportDto } from '@trazo/shared';
import type { AccessTokenPayload } from '../../domain/identity/ports.js';
import type { DestinationRepository } from '../../domain/catalog/ports.js';
import type { PlanRepository } from '../../domain/planning/ports.js';
import { NotFoundError } from '../../domain/shared/app-error.js';
import { loadPlanForActor } from './access.js';
import { toPlanReportDto } from './presenter.js';

export class GetPlanReportUseCase {
  constructor(
    private readonly plans: PlanRepository,
    private readonly destinations: DestinationRepository,
  ) {}

  async execute(planId: string, actor: AccessTokenPayload): Promise<PlanReportDto> {
    const plan = await loadPlanForActor(this.plans, planId, actor);
    const destination = await this.destinations.findById(plan.destinationId);
    if (!destination) throw new NotFoundError('Destino del plan');
    return toPlanReportDto(plan, destination);
  }
}
