import { Prisma } from '@prisma/client';
import type { AiJob as AiJobRecord, PrismaClient } from '@prisma/client';
import type { ErrorCode } from '@trazo/shared';
import { AiJob, type AiJobStatus } from '../../../domain/ai/job.js';
import type { AiJobRepository } from '../../../domain/ai/ports.js';

function toDomain(row: AiJobRecord): AiJob {
  return AiJob.fromPersistence({
    id: row.id,
    tripRequestId: row.tripRequestId,
    status: row.status as AiJobStatus,
    attempts: row.attempts,
    model: row.model,
    latencyMs: row.latencyMs,
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    errorCode: row.errorCode as ErrorCode | null,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  });
}

function toData(job: AiJob) {
  return {
    status: job.status,
    attempts: job.attempts,
    model: job.model,
    latencyMs: job.latencyMs,
    tokensIn: job.tokensIn,
    tokensOut: job.tokensOut,
    errorCode: job.errorCode,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

export class PrismaAiJobRepository implements AiJobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(job: AiJob): Promise<AiJob> {
    const row = await this.prisma.aiJob.create({
      data: {
        id: job.id,
        tripRequestId: job.tripRequestId,
        ...toData(job),
      },
    });
    return toDomain(row);
  }

  async findById(id: string): Promise<AiJob | null> {
    const row = await this.prisma.aiJob.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async update(job: AiJob): Promise<AiJob | null> {
    try {
      const row = await this.prisma.aiJob.update({
        where: { id: job.id },
        data: toData(job),
      });
      return toDomain(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  }
}
