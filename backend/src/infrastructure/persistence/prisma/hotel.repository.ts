import { Prisma } from '@prisma/client';
import type { Hotel as HotelRecord, PrismaClient } from '@prisma/client';
import { Hotel } from '../../../domain/catalog/hotel.js';
import type { HotelRepository, HotelSearchCriteria, Page } from '../../../domain/catalog/ports.js';
import { NotFoundError } from '../../../domain/shared/app-error.js';
import { toAmenities, toJsonInput, toSafeMinor } from './catalog-mappers.js';

function toDomain(row: HotelRecord): Hotel {
  return Hotel.fromPersistence({
    id: row.id,
    destinationId: row.destinationId,
    name: row.name,
    description: row.description,
    category: row.category,
    roomType: row.roomType,
    pricePerNightMinor: toSafeMinor(row.pricePerNightMinor),
    currency: row.currency,
    imageUrl: row.imageUrl,
    amenities: toAmenities(row.amenities),
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toData(hotel: Hotel) {
  return {
    destinationId: hotel.destinationId,
    name: hotel.name,
    description: hotel.description,
    category: hotel.category,
    roomType: hotel.roomType,
    pricePerNightMinor: BigInt(hotel.pricePerNightMinor),
    currency: hotel.currency,
    imageUrl: hotel.imageUrl,
    amenities: toJsonInput(hotel.amenities),
    isActive: hotel.isActive,
  };
}

function mapWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
    throw new NotFoundError('Destino');
  }
  throw error;
}

export class PrismaHotelRepository implements HotelRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async search(criteria: HotelSearchCriteria): Promise<Page<Hotel>> {
    const where: Prisma.HotelWhereInput = {
      isActive: true,
      destination: { isActive: true },
    };

    if (criteria.destinationId) where.destinationId = criteria.destinationId;
    if (criteria.currency) where.currency = criteria.currency;
    if (criteria.maxPriceMinor !== undefined) {
      where.pricePerNightMinor = { lte: BigInt(criteria.maxPriceMinor) };
      where.currency = criteria.currency ?? 'COP';
    }

    const [rows, total] = await Promise.all([
      this.prisma.hotel.findMany({
        where,
        orderBy: [{ pricePerNightMinor: 'asc' }, { name: 'asc' }],
        skip: (criteria.page - 1) * criteria.pageSize,
        take: criteria.pageSize,
      }),
      this.prisma.hotel.count({ where }),
    ]);

    return { items: rows.map(toDomain), total };
  }

  async findById(id: string): Promise<Hotel | null> {
    const row = await this.prisma.hotel.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async create(hotel: Hotel): Promise<Hotel> {
    try {
      const row = await this.prisma.hotel.create({
        data: { id: hotel.id, ...toData(hotel) },
      });
      return toDomain(row);
    } catch (error) {
      mapWriteError(error);
    }
  }

  async update(hotel: Hotel): Promise<Hotel | null> {
    try {
      const row = await this.prisma.hotel.update({
        where: { id: hotel.id },
        data: toData(hotel),
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
