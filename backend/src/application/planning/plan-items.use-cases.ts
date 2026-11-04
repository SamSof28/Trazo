import { randomUUID } from 'node:crypto';
import type {
  AddPlanItemInput,
  MovePlanItemInput,
  ReplacePlanItemInput,
  UpdatePlanItemInput,
} from '@trazo/shared';
import type { AccessTokenPayload } from '../../domain/identity/ports.js';
import type { DestinationRepository } from '../../domain/catalog/ports.js';
import type { TripRequestRepository } from '../../domain/intake/ports.js';
import type { PlanRepository } from '../../domain/planning/ports.js';
import type { Clock } from '../../domain/shared/clock.js';
import { NotFoundError } from '../../domain/shared/app-error.js';
import { loadPlanForActor } from './access.js';
import { defaultQuantity, loadCatalogItem, type CatalogItemDependencies } from './catalog-item.js';
import { savePlanView } from './save-plan-view.js';
import type { PlanView } from './views.js';

export interface PlanItemDependencies extends CatalogItemDependencies {
  plans: PlanRepository;
  destinations: DestinationRepository;
  tripRequests: TripRequestRepository;
  clock: Clock;
}

export class AddPlanItemUseCase {
  constructor(private readonly deps: PlanItemDependencies) {}

  async execute(
    planId: string,
    input: AddPlanItemInput,
    actor: AccessTokenPayload,
  ): Promise<PlanView> {
    const plan = await loadPlanForActor(this.deps.plans, planId, actor);
    const snapshot = await loadCatalogItem(this.deps, plan, input.type, input.catalogItemId);
    const request = await this.deps.tripRequests.findById(plan.tripRequestId);
    const quantity = input.quantity ?? defaultQuantity(snapshot, plan, request);

    const updated = plan.addItem(
      input.dayNumber,
      {
        id: randomUUID(),
        type: input.type,
        catalogItemId: snapshot.catalogItemId,
        nameSnapshot: snapshot.name,
        imageUrl: snapshot.imageUrl,
        unitPriceMinor: snapshot.unitPriceMinor,
        quantity,
        pricingUnit: snapshot.pricingUnit,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        notes: input.notes ?? null,
      },
      this.deps.clock.now(),
    );

    return savePlanView(this.deps.plans, this.deps.destinations, updated);
  }
}

export class ReplacePlanItemUseCase {
  constructor(private readonly deps: PlanItemDependencies) {}

  async execute(
    planId: string,
    itemId: string,
    input: ReplacePlanItemInput,
    actor: AccessTokenPayload,
  ): Promise<PlanView> {
    const plan = await loadPlanForActor(this.deps.plans, planId, actor);
    const item = plan.findItem(itemId);
    if (!item) throw new NotFoundError('Ítem del plan');

    const snapshot = await loadCatalogItem(this.deps, plan, item.type, input.catalogItemId);
    const updated = plan.replaceItem(
      itemId,
      {
        id: item.id,
        type: item.type,
        catalogItemId: snapshot.catalogItemId,
        nameSnapshot: snapshot.name,
        imageUrl: snapshot.imageUrl,
        unitPriceMinor: snapshot.unitPriceMinor,
        quantity: item.quantity,
        pricingUnit: snapshot.pricingUnit,
        startTime: item.startTime,
        endTime: item.endTime,
        notes: item.notes,
      },
      this.deps.clock.now(),
    );

    return savePlanView(this.deps.plans, this.deps.destinations, updated);
  }
}

export class UpdatePlanItemUseCase {
  constructor(private readonly deps: PlanItemDependencies) {}

  async execute(
    planId: string,
    itemId: string,
    input: UpdatePlanItemInput,
    actor: AccessTokenPayload,
  ): Promise<PlanView> {
    const plan = await loadPlanForActor(this.deps.plans, planId, actor);
    if (!plan.findItem(itemId)) throw new NotFoundError('Ítem del plan');
    const updated = plan.updateItem(itemId, input, this.deps.clock.now());
    return savePlanView(this.deps.plans, this.deps.destinations, updated);
  }
}

export class MovePlanItemUseCase {
  constructor(private readonly deps: PlanItemDependencies) {}

  async execute(
    planId: string,
    itemId: string,
    input: MovePlanItemInput,
    actor: AccessTokenPayload,
  ): Promise<PlanView> {
    const plan = await loadPlanForActor(this.deps.plans, planId, actor);
    if (!plan.findItem(itemId)) throw new NotFoundError('Ítem del plan');
    const updated = plan.moveItem(
      itemId,
      input.dayNumber,
      input.position,
      this.deps.clock.now(),
    );
    return savePlanView(this.deps.plans, this.deps.destinations, updated);
  }
}

export class RemovePlanItemUseCase {
  constructor(private readonly deps: PlanItemDependencies) {}

  async execute(planId: string, itemId: string, actor: AccessTokenPayload): Promise<PlanView> {
    const plan = await loadPlanForActor(this.deps.plans, planId, actor);
    if (!plan.findItem(itemId)) throw new NotFoundError('Ítem del plan');
    const updated = plan.removeItem(itemId, this.deps.clock.now());
    return savePlanView(this.deps.plans, this.deps.destinations, updated);
  }
}
