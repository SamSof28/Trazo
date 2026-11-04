import type { AccessTokenPayload } from '../../domain/identity/ports.js';
import type { DestinationRepository } from '../../domain/catalog/ports.js';
import type { TripRequestRepository } from '../../domain/intake/ports.js';
import { NotFoundError } from '../../domain/shared/app-error.js';
import { loadActiveDestinations } from './catalog-context.js';
import { assertTripRequestAccess } from './ownership.js';
import { buildQuestions } from './questions.js';
import type { TripRequestView } from './views.js';

export class GetTripRequestUseCase {
  constructor(
    private readonly tripRequests: TripRequestRepository,
    private readonly destinations: DestinationRepository,
  ) {}

  async execute(id: string, actor: AccessTokenPayload): Promise<TripRequestView> {
    const request = await this.tripRequests.findById(id);
    if (!request || request.deletedAt !== null) {
      throw new NotFoundError('Solicitud de viaje');
    }
    assertTripRequestAccess(request, actor);

    const catalog = await loadActiveDestinations(this.destinations);
    const destination =
      catalog.find((item) => item.id === request.slots.destinationId) ?? null;

    return {
      tripRequest: request,
      destination,
      questions: buildQuestions(request.missingFields, catalog),
    };
  }
}
