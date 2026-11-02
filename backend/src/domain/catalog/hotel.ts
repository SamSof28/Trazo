import { ValidationError } from '../shared/app-error.js';
import {
  assertPrice,
  normalizeCurrency,
  normalizeHttpUrl,
  normalizeOptionalText,
  normalizeText,
} from './values.js';

export interface HotelProps {
  id: string;
  destinationId: string;
  name: string;
  description: string | null;
  category: number;
  roomType: string;
  pricePerNightMinor: number;
  currency: string;
  imageUrl: string | null;
  amenities: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateHotelData {
  id: string;
  destinationId: string;
  name: string;
  description?: string | null;
  category: number;
  roomType: string;
  pricePerNight: { amountMinor: number; currency: string };
  imageUrl?: string | null;
  amenities?: Record<string, unknown> | null;
  isActive?: boolean;
  now: Date;
}

export interface UpdateHotelData {
  destinationId?: string;
  name?: string;
  description?: string | null;
  category?: number;
  roomType?: string;
  pricePerNight?: { amountMinor: number; currency: string };
  imageUrl?: string | null;
  amenities?: Record<string, unknown> | null;
  isActive?: boolean;
}

function normalizeDestinationId(value: string): string {
  const id = value.trim();
  if (!id) throw new ValidationError('El destino es obligatorio');
  return id;
}

function normalizeCategory(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new ValidationError('La categoría del hotel debe estar entre 1 y 5');
  }
  return value;
}

function normalizeAmenities(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('Los servicios del hotel deben ser un objeto JSON');
  }
  return value;
}

export class Hotel {
  private constructor(private readonly props: HotelProps) {}

  static fromPersistence(props: HotelProps): Hotel {
    return new Hotel(props);
  }

  static create(input: CreateHotelData): Hotel {
    return new Hotel({
      id: input.id,
      destinationId: normalizeDestinationId(input.destinationId),
      name: normalizeText(input.name, 'El nombre del hotel', 2, 160),
      description: normalizeOptionalText(input.description, 'La descripción', 2000),
      category: normalizeCategory(input.category),
      roomType: normalizeText(input.roomType, 'El tipo de habitación', 2, 80),
      pricePerNightMinor: assertPrice(input.pricePerNight.amountMinor, 'El precio por noche'),
      currency: normalizeCurrency(input.pricePerNight.currency),
      imageUrl: normalizeHttpUrl(input.imageUrl, 'La imagen del hotel'),
      amenities: normalizeAmenities(input.amenities),
      isActive: input.isActive ?? true,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  withChanges(changes: UpdateHotelData, now: Date): Hotel {
    return new Hotel({
      ...this.props,
      destinationId:
        changes.destinationId === undefined
          ? this.destinationId
          : normalizeDestinationId(changes.destinationId),
      name:
        changes.name === undefined
          ? this.name
          : normalizeText(changes.name, 'El nombre del hotel', 2, 160),
      description:
        changes.description === undefined
          ? this.description
          : normalizeOptionalText(changes.description, 'La descripción', 2000),
      category:
        changes.category === undefined ? this.category : normalizeCategory(changes.category),
      roomType:
        changes.roomType === undefined
          ? this.roomType
          : normalizeText(changes.roomType, 'El tipo de habitación', 2, 80),
      pricePerNightMinor:
        changes.pricePerNight === undefined
          ? this.pricePerNightMinor
          : assertPrice(changes.pricePerNight.amountMinor, 'El precio por noche'),
      currency:
        changes.pricePerNight === undefined
          ? this.currency
          : normalizeCurrency(changes.pricePerNight.currency),
      imageUrl:
        changes.imageUrl === undefined
          ? this.imageUrl
          : normalizeHttpUrl(changes.imageUrl, 'La imagen del hotel'),
      amenities:
        changes.amenities === undefined ? this.amenities : normalizeAmenities(changes.amenities),
      isActive: changes.isActive ?? this.isActive,
      updatedAt: now,
    });
  }

  deactivate(now: Date): Hotel {
    if (!this.isActive) return this;
    return new Hotel({ ...this.props, isActive: false, updatedAt: now });
  }

  get id(): string {
    return this.props.id;
  }

  get destinationId(): string {
    return this.props.destinationId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get category(): number {
    return this.props.category;
  }

  get roomType(): string {
    return this.props.roomType;
  }

  get pricePerNightMinor(): number {
    return this.props.pricePerNightMinor;
  }

  get currency(): string {
    return this.props.currency;
  }

  get imageUrl(): string | null {
    return this.props.imageUrl;
  }

  get amenities(): Record<string, unknown> | null {
    return this.props.amenities;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
