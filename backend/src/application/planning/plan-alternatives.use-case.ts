import type {
  PlanAlternativeDto,
  PlanAlternativesResponse,
  PlanItemType,
} from '@trazo/shared';
import type { AccessTokenPayload } from '../../domain/identity/ports.js';
import type {
  ActivityRepository,
  HotelRepository,
  TransportOptionRepository,
} from '../../domain/catalog/ports.js';
import type { PlanRepository } from '../../domain/planning/ports.js';
import { NotFoundError } from '../../domain/shared/app-error.js';
import { loadPlanForActor } from './access.js';

const LIMIT = 3;

export interface PlanAlternativesDependencies {
  plans: PlanRepository;
  hotels: HotelRepository;
  activities: ActivityRepository;
  transportOptions: TransportOptionRepository;
}

export class ListPlanAlternativesUseCase {
  constructor(private readonly deps: PlanAlternativesDependencies) {}

  async execute(
    planId: string,
    itemId: string,
    actor: AccessTokenPayload,
  ): Promise<PlanAlternativesResponse> {
    const plan = await loadPlanForActor(this.deps.plans, planId, actor);
    const item = plan.findItem(itemId);
    if (!item) throw new NotFoundError('Ítem del plan');

    const alternatives = await this.loadAlternatives(
      plan.destinationId,
      plan.currency,
      item.type,
      item.catalogItemId,
    );

    return { itemId, alternatives };
  }

  private async loadAlternatives(
    destinationId: string,
    currency: string,
    type: PlanItemType,
    currentCatalogItemId: string,
  ): Promise<PlanAlternativeDto[]> {
    if (type === 'ACCOMMODATION') {
      const result = await this.deps.hotels.search({
        destinationId,
        page: 1,
        pageSize: 100,
      });
      return result.items
        .filter((hotel) => hotel.id !== currentCatalogItemId && hotel.currency === currency)
        .sort((a, b) => a.pricePerNightMinor - b.pricePerNightMinor)
        .slice(0, LIMIT)
        .map((hotel) => ({
          id: hotel.id,
          type,
          name: hotel.name,
          imageUrl: hotel.imageUrl,
          price: { amountMinor: hotel.pricePerNightMinor, currency: hotel.currency },
          pricingUnit: 'PER_NIGHT',
          tags: [],
          category: hotel.category,
          durationMinutes: null,
        }));
    }

    if (type === 'ACTIVITY') {
      const result = await this.deps.activities.search({
        destinationId,
        page: 1,
        pageSize: 100,
      });
      return result.items
        .filter(
          (activity) => activity.id !== currentCatalogItemId && activity.currency === currency,
        )
        .sort((a, b) => a.pricePerPersonMinor - b.pricePerPersonMinor)
        .slice(0, LIMIT)
        .map((activity) => ({
          id: activity.id,
          type,
          name: activity.name,
          imageUrl: activity.imageUrl,
          price: { amountMinor: activity.pricePerPersonMinor, currency: activity.currency },
          pricingUnit: 'PER_PERSON',
          tags: activity.tags,
          category: null,
          durationMinutes: activity.durationMinutes,
        }));
    }

    const result = await this.deps.transportOptions.search({
      destinationId,
      page: 1,
      pageSize: 100,
    });
    return result.items
      .filter((option) => option.id !== currentCatalogItemId && option.currency === currency)
      .sort((a, b) => a.priceMinor - b.priceMinor)
      .slice(0, LIMIT)
      .map((option) => ({
        id: option.id,
        type,
        name: `${option.provider} (${option.mode})`,
        imageUrl: null,
        price: { amountMinor: option.priceMinor, currency: option.currency },
        pricingUnit: option.pricingUnit,
        tags: [option.mode],
        category: null,
        durationMinutes: option.durationMinutes,
      }));
  }
}
