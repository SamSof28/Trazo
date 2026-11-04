import type { AccessTokenPayload } from '../../domain/identity/ports.js';
import type { TripRequestStatus } from '@trazo/shared';
import type { DestinationRepository } from '../../domain/catalog/ports.js';
import type { TripRequestRepository } from '../../domain/intake/ports.js';
import { loadActiveDestinations } from './catalog-context.js';
import { buildQuestions } from './questions.js';
import type { TripRequestListResult } from './views.js';

export class ListTripRequestsUseCase {
  constructor(
    private readonly tripRequests: TripRequestRepository,
    private readonly destinations: DestinationRepository,
  ) {}

  async execute(input: {
    actor: AccessTokenPayload;
    status?: TripRequestStatus;
    page: number;
    pageSize: number;
  }): Promise<TripRequestListResult> {
    const page = await this.tripRequests.search({
      advisorId: input.actor.role === 'ADMIN' ? undefined : input.actor.userId,
      status: input.status,
      page: input.page,
      pageSize: input.pageSize,
    });
    const catalog = await loadActiveDestinations(this.destinations);

    return {
      items: page.items.map((request) => ({
        tripRequest: request,
        destination:
          catalog.find((destination) => destination.id === request.slots.destinationId) ?? null,
        questions: buildQuestions(request.missingFields, catalog),
      })),
      total: page.total,
    };
  }
}
