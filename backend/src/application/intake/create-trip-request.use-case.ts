import { randomUUID } from 'node:crypto';
import type { AccessTokenPayload } from '../../domain/identity/ports.js';
import type { Destination } from '../../domain/catalog/destination.js';
import type { DestinationRepository } from '../../domain/catalog/ports.js';
import type { TripRequestRepository } from '../../domain/intake/ports.js';
import { TripRequest } from '../../domain/intake/trip-request.js';
import type { Clock } from '../../domain/shared/clock.js';
import { loadActiveDestinations } from './catalog-context.js';
import { parsePrompt } from './prompt-parser.js';
import { buildQuestions } from './questions.js';
import type { TripRequestView } from './views.js';

function findDestination(
  destinations: Destination[],
  destinationId: string | null,
): Destination | null {
  if (!destinationId) return null;
  return destinations.find((destination) => destination.id === destinationId) ?? null;
}

export class CreateTripRequestUseCase {
  constructor(
    private readonly tripRequests: TripRequestRepository,
    private readonly destinations: DestinationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    prompt: string;
    actor: AccessTokenPayload;
  }): Promise<TripRequestView> {
    const now = this.clock.now();
    const catalog = await loadActiveDestinations(this.destinations);
    const parsed = parsePrompt(input.prompt, catalog, now);

    const request = TripRequest.create({
      id: randomUUID(),
      advisorId: input.actor.userId,
      prompt: input.prompt,
      slots: parsed.slots,
      extractedSlots: parsed.extractedSlots,
      now,
    });
    const saved = await this.tripRequests.create(request);

    return {
      tripRequest: saved,
      destination: findDestination(catalog, saved.slots.destinationId),
      questions: buildQuestions(saved.missingFields, catalog),
    };
  }
}
