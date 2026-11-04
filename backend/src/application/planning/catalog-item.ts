import type { PlanItemType, PricingUnit } from '@trazo/shared';
import type {
  ActivityRepository,
  HotelRepository,
  TransportOptionRepository,
} from '../../domain/catalog/ports.js';
import type { TripRequest } from '../../domain/intake/trip-request.js';
import type { Plan } from '../../domain/planning/plan.js';
import { ValidationError } from '../../domain/shared/app-error.js';

export interface CatalogItemSnapshot {
  type: PlanItemType;
  catalogItemId: string;
  name: string;
  imageUrl: string | null;
  unitPriceMinor: number;
  currency: string;
  pricingUnit: PricingUnit;
}

export interface CatalogItemDependencies {
  hotels: HotelRepository;
  activities: ActivityRepository;
  transportOptions: TransportOptionRepository;
}

export async function loadCatalogItem(
  deps: CatalogItemDependencies,
  plan: Plan,
  type: PlanItemType,
  catalogItemId: string,
): Promise<CatalogItemSnapshot> {
  if (type === 'ACCOMMODATION') {
    const hotel = await deps.hotels.findById(catalogItemId);
    if (!hotel || !hotel.isActive) throw new ValidationError('El alojamiento no está disponible');
    if (hotel.destinationId !== plan.destinationId) {
      throw new ValidationError('El alojamiento no pertenece al destino del plan');
    }
    if (hotel.currency !== plan.currency) {
      throw new ValidationError('El alojamiento no usa la moneda del plan');
    }
    return {
      type,
      catalogItemId: hotel.id,
      name: hotel.name,
      imageUrl: hotel.imageUrl,
      unitPriceMinor: hotel.pricePerNightMinor,
      currency: hotel.currency,
      pricingUnit: 'PER_NIGHT',
    };
  }

  if (type === 'ACTIVITY') {
    const activity = await deps.activities.findById(catalogItemId);
    if (!activity || !activity.isActive) throw new ValidationError('La actividad no está disponible');
    if (activity.destinationId !== plan.destinationId) {
      throw new ValidationError('La actividad no pertenece al destino del plan');
    }
    if (activity.currency !== plan.currency) {
      throw new ValidationError('La actividad no usa la moneda del plan');
    }
    return {
      type,
      catalogItemId: activity.id,
      name: activity.name,
      imageUrl: activity.imageUrl,
      unitPriceMinor: activity.pricePerPersonMinor,
      currency: activity.currency,
      pricingUnit: 'PER_PERSON',
    };
  }

  const transport = await deps.transportOptions.findById(catalogItemId);
  if (!transport || !transport.isActive) throw new ValidationError('El transporte no está disponible');
  if (transport.destinationId !== plan.destinationId) {
    throw new ValidationError('El transporte no pertenece al destino del plan');
  }
  if (transport.currency !== plan.currency) {
    throw new ValidationError('El transporte no usa la moneda del plan');
  }
  return {
    type,
    catalogItemId: transport.id,
    name: `${transport.provider} (${transport.mode})`,
    imageUrl: transport.imageUrl,
    unitPriceMinor: transport.priceMinor,
    currency: transport.currency,
    pricingUnit: transport.pricingUnit,
  };
}

export function defaultQuantity(
  snapshot: CatalogItemSnapshot,
  plan: Plan,
  request: TripRequest | null,
): number {
  const durationDays = request?.slots.durationDays ?? plan.days.length;
  const travelers = request
    ? (request.slots.adults ?? 0) + request.slots.children
    : Math.max(
        1,
        ...plan.days.flatMap((day) =>
          day.items.filter((item) => item.type === 'ACTIVITY').map((item) => item.quantity),
        ),
      );

  switch (snapshot.pricingUnit) {
    case 'PER_NIGHT':
      return Math.max(1, durationDays - 1);
    case 'PER_PERSON':
      return Math.max(1, travelers);
    case 'PER_DAY':
      return durationDays;
    case 'PER_TRIP':
      return 1;
  }
}
