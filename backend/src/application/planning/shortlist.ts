import type { PricingUnit } from '@trazo/shared';
import type { Activity } from '../../domain/catalog/activity.js';
import type { Destination } from '../../domain/catalog/destination.js';
import type { Hotel } from '../../domain/catalog/hotel.js';
import type {
  ActivityRepository,
  DestinationRepository,
  HotelRepository,
  TransportOptionRepository,
} from '../../domain/catalog/ports.js';
import type { TransportOption } from '../../domain/catalog/transport-option.js';
import type { TripRequest } from '../../domain/intake/trip-request.js';
import type { AiPlannerContext, AiPlannerContextItem } from '../../domain/ai/ports.js';
import { NotFoundError, ValidationError } from '../../domain/shared/app-error.js';

export interface ShortlistEntry {
  catalogItemId: string;
  type: 'HOTEL' | 'ACTIVITY' | 'TRANSPORT';
  name: string;
  imageUrl: string | null;
  priceMinor: number;
  currency: string;
  pricingUnit: PricingUnit;
  context: AiPlannerContextItem;
}

export interface TripShortlist {
  destination: Destination;
  entries: ShortlistEntry[];
  context: AiPlannerContext;
}

export interface ShortlistDependencies {
  destinations: DestinationRepository;
  hotels: HotelRepository;
  activities: ActivityRepository;
  transportOptions: TransportOptionRepository;
}

const LIMITS = { hotels: 12, activities: 24, transport: 8 } as const;

function interestScore(tags: readonly string[], interests: readonly string[]): number {
  return tags.filter((tag) => interests.includes(tag)).length;
}

function entryFromHotel(hotel: Hotel): ShortlistEntry {
  const context: AiPlannerContextItem = {
    id: hotel.id,
    type: 'HOTEL',
    name: hotel.name,
    tags: [],
    priceHintMinor: hotel.pricePerNightMinor,
    currency: hotel.currency,
    pricingUnit: 'PER_NIGHT',
  };
  return {
    catalogItemId: hotel.id,
    type: 'HOTEL',
    name: hotel.name,
    imageUrl: hotel.imageUrl,
    priceMinor: hotel.pricePerNightMinor,
    currency: hotel.currency,
    pricingUnit: 'PER_NIGHT',
    context,
  };
}

function entryFromActivity(activity: Activity): ShortlistEntry {
  const context: AiPlannerContextItem = {
    id: activity.id,
    type: 'ACTIVITY',
    name: activity.name,
    tags: activity.tags,
    priceHintMinor: activity.pricePerPersonMinor,
    currency: activity.currency,
    pricingUnit: 'PER_PERSON',
    durationMinutes: activity.durationMinutes,
    intensity: activity.intensity,
  };
  return {
    catalogItemId: activity.id,
    type: 'ACTIVITY',
    name: activity.name,
    imageUrl: activity.imageUrl,
    priceMinor: activity.pricePerPersonMinor,
    currency: activity.currency,
    pricingUnit: 'PER_PERSON',
    context,
  };
}

function entryFromTransport(option: TransportOption): ShortlistEntry {
  const context: AiPlannerContextItem = {
    id: option.id,
    type: 'TRANSPORT',
    name: `${option.provider} (${option.mode})`,
    tags: [],
    priceHintMinor: option.priceMinor,
    currency: option.currency,
    pricingUnit: option.pricingUnit,
    durationMinutes: option.durationMinutes,
    mode: option.mode,
  };
  return {
    catalogItemId: option.id,
    type: 'TRANSPORT',
    name: `${option.provider} (${option.mode})`,
    imageUrl: option.imageUrl,
    priceMinor: option.priceMinor,
    currency: option.currency,
    pricingUnit: option.pricingUnit,
    context,
  };
}

export async function loadShortlist(
  deps: ShortlistDependencies,
  request: TripRequest,
  startDate: string,
): Promise<TripShortlist> {
  const destinationId = request.slots.destinationId;
  if (!destinationId) {
    throw new ValidationError('La solicitud necesita un destino antes de generar el plan');
  }
  if (request.slots.durationDays === null || request.slots.adults === null) {
    throw new ValidationError('La solicitud está incompleta para generar el plan');
  }

  const destination = await deps.destinations.findById(destinationId);
  if (!destination || !destination.isActive) {
    throw new NotFoundError('Destino');
  }

  const [hotels, activities, transportOptions] = await Promise.all([
    deps.hotels.search({ destinationId, page: 1, pageSize: 100 }),
    deps.activities.search({ destinationId, page: 1, pageSize: 100 }),
    deps.transportOptions.search({ destinationId, page: 1, pageSize: 100 }),
  ]);

  const currency = request.slots.currency;
  const interests = request.slots.interests;

  const hotelEntries = hotels.items
    .filter((hotel) => hotel.currency === currency)
    .sort((a, b) => a.pricePerNightMinor - b.pricePerNightMinor)
    .slice(0, LIMITS.hotels)
    .map(entryFromHotel);

  const activityEntries = activities.items
    .filter((activity) => activity.currency === currency)
    .sort(
      (a, b) =>
        interestScore(b.tags, interests) - interestScore(a.tags, interests) ||
        a.pricePerPersonMinor - b.pricePerPersonMinor,
    )
    .slice(0, LIMITS.activities)
    .map(entryFromActivity);

  const transportEntries = transportOptions.items
    .filter((option) => option.currency === currency)
    .sort((a, b) => a.priceMinor - b.priceMinor)
    .slice(0, LIMITS.transport)
    .map(entryFromTransport);

  const entries = [...hotelEntries, ...activityEntries, ...transportEntries];
  if (entries.length === 0) {
    throw new ValidationError('El destino no tiene ítems de catálogo disponibles para generar');
  }

  const context: AiPlannerContext = {
    destination: {
      id: destination.id,
      city: destination.city,
      country: destination.country,
    },
    tripRequest: {
      destinationId: destination.id,
      startDate,
      durationDays: request.slots.durationDays,
      adults: request.slots.adults,
      children: request.slots.children,
      travelerType: request.slots.travelerType,
      interests,
      budgetMinMinor: request.slots.budgetMinMinor,
      budgetMaxMinor: request.slots.budgetMaxMinor,
      currency,
    },
    shortlist: entries.map((entry) => entry.context),
  };

  return { destination, entries, context };
}
