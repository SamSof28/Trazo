import { Prisma } from '@prisma/client';
import type { PrismaClient, TransportOption as TransportOptionRecord } from '@prisma/client';
import { TransportOption } from '../../../domain/catalog/transport-option.js';
import type {
  Page,
  TransportOptionRepository,
  TransportSearchCriteria,
} from '../../../domain/catalog/ports.js';
import { NotFoundError } from '../../../domain/shared/app-error.js';
import { toSafeMinor } from './catalog-mappers.js';

function toDomain(row: TransportOptionRecord): TransportOption {
  return TransportOption.fromPersistence({
    id: row.id,
    originDestinationId: row.originDestinationId,
    destinationId: row.destinationId,
    mode: row.mode,
    provider: row.provider,
    priceMinor: toSafeMinor(row.priceMinor),
    currency: row.currency,
    pricingUnit: row.pricingUnit,
    durationMinutes: row.durationMinutes,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toData(option: TransportOption) {
  return {
    originDestinationId: option.originDestinationId,
    destinationId: option.destinationId,
    mode: option.mode,
    provider: option.provider,
    priceMinor: BigInt(option.priceMinor),
    currency: option.currency,
    pricingUnit: option.pricingUnit,
    durationMinutes: option.durationMinutes,
    isActive: option.isActive,
  };
}

function mapWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
    throw new NotFoundError('Destino');
  }
  throw error;
}

export class PrismaTransportOptionRepository implements TransportOptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async search(criteria: TransportSearchCriteria): Promise<Page<TransportOption>> {
    const where: Prisma.TransportOptionWhereInput = {
      isActive: true,
      destination: { isActive: true },
      OR: [{ originDestinationId: null }, { origin: { isActive: true } }],
    };

    if (criteria.originDestinationId) {
      where.originDestinationId = criteria.originDestinationId;
    }
    if (criteria.destinationId) where.destinationId = criteria.destinationId;
    if (criteria.mode) where.mode = criteria.mode;

    const [rows, total] = await Promise.all([
      this.prisma.transportOption.findMany({
        where,
        orderBy: [{ priceMinor: 'asc' }, { provider: 'asc' }],
        skip: (criteria.page - 1) * criteria.pageSize,
        take: criteria.pageSize,
      }),
      this.prisma.transportOption.count({ where }),
    ]);

    return { items: rows.map(toDomain), total };
  }

  async findById(id: string): Promise<TransportOption | null> {
    const row = await this.prisma.transportOption.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async create(option: TransportOption): Promise<TransportOption> {
    try {
      const row = await this.prisma.transportOption.create({
        data: { id: option.id, ...toData(option) },
      });
      return toDomain(row);
    } catch (error) {
      mapWriteError(error);
    }
  }

  async update(option: TransportOption): Promise<TransportOption | null> {
    try {
      const row = await this.prisma.transportOption.update({
        where: { id: option.id },
        data: toData(option),
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
