import { TripRequest, emptyTripRequestSlots } from '../src/domain/intake/trip-request.js';
import type {
  TripRequestPage,
  TripRequestRepository,
  TripRequestSearchCriteria,
} from '../src/domain/intake/ports.js';
import { NOW } from './fakes.js';

export function makeTripRequest(
  overrides: Partial<Parameters<typeof TripRequest.fromPersistence>[0]> = {},
): TripRequest {
  return TripRequest.fromPersistence({
    id: 'trip-request-1',
    advisorId: 'user-1',
    promptOriginal: 'Quiero un viaje',
    status: 'AWAITING_INPUT',
    slots: emptyTripRequestSlots(),
    extractedSlots: {},
    missingFields: ['destination', 'duration', 'travelers', 'budget'],
    errorCode: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  });
}

export class InMemoryTripRequestRepository implements TripRequestRepository {
  private readonly items = new Map<string, TripRequest>();

  constructor(items: TripRequest[] = []) {
    for (const item of items) this.items.set(item.id, item);
  }

  async create(request: TripRequest): Promise<TripRequest> {
    this.items.set(request.id, request);
    return request;
  }

  async findById(id: string): Promise<TripRequest | null> {
    return this.items.get(id) ?? null;
  }

  async update(request: TripRequest): Promise<TripRequest | null> {
    if (!this.items.has(request.id)) return null;
    this.items.set(request.id, request);
    return request;
  }

  async search(criteria: TripRequestSearchCriteria): Promise<TripRequestPage<TripRequest>> {
    const filtered = [...this.items.values()]
      .filter((request) => request.deletedAt === null)
      .filter((request) => !criteria.advisorId || request.advisorId === criteria.advisorId)
      .filter((request) => !criteria.status || request.status === criteria.status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const start = (criteria.page - 1) * criteria.pageSize;
    return {
      items: filtered.slice(start, start + criteria.pageSize),
      total: filtered.length,
    };
  }
}
