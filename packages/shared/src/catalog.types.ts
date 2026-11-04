import type { Money } from './money.js';

export type TransportMode = 'FLIGHT' | 'BUS' | 'CAR_RENTAL' | 'BOAT' | 'TRAIN';

export type PricingUnit = 'PER_PERSON' | 'PER_NIGHT' | 'PER_DAY' | 'PER_TRIP';

export type ActivityIntensity = 'LOW' | 'MEDIUM' | 'HIGH';

export type JsonObject = Record<string, unknown>;

export interface DestinationDto {
  id: string;
  city: string;
  country: string;
  slug: string;
  description: string | null;
  heroImageUrl: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  tags: string[];
  isFeatured: boolean;
  isActive: boolean;
  /** Cheapest active COP hotel; null when the destination has no priced hotel. */
  fromPrice: Money | null;
  createdAt: string;
  updatedAt: string;
}

export interface HotelDto {
  id: string;
  destinationId: string;
  name: string;
  description: string | null;
  category: number;
  roomType: string;
  pricePerNight: Money;
  imageUrl: string | null;
  amenities: JsonObject | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityDto {
  id: string;
  destinationId: string;
  name: string;
  description: string | null;
  intensity: ActivityIntensity;
  durationMinutes: number;
  pricePerPerson: Money;
  imageUrl: string | null;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TransportOptionDto {
  id: string;
  originDestinationId: string | null;
  destinationId: string;
  mode: TransportMode;
  provider: string;
  price: Money;
  imageUrl: string | null;
  pricingUnit: PricingUnit;
  durationMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DestinationResponse {
  destination: DestinationDto;
}

export interface HotelResponse {
  hotel: HotelDto;
}

export interface ActivityResponse {
  activity: ActivityDto;
}

export interface TransportOptionResponse {
  transportOption: TransportOptionDto;
}
