import { Prisma } from '@prisma/client';
import type { Destination as DestinationRecord, PrismaClient } from '@prisma/client';
import { Destination } from '../../../domain/catalog/destination.js';
import type {
  DestinationRepository,
  DestinationSearchCriteria,
  Page,
} from '../../../domain/catalog/ports.js';
import { ConflictError } from '../../../domain/shared/app-error.js';
import { toDecimalNumber, toSafeMinor } from './catalog-mappers.js';

type DestinationRow = DestinationRecord & {
  hotels: Array<{ pricePerNightMinor: bigint; currency: string }>;
};

const destinationInclude = {
  hotels: {
    where: { isActive: true, currency: 'COP' },
    orderBy: { pricePerNightMinor: 'asc' },
    take: 1,
    select: { pricePerNightMinor: true, currency: true },
  },
} satisfies Prisma.DestinationInclude;

function toDomain(row: DestinationRow): Destination {
  const cheapestHotel = row.hotels[0];
  return Destination.fromPersistence({
    id: row.id,
    city: row.city,
    country: row.country,
    slug: row.slug,
    description: row.description,
    heroImageUrl: row.heroImageUrl,
    latitude: toDecimalNumber(row.latitude),
    longitude: toDecimalNumber(row.longitude),
    timezone: row.timezone,
    tags: row.tags,
    isFeatured: row.isFeatured,
    isActive: row.isActive,
    fromPriceMinor: cheapestHotel ? toSafeMinor(cheapestHotel.pricePerNightMinor) : null,
    fromPriceCurrency: cheapestHotel?.currency ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toData(destination: Destination) {
  return {
    city: destination.city,
    country: destination.country,
    slug: destination.slug,
    description: destination.description,
    heroImageUrl: destination.heroImageUrl,
    latitude: new Prisma.Decimal(destination.latitude),
    longitude: new Prisma.Decimal(destination.longitude),
    timezone: destination.timezone,
    tags: destination.tags,
    isFeatured: destination.isFeatured,
    isActive: destination.isActive,
  };
}

export class PrismaDestinationRepository implements DestinationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async search(criteria: DestinationSearchCriteria): Promise<Page<Destination>> {
    const where: Prisma.DestinationWhereInput = { isActive: true };

    if (criteria.query) {
      where.OR = [
        { city: { contains: criteria.query, mode: 'insensitive' } },
        { country: { contains: criteria.query, mode: 'insensitive' } },
        { slug: { contains: criteria.query, mode: 'insensitive' } },
      ];
    }
    if (criteria.country) {
      where.country = { equals: criteria.country, mode: 'insensitive' };
    }
    if (criteria.featured !== undefined) {
      where.isFeatured = criteria.featured;
    }

    const [rows, total] = await Promise.all([
      this.prisma.destination.findMany({
        where,
        include: destinationInclude,
        orderBy: [{ isFeatured: 'desc' }, { city: 'asc' }],
        skip: (criteria.page - 1) * criteria.pageSize,
        take: criteria.pageSize,
      }),
      this.prisma.destination.count({ where }),
    ]);

    return { items: rows.map(toDomain), total };
  }

  async findById(id: string): Promise<Destination | null> {
    const row = await this.prisma.destination.findUnique({
      where: { id },
      include: destinationInclude,
    });
    return row ? toDomain(row) : null;
  }

  async create(destination: Destination): Promise<Destination> {
    try {
      const row = await this.prisma.destination.create({
        data: { id: destination.id, ...toData(destination) },
        include: destinationInclude,
      });
      return toDomain(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Ya existe un destino con ese slug');
      }
      throw error;
    }
  }

  async update(destination: Destination): Promise<Destination | null> {
    try {
      const row = await this.prisma.destination.update({
        where: { id: destination.id },
        data: toData(destination),
        include: destinationInclude,
      });
      return toDomain(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') return null;
        if (error.code === 'P2002') {
          throw new ConflictError('Ya existe un destino con ese slug');
        }
      }
      throw error;
    }
  }
}
