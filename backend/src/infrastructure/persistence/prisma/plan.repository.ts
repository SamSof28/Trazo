import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { PlanItemType, PlanStatus, PricingUnit } from '@trazo/shared';
import { Plan } from '../../../domain/planning/plan.js';
import type {
  PlanPage,
  PlanRepository,
  PlanSearchCriteria,
} from '../../../domain/planning/ports.js';
import { toSafeMinor } from './catalog-mappers.js';

const PLAN_INCLUDE = {
  days: {
    include: { items: { orderBy: { position: 'asc' } } },
    orderBy: { dayNumber: 'asc' },
  },
} satisfies Prisma.PlanInclude;

type PlanRow = Prisma.PlanGetPayload<{ include: typeof PLAN_INCLUDE }>;
type PlanItemRow = PlanRow['days'][number]['items'][number];

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function fromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toTime(value: Date | null): string | null {
  if (value === null) return null;
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
}

function fromTime(value: string | null): Date | null {
  if (value === null) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours ?? 0, minutes ?? 0, 0, 0));
}

function catalogIdOf(item: PlanItemRow): string {
  if (item.type === 'ACCOMMODATION') return item.hotelId ?? '';
  if (item.type === 'ACTIVITY') return item.activityId ?? '';
  return item.transportOptionId ?? '';
}

function toDomain(row: PlanRow): Plan {
  return Plan.fromPersistence({
    id: row.id,
    tripRequestId: row.tripRequestId,
    advisorId: row.advisorId,
    destinationId: row.destinationId,
    title: row.title,
    status: row.status as PlanStatus,
    summary: row.summary,
    heroImageUrl: row.heroImageUrl,
    tags: row.tags,
    currency: row.currency,
    marginPercent: Number(row.marginPercent),
    version: row.version,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    days: row.days.map((day) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      date: toIsoDate(day.date),
      title: day.title,
      notes: day.notes,
      items: day.items.map((item) => ({
        id: item.id,
        type: item.type as PlanItemType,
        catalogItemId: catalogIdOf(item),
        nameSnapshot: item.nameSnapshot,
        imageUrl: item.imageUrl,
        unitPriceMinor: toSafeMinor(item.unitPriceMinor),
        quantity: item.quantity,
        pricingUnit: item.pricingUnit as PricingUnit,
        subtotalMinor: toSafeMinor(item.subtotalMinor),
        startTime: toTime(item.startTime),
        endTime: toTime(item.endTime),
        notes: item.notes,
        position: item.position,
      })),
    })),
  });
}

function toScalarData(plan: Plan) {
  const budget = plan.budget;
  return {
    title: plan.title,
    status: plan.status as PlanStatus,
    summary: plan.summary,
    heroImageUrl: plan.heroImageUrl,
    tags: plan.tags,
    currency: plan.currency,
    subtotalMinor: BigInt(budget.subtotalMinor),
    marginPercent: new Prisma.Decimal(plan.marginPercent.toFixed(2)),
    marginMinor: BigInt(budget.marginMinor),
    totalMinor: BigInt(budget.totalMinor),
    version: plan.version,
    publishedAt: plan.publishedAt,
    deletedAt: plan.deletedAt,
  };
}

function toItemCreate(item: Plan['days'][number]['items'][number]) {
  return {
    id: item.id,
    type: item.type,
    hotelId: item.type === 'ACCOMMODATION' ? item.catalogItemId : null,
    activityId: item.type === 'ACTIVITY' ? item.catalogItemId : null,
    transportOptionId: item.type === 'TRANSPORT' ? item.catalogItemId : null,
    nameSnapshot: item.nameSnapshot,
    imageUrl: item.imageUrl,
    unitPriceMinor: BigInt(item.unitPriceMinor),
    quantity: item.quantity,
    pricingUnit: item.pricingUnit,
    subtotalMinor: BigInt(item.subtotalMinor),
    startTime: fromTime(item.startTime),
    endTime: fromTime(item.endTime),
    notes: item.notes,
    position: item.position,
  };
}

function toDayCreate(day: Plan['days'][number]) {
  return {
    id: day.id,
    dayNumber: day.dayNumber,
    date: fromIsoDate(day.date),
    title: day.title,
    notes: day.notes,
    items: { create: day.items.map(toItemCreate) },
  };
}

function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

export class PrismaPlanRepository implements PlanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(plan: Plan): Promise<Plan> {
    const row = await this.prisma.plan.create({
      data: {
        id: plan.id,
        tripRequestId: plan.tripRequestId,
        advisorId: plan.advisorId,
        destinationId: plan.destinationId,
        ...toScalarData(plan),
        days: { create: plan.days.map(toDayCreate) },
      },
      include: PLAN_INCLUDE,
    });
    return toDomain(row);
  }

  async findById(id: string): Promise<Plan | null> {
    const row = await this.prisma.plan.findFirst({
      where: { id, deletedAt: null },
      include: PLAN_INCLUDE,
    });
    return row ? toDomain(row) : null;
  }

  async findByTripRequestId(tripRequestId: string): Promise<Plan | null> {
    const row = await this.prisma.plan.findFirst({
      where: { tripRequestId, deletedAt: null },
      include: PLAN_INCLUDE,
    });
    return row ? toDomain(row) : null;
  }

  async update(plan: Plan): Promise<Plan | null> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        await tx.plan.update({
          where: { id: plan.id },
          data: toScalarData(plan),
        });
        await tx.planDay.deleteMany({ where: { planId: plan.id } });
        for (const day of plan.days) {
          await tx.planDay.create({
            data: { planId: plan.id, ...toDayCreate(day) },
          });
        }
        return tx.plan.findUniqueOrThrow({
          where: { id: plan.id },
          include: PLAN_INCLUDE,
        });
      });
      return toDomain(row);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async search(criteria: PlanSearchCriteria): Promise<PlanPage<Plan>> {
    const where: Prisma.PlanWhereInput = { deletedAt: null };
    if (criteria.advisorId) where.advisorId = criteria.advisorId;
    if (criteria.status) where.status = criteria.status;
    if (criteria.destinationId) where.destinationId = criteria.destinationId;
    if (criteria.query) {
      where.OR = [
        { title: { contains: criteria.query, mode: 'insensitive' } },
        { summary: { contains: criteria.query, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.plan.findMany({
        where,
        include: PLAN_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        skip: (criteria.page - 1) * criteria.pageSize,
        take: criteria.pageSize,
      }),
      this.prisma.plan.count({ where }),
    ]);

    return { items: rows.map(toDomain), total };
  }
}
