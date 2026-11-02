import type { ActivityIntensity, PricingUnit, TransportMode } from '@turiviaje/shared';
import { Activity } from '../src/domain/catalog/activity.js';
import { Destination } from '../src/domain/catalog/destination.js';
import { Hotel } from '../src/domain/catalog/hotel.js';
import { TransportOption } from '../src/domain/catalog/transport-option.js';
import type {
  ActivityRepository,
  ActivitySearchCriteria,
  DestinationRepository,
  DestinationSearchCriteria,
  HotelRepository,
  HotelSearchCriteria,
  Page,
  TransportOptionRepository,
  TransportSearchCriteria,
} from '../src/domain/catalog/ports.js';
import { ConflictError } from '../src/domain/shared/app-error.js';
import { NOW } from './fakes.js';

export const DEST_CARTAGENA = '11111111-1111-4111-8111-111111111111';
export const DEST_MEDELLIN = '22222222-2222-4222-8222-222222222222';
export const DEST_SANTA_MARTA = '33333333-3333-4333-8333-333333333333';
export const DEST_INACTIVE = '44444444-4444-4444-8444-444444444444';

export const HOTEL_CASA_SAN_AGUSTIN = '55555555-5555-4555-8555-555555555555';
export const HOTEL_BOVEDAS = '66666666-6666-4666-8666-666666666666';
export const HOTEL_LAURELES = '77777777-7777-4777-8777-777777777777';
export const HOTEL_INACTIVE = '88888888-8888-4888-8888-888888888888';

export const ACTIVITY_CITY_TOUR = '99999999-9999-4999-8999-999999999999';
export const ACTIVITY_ISLAS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const ACTIVITY_PARAPENTE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

export const TRANSPORT_FLIGHT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const TRANSPORT_BUS = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

