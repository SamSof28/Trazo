import type { TripRequestAnswer } from '@trazo/shared';
import type { AccessTokenPayload } from '../../domain/identity/ports.js';
import type { DestinationRepository } from '../../domain/catalog/ports.js';
import type { TripRequestRepository } from '../../domain/intake/ports.js';
import type { TripRequestSlots } from '../../domain/intake/trip-request.js';
import { NotFoundError, ValidationError } from '../../domain/shared/app-error.js';
import type { Clock } from '../../domain/shared/clock.js';
import { loadActiveDestinations } from './catalog-context.js';
import { assertTripRequestAccess } from './ownership.js';
import { parseAnswer } from './prompt-parser.js';
import { buildQuestions } from './questions.js';
import type { TripRequestView } from './views.js';

export class AnswerTripRequestUseCase {
  constructor(
    private readonly tripRequests: TripRequestRepository,
    private readonly destinations: DestinationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    id: string,
    actor: AccessTokenPayload,
    answers: TripRequestAnswer[],
  ): Promise<TripRequestView> {
    const request = await this.tripRequests.findById(id);
    if (!request || request.deletedAt !== null) {
      throw new NotFoundError('Solicitud de viaje');
    }
    assertTripRequestAccess(request, actor);

    const now = this.clock.now();
    const catalog = await loadActiveDestinations(this.destinations);
    const changes: Partial<TripRequestSlots> = {};
    const seen = new Set<string>();

    answers.forEach((answer, index) => {
      if (seen.has(answer.field)) {
        throw new ValidationError(
          `El campo "${answer.field}" está repetido en la misma respuesta.`,
          `answers.${index}.field`,
        );
      }
      seen.add(answer.field);
      Object.assign(changes, parseAnswer(answer.field, answer.value, catalog, now));
    });

    const updated = request.withAnswers(changes, now);
    const saved = await this.tripRequests.update(updated);
    if (!saved) throw new NotFoundError('Solicitud de viaje');

    return {
      tripRequest: saved,
      destination:
        catalog.find((destination) => destination.id === saved.slots.destinationId) ?? null,
      questions: buildQuestions(saved.missingFields, catalog),
    };
  }
}
