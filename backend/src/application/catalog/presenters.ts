import type { ActivityDto, DestinationDto, HotelDto, TransportOptionDto } from '@trazo/shared';
import type { Activity } from '../../domain/catalog/activity.js';
import type { Destination } from '../../domain/catalog/destination.js';
import type { Hotel } from '../../domain/catalog/hotel.js';
import type { TransportOption } from '../../domain/catalog/transport-option.js';

export function toDestinationDto(destination: Destination): DestinationDto {
  return {
    id: destination.id,
    city: destination.city,
    country: destination.country,
    slug: destination.slug,
    description: destination.description,
    heroImageUrl: destination.heroImageUrl,
    latitude: destination.latitude,
    longitude: destination.longitude,
    timezone: destination.timezone,
    tags: destination.tags,
    isFeatured: destination.isFeatured,
    isActive: destination.isActive,
    fromPrice:
      destination.fromPriceMinor === null
        ? null
        : {
            amountMinor: destination.fromPriceMinor,
            currency: destination.fromPriceCurrency ?? 'COP',
          },
    createdAt: destination.createdAt.toISOString(),
    updatedAt: destination.updatedAt.toISOString(),
  };
}

export function toHotelDto(hotel: Hotel): HotelDto {
  return {
    id: hotel.id,
    destinationId: hotel.destinationId,
    name: hotel.name,
    description: hotel.description,
    category: hotel.category,
    roomType: hotel.roomType,
    pricePerNight: {
      amountMinor: hotel.pricePerNightMinor,
      currency: hotel.currency,
    },
    imageUrl: hotel.imageUrl,
    amenities: hotel.amenities,
    isActive: hotel.isActive,
    createdAt: hotel.createdAt.toISOString(),
    updatedAt: hotel.updatedAt.toISOString(),
  };
}

export function toActivityDto(activity: Activity): ActivityDto {
  return {
    id: activity.id,
    destinationId: activity.destinationId,
    name: activity.name,
    description: activity.description,
    intensity: activity.intensity,
    durationMinutes: activity.durationMinutes,
    pricePerPerson: {
      amountMinor: activity.pricePerPersonMinor,
      currency: activity.currency,
    },
    imageUrl: activity.imageUrl,
    tags: activity.tags,
    isActive: activity.isActive,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  };
}

export function toTransportOptionDto(option: TransportOption): TransportOptionDto {
  return {
    id: option.id,
    originDestinationId: option.originDestinationId,
    destinationId: option.destinationId,
    mode: option.mode,
    provider: option.provider,
    price: {
      amountMinor: option.priceMinor,
      currency: option.currency,
    },
    imageUrl: option.imageUrl,
    pricingUnit: option.pricingUnit,
    durationMinutes: option.durationMinutes,
    isActive: option.isActive,
    createdAt: option.createdAt.toISOString(),
    updatedAt: option.updatedAt.toISOString(),
  };
}
