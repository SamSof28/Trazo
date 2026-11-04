import { randomUUID } from 'node:crypto';
import type { AccessTokenPayload } from '../../domain/identity/ports.js';
import type { DestinationRepository } from '../../domain/catalog/ports.js';
import type { TripRequestRepository } from '../../domain/intake/ports.js';
import { TripRequest } from '../../domain/intake/trip-request.js';
import type { PlanRepository } from '../../domain/planning/ports.js';
import {
  Plan,
  type PlanDayInput,
} from '../../domain/planning/plan.js';
import type { Clock } from '../../domain/shared/clock.js';
import { NotFoundError } from '../../domain/shared/app-error.js';
import { loadPlanForActor } from './access.js';
import { savePlanView } from './save-plan-view.js';
import type { PlanView } from './views.js';

export interface PlanLifecycleDependencies {
  plans: PlanRepository;
  destinations: DestinationRepository;
  tripRequests: TripRequestRepository;
  clock: Clock;
}

export class SavePlanUseCase {
  constructor(private readonly deps: PlanLifecycleDependencies) {}

  async execute(id: string, actor: AccessTokenPayload): Promise<PlanView> {
    const plan = await loadPlanForActor(this.deps.plans, id, actor);
    const saved = plan.save(this.deps.clock.now());
    return savePlanView(this.deps.plans, this.deps.destinations, saved);
  }
}

export class PublishPlanUseCase {
  constructor(private readonly deps: PlanLifecycleDependencies) {}

  async execute(id: string, actor: AccessTokenPayload): Promise<PlanView> {
    const plan = await loadPlanForActor(this.deps.plans, id, actor);
    const published = plan.publish(this.deps.clock.now());
    return savePlanView(this.deps.plans, this.deps.destinations, published);
  }
}

export class ArchivePlanUseCase {
  constructor(private readonly deps: PlanLifecycleDependencies) {}

  async execute(id: string, actor: AccessTokenPayload): Promise<PlanView> {
    const plan = await loadPlanForActor(this.deps.plans, id, actor);
    const archived = plan.archive(this.deps.clock.now());
    return savePlanView(this.deps.plans, this.deps.destinations, archived);
  }
}

function copyTitle(title: string | null): string {
  const base = title?.trim() || 'Plan turístico';
  const suffix = ' (copia)';
  return `${base.slice(0, 120 - suffix.length)}${suffix}`;
}

export class DuplicatePlanUseCase {
  constructor(private readonly deps: PlanLifecycleDependencies) {}

  async execute(id: string, actor: AccessTokenPayload): Promise<PlanView> {
    const source = await loadPlanForActor(this.deps.plans, id, actor);
    const original = await this.deps.tripRequests.findById(source.tripRequestId);
    if (!original) throw new NotFoundError('Solicitud de viaje');

    const now = this.deps.clock.now();
    const copyRequest = TripRequest.fromPersistence({
      id: randomUUID(),
      advisorId: source.advisorId,
      promptOriginal: `Copia de: ${source.title ?? 'plan turístico'}`.slice(0, 2000),
      status: 'GENERATED',
      slots: original.slots,
      extractedSlots: original.extractedSlots,
      missingFields: [],
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    await this.deps.tripRequests.create(copyRequest);

    const days: PlanDayInput[] = source.days.map((day) => ({
      id: randomUUID(),
      dayNumber: day.dayNumber,
      date: day.date,
      title: day.title,
      notes: day.notes,
      items: day.items.map((item) => ({
        id: randomUUID(),
        type: item.type,
        catalogItemId: item.catalogItemId,
        nameSnapshot: item.nameSnapshot,
        imageUrl: item.imageUrl,
        unitPriceMinor: item.unitPriceMinor,
        quantity: item.quantity,
        pricingUnit: item.pricingUnit,
        startTime: item.startTime,
        endTime: item.endTime,
        notes: item.notes,
        position: item.position,
      })),
    }));

    const copy = Plan.createDraft({
      id: randomUUID(),
      tripRequestId: copyRequest.id,
      advisorId: source.advisorId,
      destinationId: source.destinationId,
      title: copyTitle(source.title),
      summary: source.summary,
      heroImageUrl: source.heroImageUrl,
      tags: source.tags,
      currency: source.currency,
      marginPercent: source.marginPercent,
      version: source.version + 1,
      days,
      now,
    });

    const created = await this.deps.plans.create(copy);
    const destination = await this.deps.destinations.findById(created.destinationId);
    if (!destination) throw new NotFoundError('Destino del plan');
    return { plan: created, destination };
  }
}
