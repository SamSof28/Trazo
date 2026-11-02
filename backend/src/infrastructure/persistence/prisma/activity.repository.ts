import { Prisma } from '@prisma/client';
import type { Activity as ActivityRecord, PrismaClient } from '@prisma/client';
import { Activity } from '../../../domain/catalog/activity.js';
import type {
  ActivityRepository,
  ActivitySearchCriteria,
  Page,
} from '../../../domain/catalog/ports.js';
import { NotFoundError } from '../../../domain/shared/app-error.js';
import { toSafeMinor } from './catalog-mappers.js';

function toDomain(row: ActivityRecord): Activity {
  return Activity.fromPersistence({
    id: row.id,
    destinationId: row.destinationId,
    name: row.name,
    description: row.description,
    intensity: row.intensity,
    durationMinutes: row.durationMinutes,
    pricePerPersonMinor: toSafeMinor(row.pricePerPersonMinor),
    currency: row.currency,
    imageUrl: row.imageUrl,
    tags: row.tags,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toData(activity: Activity) {
  return {
    destinationId: activity.destinationId,
    name: activity.name,
    description: activity.description,
    intensity: activity.intensity,
    durationMinutes: activity.durationMinutes,
    pricePerPersonMinor: BigInt(activity.pricePerPersonMinor),
    currency: activity.currency,
    imageUrl: activity.imageUrl,
    tags: activity.tags,
    isActive: activity.isActive,
  };
}

function mapWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
    throw new NotFoundError('Destino');
  }
  throw error;
}

export class PrismaActivityRepository implements ActivityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async search(criteria: ActivitySearchCriteria): Promise<Page<Activity>> {
    const where: Prisma.ActivityWhereInput = {
      isActive: true,
      destination: { isActive: true },
    };

    if (criteria.destinationId) where.destinationId = criteria.destinationId;
    if (criteria.interest) where.tags = { has: criteria.interest };
    if (criteria.intensity) where.intensity = criteria.intensity;

    const [rows, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (criteria.page - 1) * criteria.pageSize,
        take: criteria.pageSize,
      }),
      this.prisma.activity.count({ where }),
    ]);

    return { items: rows.map(toDomain), total };
  }

  async findById(id: string): Promise<Activity | null> {
    const row = await this.prisma.activity.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async create(activity: Activity): Promise<Activity> {
    try {
      const row = await this.prisma.activity.create({
        data: { id: activity.id, ...toData(activity) },
      });
      return toDomain(row);
    } catch (error) {
      mapWriteError(error);
    }
  }

  async update(activity: Activity): Promise<Activity | null> {
    try {
      const row = await this.prisma.activity.update({
        where: { id: activity.id },
        data: toData(activity),
      });
      return toDomain(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      mapWriteError(error);
    }
  }
}
