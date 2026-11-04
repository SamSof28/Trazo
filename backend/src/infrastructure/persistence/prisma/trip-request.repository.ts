import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { MissingField } from '@trazo/shared';
import { TripRequest } from '../../../domain/intake/trip-request.js';
import type {
  TripRequestPage,
  TripRequestRepository,
  TripRequestSearchCriteria,
} from '../../../domain/intake/ports.js';
import { toSafeMinor } from './catalog-mappers.js';

const PLAN_SELECT = {
  plan: { select: { id: true, deletedAt: true } },
} satisfies Prisma.TripRequestInclude;

type TripRequestRow = Prisma.TripRequestGetPayload<{ include: typeof PLAN_SELECT }>;

const MISSING_FIELDS: readonly MissingField[] = [
  'destination',
  'duration',
  'travelers',
  'budget',
];

function toIsoDate(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10);
}

function fromIsoDate(value: string | null): Date | null {
  return value === null ? null : new Date(`${value}T00:00:00.000Z`);
}

function toMinorOrNull(value: bigint | null): number | null {
  return value === null ? null : toSafeMinor(value);
}

function toMinor(value: number | null): bigint | null {
  return value === null ? null : BigInt(value);
}

function toMissingFields(values: string[]): MissingField[] {
  return values.filter((value): value is MissingField =>
    (MISSING_FIELDS as readonly string[]).includes(value),
  );
}

function toExtractedSlots(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toDomain(row: TripRequestRow): TripRequest {
  return TripRequest.fromPersistence({
    id: row.id,
    advisorId: row.advisorId,
    promptOriginal: row.promptOriginal,
    status: row.status,
    slots: {
      destinationId: row.destinationId,
      startDate: toIsoDate(row.startDate),
      endDate: toIsoDate(row.endDate),
      durationDays: row.durationDays,
      adults: row.adults,
      children: row.children,
      travelerType: row.travelerType,
      interests: row.interests,
      budgetMinMinor: toMinorOrNull(row.budgetMinMinor),
      budgetMaxMinor: toMinorOrNull(row.budgetMaxMinor),
      currency: row.currency,
    },
    extractedSlots: toExtractedSlots(row.extractedSlots),
    missingFields: toMissingFields(row.missingFields),
    planId: row.plan && row.plan.deletedAt === null ? row.plan.id : null,
    errorCode: row.errorCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  });
}

function toData(request: TripRequest): Prisma.TripRequestUncheckedCreateInput {
  return {
    advisorId: request.advisorId,
    promptOriginal: request.promptOriginal,
    status: request.status,
    extractedSlots: request.extractedSlots as Prisma.InputJsonValue,
    missingFields: [...request.missingFields],
    destinationId: request.slots.destinationId,
    startDate: fromIsoDate(request.slots.startDate),
    endDate: fromIsoDate(request.slots.endDate),
    durationDays: request.slots.durationDays,
    adults: request.slots.adults,
    children: request.slots.children,
    travelerType: request.slots.travelerType,
    interests: [...request.slots.interests],
    budgetMinMinor: toMinor(request.slots.budgetMinMinor),
    budgetMaxMinor: toMinor(request.slots.budgetMaxMinor),
    currency: request.slots.currency,
    errorCode: request.errorCode,
  };
}

export class PrismaTripRequestRepository implements TripRequestRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(request: TripRequest): Promise<TripRequest> {
    const row = await this.prisma.tripRequest.create({
      data: { id: request.id, ...toData(request) },
      include: PLAN_SELECT,
    });
    return toDomain(row);
  }

  async findById(id: string): Promise<TripRequest | null> {
    const row = await this.prisma.tripRequest.findUnique({
      where: { id },
      include: PLAN_SELECT,
    });
    if (!row || row.deletedAt !== null) return null;
    return toDomain(row);
  }

  async update(request: TripRequest): Promise<TripRequest | null> {
    try {
      const row = await this.prisma.tripRequest.update({
        where: { id: request.id },
        data: toData(request),
        include: PLAN_SELECT,
      });
      return toDomain(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  }

  async search(criteria: TripRequestSearchCriteria): Promise<TripRequestPage<TripRequest>> {
    const where: Prisma.TripRequestWhereInput = { deletedAt: null };
    if (criteria.advisorId) where.advisorId = criteria.advisorId;
    if (criteria.status) where.status = criteria.status;

    const [rows, total] = await Promise.all([
      this.prisma.tripRequest.findMany({
        where,
        include: PLAN_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (criteria.page - 1) * criteria.pageSize,
        take: criteria.pageSize,
      }),
      this.prisma.tripRequest.count({ where }),
    ]);

    return { items: rows.map(toDomain), total };
  }
}
