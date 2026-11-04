import type { ErrorCode } from '@trazo/shared';
import type {
  AiJobRepository,
  AiPlannerPort,
  AiPlannerResult,
} from '../../domain/ai/ports.js';
import type {
  ActivityRepository,
  DestinationRepository,
  HotelRepository,
  TransportOptionRepository,
} from '../../domain/catalog/ports.js';
import type { TripRequestRepository } from '../../domain/intake/ports.js';
import type { PlanRepository } from '../../domain/planning/ports.js';
import type { Clock } from '../../domain/shared/clock.js';
import {
  AiInvalidOutputError,
  AppError,
} from '../../domain/shared/app-error.js';
import { buildPlanPrompt } from '../ai/prompt-builder.js';
import { validatePlanOutput } from '../ai/plan-output.js';
import { createPlanFromOutput } from './plan-factory.js';
import { loadShortlist } from './shortlist.js';

export interface RunGenerationDependencies {
  tripRequests: TripRequestRepository;
  plans: PlanRepository;
  aiJobs: AiJobRepository;
  destinations: DestinationRepository;
  hotels: HotelRepository;
  activities: ActivityRepository;
  transportOptions: TransportOptionRepository;
  planner: AiPlannerPort;
  clock: Clock;
  timeoutMs: number;
}

function errorCodeFor(error: unknown): ErrorCode {
  return error instanceof AppError ? error.code : 'INTERNAL_ERROR';
}

function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export class RunGenerationJobUseCase {
  constructor(private readonly deps: RunGenerationDependencies) {}

  async execute(jobId: string): Promise<void> {
    const job = await this.deps.aiJobs.findById(jobId);
    if (!job || job.status !== 'QUEUED') return;

    const request = await this.deps.tripRequests.findById(job.tripRequestId);
    const startedAt = this.deps.clock.now();
    const running = job.markRunning(startedAt);
    await this.deps.aiJobs.update(running);

    if (!request || request.deletedAt !== null) {
      await this.deps.aiJobs.update(running.fail('NOT_FOUND', startedAt));
      return;
    }

    try {
      const startDate = request.slots.startDate ?? todayIso(startedAt);
      const shortlist = await loadShortlist(
        {
          destinations: this.deps.destinations,
          hotels: this.deps.hotels,
          activities: this.deps.activities,
          transportOptions: this.deps.transportOptions,
        },
        request,
        startDate,
      );

      const prompt = buildPlanPrompt({ context: shortlist.context });
      const input = {
        system: prompt.system,
        user: prompt.user,
        timeoutMs: this.deps.timeoutMs,
        context: shortlist.context,
      };

      let result: AiPlannerResult;
      let output: ReturnType<typeof validatePlanOutput>;
      try {
        result = await this.deps.planner.generateJson(input);
        output = validatePlanOutput(
          result.json,
          request.slots.durationDays ?? 1,
          shortlist.entries,
        );
      } catch (error) {
        if (!(error instanceof AiInvalidOutputError)) throw error;
        const repair = buildPlanPrompt({
          context: shortlist.context,
          repair: `La respuesta anterior no fue válida: ${error.detail ?? error.message}. Corrige el JSON y devuelve el itinerario completo.`,
        });
        result = await this.deps.planner.generateJson({
          ...input,
          system: repair.system,
          user: repair.user,
        });
        output = validatePlanOutput(
          result.json,
          request.slots.durationDays ?? 1,
          shortlist.entries,
        );
      }

      const plan = createPlanFromOutput({
        request,
        shortlist,
        output,
        now: this.deps.clock.now(),
      });
      await this.deps.plans.create(plan);

      const finishedAt = this.deps.clock.now();
      await this.deps.tripRequests.update(request.markGenerated(plan.id, finishedAt));
      await this.deps.aiJobs.update(
        running.succeed(
          {
            model: result.model,
            latencyMs: result.latencyMs,
            tokensIn: result.tokensIn,
            tokensOut: result.tokensOut,
          },
          finishedAt,
        ),
      );
    } catch (error) {
      const code = errorCodeFor(error);
      const failedAt = this.deps.clock.now();
      try {
        await this.deps.tripRequests.update(request.markFailed(code, failedAt));
      } catch {
        // The request may have been deleted or moved to another state while generating.
      }
      await this.deps.aiJobs.update(running.fail(code, failedAt));
    }
  }
}
