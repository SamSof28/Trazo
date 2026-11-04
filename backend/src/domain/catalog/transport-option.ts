import type { PricingUnit, TransportMode } from '@trazo/shared';
import { ValidationError } from '../shared/app-error.js';
import {
  assertDuration,
  assertPrice,
  normalizeCurrency,
  normalizeHttpUrl,
  normalizeText,
} from './values.js';

export interface TransportOptionProps {
  id: string;
  originDestinationId: string | null;
  destinationId: string;
  mode: TransportMode;
  provider: string;
  priceMinor: number;
  currency: string;
  imageUrl: string | null;
  pricingUnit: PricingUnit;
  durationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTransportOptionData {
  id: string;
  originDestinationId?: string | null;
  destinationId: string;
  mode: TransportMode;
  provider: string;
  price: { amountMinor: number; currency: string };
  imageUrl?: string | null;
  pricingUnit: PricingUnit;
  durationMinutes: number;
  isActive?: boolean;
  now: Date;
}

export interface UpdateTransportOptionData {
  originDestinationId?: string | null;
  destinationId?: string;
  mode?: TransportMode;
  provider?: string;
  price?: { amountMinor: number; currency: string };
  imageUrl?: string | null;
  pricingUnit?: PricingUnit;
  durationMinutes?: number;
  isActive?: boolean;
}

const MODES: readonly TransportMode[] = ['FLIGHT', 'BUS', 'CAR_RENTAL', 'BOAT', 'TRAIN'];
const PRICING_UNITS: readonly PricingUnit[] = ['PER_PERSON', 'PER_NIGHT', 'PER_DAY', 'PER_TRIP'];

const ALLOWED_PRICING: Record<TransportMode, readonly PricingUnit[]> = {
  FLIGHT: ['PER_TRIP', 'PER_PERSON'],
  BUS: ['PER_PERSON', 'PER_TRIP'],
  CAR_RENTAL: ['PER_DAY'],
  BOAT: ['PER_PERSON', 'PER_TRIP'],
  TRAIN: ['PER_PERSON', 'PER_TRIP'],
};

function normalizeId(value: string, field: string): string {
  const id = value.trim();
  if (!id) throw new ValidationError(`${field} es obligatorio`);
  return id;
}

function normalizeOrigin(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const origin = value.trim();
  return origin || null;
}

function normalizeMode(value: TransportMode): TransportMode {
  if (!MODES.includes(value)) {
    throw new ValidationError('El modo de transporte no es válido');
  }
  return value;
}

function normalizePricingUnit(value: PricingUnit): PricingUnit {
  if (!PRICING_UNITS.includes(value)) {
    throw new ValidationError('La unidad de precio no es válida');
  }
  return value;
}

function assertPricingMatchesMode(
  mode: TransportMode,
  pricingUnit: PricingUnit,
  originDestinationId: string | null,
  destinationId: string,
): void {
  if (!ALLOWED_PRICING[mode].includes(pricingUnit)) {
    throw new ValidationError(
      `La unidad de precio ${pricingUnit} no es válida para el modo ${mode}`,
    );
  }
  if (originDestinationId !== null && originDestinationId === destinationId) {
    throw new ValidationError('El origen y el destino del transporte deben ser diferentes');
  }
}

export class TransportOption {
  private constructor(private readonly props: TransportOptionProps) {}

  static fromPersistence(props: TransportOptionProps): TransportOption {
    return new TransportOption(props);
  }

  static create(input: CreateTransportOptionData): TransportOption {
    const destinationId = normalizeId(input.destinationId, 'El destino');
    const originDestinationId = normalizeOrigin(input.originDestinationId);
    const mode = normalizeMode(input.mode);
    const pricingUnit = normalizePricingUnit(input.pricingUnit);
    assertPricingMatchesMode(mode, pricingUnit, originDestinationId, destinationId);

    return new TransportOption({
      id: input.id,
      originDestinationId,
      destinationId,
      mode,
      provider: normalizeText(input.provider, 'El proveedor', 2, 120),
      priceMinor: assertPrice(input.price.amountMinor, 'El precio del transporte'),
      currency: normalizeCurrency(input.price.currency),
      imageUrl: normalizeHttpUrl(input.imageUrl, 'La imagen del transporte'),
      pricingUnit,
      durationMinutes: assertDuration(input.durationMinutes, 'La duración'),
      isActive: input.isActive ?? true,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  withChanges(changes: UpdateTransportOptionData, now: Date): TransportOption {
    const destinationId =
      changes.destinationId === undefined
        ? this.destinationId
        : normalizeId(changes.destinationId, 'El destino');
    const originDestinationId =
      changes.originDestinationId === undefined
        ? this.originDestinationId
        : normalizeOrigin(changes.originDestinationId);
    const mode = changes.mode === undefined ? this.mode : normalizeMode(changes.mode);
    const pricingUnit =
      changes.pricingUnit === undefined
        ? this.pricingUnit
        : normalizePricingUnit(changes.pricingUnit);
    assertPricingMatchesMode(mode, pricingUnit, originDestinationId, destinationId);

    return new TransportOption({
      ...this.props,
      originDestinationId,
      destinationId,
      mode,
      provider:
        changes.provider === undefined
          ? this.provider
          : normalizeText(changes.provider, 'El proveedor', 2, 120),
      priceMinor:
        changes.price === undefined
          ? this.priceMinor
          : assertPrice(changes.price.amountMinor, 'El precio del transporte'),
      currency:
        changes.price === undefined ? this.currency : normalizeCurrency(changes.price.currency),
      imageUrl:
        changes.imageUrl === undefined
          ? this.imageUrl
          : normalizeHttpUrl(changes.imageUrl, 'La imagen del transporte'),
      pricingUnit,
      durationMinutes:
        changes.durationMinutes === undefined
          ? this.durationMinutes
          : assertDuration(changes.durationMinutes, 'La duración'),
      isActive: changes.isActive ?? this.isActive,
      updatedAt: now,
    });
  }

  deactivate(now: Date): TransportOption {
    if (!this.isActive) return this;
    return new TransportOption({ ...this.props, isActive: false, updatedAt: now });
  }

  get id(): string {
    return this.props.id;
  }

  get originDestinationId(): string | null {
    return this.props.originDestinationId;
  }

  get destinationId(): string {
    return this.props.destinationId;
  }

  get mode(): TransportMode {
    return this.props.mode;
  }

  get provider(): string {
    return this.props.provider;
  }

  get priceMinor(): number {
    return this.props.priceMinor;
  }

  get currency(): string {
    return this.props.currency;
  }

  get imageUrl(): string | null {
    return this.props.imageUrl;
  }

  get pricingUnit(): PricingUnit {
    return this.props.pricingUnit;
  }

  get durationMinutes(): number {
    return this.props.durationMinutes;
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
