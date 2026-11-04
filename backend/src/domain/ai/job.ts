import type { ErrorCode } from '@trazo/shared';

export type AiJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface AiJobProps {
  id: string;
  tripRequestId: string;
  status: AiJobStatus;
  attempts: number;
  model: string | null;
  latencyMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  errorCode: ErrorCode | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface AiJobMetrics {
  model: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
}

export class AiJob {
  private constructor(private readonly props: AiJobProps) {}

  static fromPersistence(props: AiJobProps): AiJob {
    return new AiJob(props);
  }

  static create(input: { id: string; tripRequestId: string; now: Date }): AiJob {
    return new AiJob({
      id: input.id,
      tripRequestId: input.tripRequestId,
      status: 'QUEUED',
      attempts: 0,
      model: null,
      latencyMs: null,
      tokensIn: null,
      tokensOut: null,
      errorCode: null,
      createdAt: input.now,
      startedAt: null,
      finishedAt: null,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get tripRequestId(): string {
    return this.props.tripRequestId;
  }

  get status(): AiJobStatus {
    return this.props.status;
  }

  get attempts(): number {
    return this.props.attempts;
  }

  get model(): string | null {
    return this.props.model;
  }

  get latencyMs(): number | null {
    return this.props.latencyMs;
  }

  get tokensIn(): number | null {
    return this.props.tokensIn;
  }

  get tokensOut(): number | null {
    return this.props.tokensOut;
  }

  get errorCode(): ErrorCode | null {
    return this.props.errorCode;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get startedAt(): Date | null {
    return this.props.startedAt;
  }

  get finishedAt(): Date | null {
    return this.props.finishedAt;
  }

  markRunning(now: Date): AiJob {
    return new AiJob({
      ...this.props,
      status: 'RUNNING',
      attempts: this.props.attempts + 1,
      startedAt: now,
      errorCode: null,
    });
  }

  succeed(metrics: AiJobMetrics, now: Date): AiJob {
    return new AiJob({
      ...this.props,
      status: 'SUCCEEDED',
      model: metrics.model,
      latencyMs: metrics.latencyMs,
      tokensIn: metrics.tokensIn ?? null,
      tokensOut: metrics.tokensOut ?? null,
      errorCode: null,
      finishedAt: now,
    });
  }

  fail(errorCode: ErrorCode, now: Date): AiJob {
    return new AiJob({
      ...this.props,
      status: 'FAILED',
      errorCode,
      finishedAt: now,
    });
  }
}
