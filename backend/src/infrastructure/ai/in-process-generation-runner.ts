import type { PlanGenerationRunner } from '../../domain/ai/ports.js';
import type { RunGenerationJobUseCase } from '../../application/planning/run-generation-job.use-case.js';

export interface RunnerLogger {
  error(payload: Record<string, unknown>, message: string): void;
}

/** In-process worker: the HTTP request returns 202 and the job runs on the event loop. */
export class InProcessGenerationRunner implements PlanGenerationRunner {
  constructor(
    private readonly runJob: RunGenerationJobUseCase,
    private readonly logger?: RunnerLogger,
  ) {}

  run(jobId: string): void {
    void this.runJob.execute(jobId).catch((error: unknown) => {
      this.logger?.error({ err: error, jobId }, 'plan_generation_failed');
    });
  }
}