export function makeDestination(
  overrides: Partial<Parameters<typeof Destination.fromPersistence>[0]> = {},
): Destination {
  return Destination.fromPersistence({
    id: DEST_CARTAGENA,
    city: 'Cartagena',
    country: 'Colombia',
    slug: 'cartagena',
    description: 'Ciudad amurallada frente al Caribe',
    heroImageUrl: 'https://example.com/cartagena.jpg',
    latitude: 10.391049,
    longitude: -75.479426,
    timezone: 'America/Bogota',
    tags: ['playa', 'historia'],
    isFeatured: true,
    isActive: true,
    fromPriceMinor: 52_000_000,
    fromPriceCurrency: 'COP',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

export function makeHotel(
  overrides: Partial<Parameters<typeof Hotel.fromPersistence>[0]> = {},
): Hotel {
  return Hotel.fromPersistence({
    id: HOTEL_CASA_SAN_AGUSTIN,
    destinationId: DEST_CARTAGENA,
    name: 'Hotel Casa San Agustín',
    description: 'Boutique en el centro histórico',
    category: 5,
    roomType: 'Suite',
    pricePerNightMinor: 128_000_000,
    currency: 'COP',
    imageUrl: null,
    amenities: { wifi: true, pool: true },
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

export function makeActivity(
  overrides: Partial<Parameters<typeof Activity.fromPersistence>[0]> = {},
): Activity {
  return Activity.fromPersistence({
    id: ACTIVITY_CITY_TOUR,
    destinationId: DEST_CARTAGENA,
    name: 'City tour por la ciudad amurallada',
    description: 'Recorrido guiado por la historia de Cartagena',
    intensity: 'LOW' as ActivityIntensity,
    durationMinutes: 180,
    pricePerPersonMinor: 12_000_000,
    currency: 'COP',
    imageUrl: null,
    tags: ['historia', 'cultura'],
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

export function makeTransportOption(
  overrides: Partial<Parameters<typeof TransportOption.fromPersistence>[0]> = {},
): TransportOption {
  return TransportOption.fromPersistence({
    id: TRANSPORT_FLIGHT,
    originDestinationId: DEST_MEDELLIN,
    destinationId: DEST_CARTAGENA,
    mode: 'FLIGHT' as TransportMode,
    provider: 'Avianca',
    priceMinor: 45_000_000,
    currency: 'COP',
    pricingUnit: 'PER_PERSON' as PricingUnit,
    durationMinutes: 90,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

export class InMemoryDestinationRepository implements DestinationRepository {
  private readonly items: Map<string, Destination>;

  constructor(items: Destination[] = []) {
    this.items = new Map(items.map((item) => [item.id, item]));
  }

  async search(criteria: DestinationSearchCriteria): Promise<Page<Destination>> {
    const query = criteria.query?.toLowerCase();
    const country = criteria.country?.toLowerCase();

    const filtered = [...this.items.values()]
      .filter((destination) => destination.isActive)
      .filter(
        (destination) =>
          !query ||
          destination.city.toLowerCase().includes(query) ||
          destination.country.toLowerCase().includes(query) ||
          destination.slug.includes(query),
      )
      .filter((destination) => !country || destination.country.toLowerCase() === country)
      .filter(
        (destination) =>
          criteria.featured === undefined || destination.isFeatured === criteria.featured,
      )
      .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.city.localeCompare(b.city));

    const start = (criteria.page - 1) * criteria.pageSize;
    return {
      items: filtered.slice(start, start + criteria.pageSize),
      total: filtered.length,
    };
  }

  async findById(id: string): Promise<Destination | null> {
    return this.items.get(id) ?? null;
  }

  async create(destination: Destination): Promise<Destination> {
    if ([...this.items.values()].some((item) => item.slug === destination.slug)) {
      throw new ConflictError('Ya existe un destino con ese slug');
    }
    this.items.set(destination.id, destination);
    return destination;
  }

  async update(destination: Destination): Promise<Destination | null> {
    if (!this.items.has(destination.id)) return null;
    const slugTaken = [...this.items.values()].some(
      (item) => item.id !== destination.id && item.slug === destination.slug,
    );
    if (slugTaken) throw new ConflictError('Ya existe un destino con ese slug');
    this.items.set(destination.id, destination);
    return destination;
  }
}

export class InMemoryHotelRepository implements HotelRepository {
  private readonly items: Map<string, Hotel>;

  constructor(items: Hotel[] = []) {
    this.items = new Map(items.map((item) => [item.id, item]));
  }

  async search(criteria: HotelSearchCriteria): Promise<Page<Hotel>> {
    const filtered = [...this.items.values()]
      .filter((hotel) => hotel.isActive)
      .filter((hotel) => !criteria.destinationId || hotel.destinationId === criteria.destinationId)
      .filter((hotel) => !criteria.currency || hotel.currency === criteria.currency)
      .filter(
        (hotel) =>
          criteria.maxPriceMinor === undefined ||
          hotel.pricePerNightMinor <= criteria.maxPriceMinor,
      )
      .sort((a, b) => a.pricePerNightMinor - b.pricePerNightMinor);

    const start = (criteria.page - 1) * criteria.pageSize;
    return {
      items: filtered.slice(start, start + criteria.pageSize),
      total: filtered.length,
    };
  }

  async findById(id: string): Promise<Hotel | null> {
    return this.items.get(id) ?? null;
  }

  async create(hotel: Hotel): Promise<Hotel> {
    this.items.set(hotel.id, hotel);
    return hotel;
  }

  async update(hotel: Hotel): Promise<Hotel | null> {
    if (!this.items.has(hotel.id)) return null;
    this.items.set(hotel.id, hotel);
    return hotel;
  }
}

export class InMemoryActivityRepository implements ActivityRepository {
  private readonly items: Map<string, Activity>;

  constructor(items: Activity[] = []) {
    this.items = new Map(items.map((item) => [item.id, item]));
  }

  async search(criteria: ActivitySearchCriteria): Promise<Page<Activity>> {
    const filtered = [...this.items.values()]
      .filter((activity) => activity.isActive)
      .filter(
        (activity) => !criteria.destinationId || activity.destinationId === criteria.destinationId,
      )
      .filter((activity) => !criteria.interest || activity.tags.includes(criteria.interest))
      .filter((activity) => !criteria.intensity || activity.intensity === criteria.intensity)
      .sort((a, b) => a.name.localeCompare(b.name));

    const start = (criteria.page - 1) * criteria.pageSize;
    return {
      items: filtered.slice(start, start + criteria.pageSize),
      total: filtered.length,
    };
  }

  async findById(id: string): Promise<Activity | null> {
    return this.items.get(id) ?? null;
  }

  async create(activity: Activity): Promise<Activity> {
    this.items.set(activity.id, activity);
    return activity;
  }

  async update(activity: Activity): Promise<Activity | null> {
    if (!this.items.has(activity.id)) return null;
    this.items.set(activity.id, activity);
    return activity;
  }
}

export class InMemoryTransportOptionRepository implements TransportOptionRepository {
  private readonly items: Map<string, TransportOption>;

  constructor(items: TransportOption[] = []) {
    this.items = new Map(items.map((item) => [item.id, item]));
  }

  async search(criteria: TransportSearchCriteria): Promise<Page<TransportOption>> {
    const filtered = [...this.items.values()]
      .filter((option) => option.isActive)
      .filter(
        (option) =>
          !criteria.originDestinationId ||
          option.originDestinationId === criteria.originDestinationId,
      )
      .filter(
        (option) => !criteria.destinationId || option.destinationId === criteria.destinationId,
      )
      .filter((option) => !criteria.mode || option.mode === criteria.mode)
      .sort((a, b) => a.priceMinor - b.priceMinor);

    const start = (criteria.page - 1) * criteria.pageSize;
    return {
      items: filtered.slice(start, start + criteria.pageSize),
      total: filtered.length,
    };
  }

  async findById(id: string): Promise<TransportOption | null> {
    return this.items.get(id) ?? null;
  }

  async create(option: TransportOption): Promise<TransportOption> {
    this.items.set(option.id, option);
    return option;
  }

  async update(option: TransportOption): Promise<TransportOption | null> {
    if (!this.items.has(option.id)) return null;
    this.items.set(option.id, option);
    return option;
  }
}
