import { randomUUID } from 'node:crypto';
import type { AccessTokenPayload } from '../../domain/identity/ports.js';
import type { AiJobRepository } from '../../domain/ai/ports.js';
import { AiJob } from '../../domain/ai/job.js';
import type { PlanRepository } from '../../domain/planning/ports.js';
import type { TripRequestRepository } from '../../domain/intake/ports.js';
import type { TripRequest } from '../../domain/intake/trip-request.js';
import type { Clock } from '../../domain/shared/clock.js';
import { ConflictError, NotFoundError } from '../../domain/shared/app-error.js';
import { assertTripRequestAccess } from '../intake/ownership.js';

export interface StartGenerationResult {
  request: TripRequest;
  job: AiJob;
}

export class StartGenerationUseCase {
  constructor(
    private readonly tripRequests: TripRequestRepository,
    private readonly plans: PlanRepository,
    private readonly aiJobs: AiJobRepository,
    private readonly clock: Clock,
  ) {}

  async execute(id: string, actor: AccessTokenPayload): Promise<StartGenerationResult> {
    const request = await this.tripRequests.findById(id);
    if (!request || request.deletedAt !== null) {
      throw new NotFoundError('Solicitud de viaje');
    }
    assertTripRequestAccess(request, actor);

    if (request.status === 'GENERATING') {
      throw new ConflictError('La solicitud ya está generando un plan');
    }
    if (!request.canGenerate) {
      throw new ConflictError(
        'La solicitud debe estar READY (o FAILED para reintentar) antes de generar',
      );
    }

    const existingPlan = await this.plans.findByTripRequestId(id);
    if (existingPlan || request.planId) {
      throw new ConflictError('La solicitud ya tiene un plan; duplícalo o edítalo');
    }

    const now = this.clock.now();
    const generating = request.markGenerating(now);
    const job = AiJob.create({ id: randomUUID(), tripRequestId: id, now });

    await this.tripRequests.update(generating);
    await this.aiJobs.create(job);

    return { request: generating, job };
  }
}
