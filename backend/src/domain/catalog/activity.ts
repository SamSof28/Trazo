import type { ActivityIntensity } from '@turiviaje/shared';
import { ValidationError } from '../shared/app-error.js';
import {
  assertDuration,
  assertPrice,
  normalizeCurrency,
  normalizeHttpUrl,
  normalizeOptionalText,
  normalizeTags,
  normalizeText,
} from './values.js';

export interface ActivityProps {
  id: string;
  destinationId: string;
  name: string;
  description: string | null;
  intensity: ActivityIntensity;
  durationMinutes: number;
  pricePerPersonMinor: number;
  currency: string;
  imageUrl: string | null;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateActivityData {
  id: string;
  destinationId: string;
  name: string;
  description?: string | null;
  intensity?: ActivityIntensity;
  durationMinutes: number;
  pricePerPerson: { amountMinor: number; currency: string };
  imageUrl?: string | null;
  tags?: string[];
  isActive?: boolean;
  now: Date;
}

export interface UpdateActivityData {
  destinationId?: string;
  name?: string;
  description?: string | null;
  intensity?: ActivityIntensity;
  durationMinutes?: number;
  pricePerPerson?: { amountMinor: number; currency: string };
  imageUrl?: string | null;
  tags?: string[];
  isActive?: boolean;
}

const INTENSITIES: readonly ActivityIntensity[] = ['LOW', 'MEDIUM', 'HIGH'];

function normalizeDestinationId(value: string): string {
  const id = value.trim();
  if (!id) throw new ValidationError('El destino es obligatorio');
  return id;
}

function normalizeIntensity(value: ActivityIntensity): ActivityIntensity {
  if (!INTENSITIES.includes(value)) {
    throw new ValidationError('La intensidad debe ser LOW, MEDIUM o HIGH');
  }
  return value;
}

export class Activity {
  private constructor(private readonly props: ActivityProps) {}

  static fromPersistence(props: ActivityProps): Activity {
    return new Activity(props);
  }

  static create(input: CreateActivityData): Activity {
    return new Activity({
      id: input.id,
      destinationId: normalizeDestinationId(input.destinationId),
      name: normalizeText(input.name, 'El nombre de la actividad', 2, 160),
      description: normalizeOptionalText(input.description, 'La descripción', 2000),
      intensity: normalizeIntensity(input.intensity ?? 'LOW'),
      durationMinutes: assertDuration(input.durationMinutes, 'La duración'),
      pricePerPersonMinor: assertPrice(input.pricePerPerson.amountMinor, 'El precio por persona'),
      currency: normalizeCurrency(input.pricePerPerson.currency),
      imageUrl: normalizeHttpUrl(input.imageUrl, 'La imagen de la actividad'),
      tags: normalizeTags(input.tags ?? []),
      isActive: input.isActive ?? true,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  withChanges(changes: UpdateActivityData, now: Date): Activity {
    return new Activity({
      ...this.props,
      destinationId:
        changes.destinationId === undefined
          ? this.destinationId
          : normalizeDestinationId(changes.destinationId),
      name:
        changes.name === undefined
          ? this.name
          : normalizeText(changes.name, 'El nombre de la actividad', 2, 160),
      description:
        changes.description === undefined
          ? this.description
          : normalizeOptionalText(changes.description, 'La descripción', 2000),
      intensity:
        changes.intensity === undefined ? this.intensity : normalizeIntensity(changes.intensity),
      durationMinutes:
        changes.durationMinutes === undefined
          ? this.durationMinutes
          : assertDuration(changes.durationMinutes, 'La duración'),
      pricePerPersonMinor:
        changes.pricePerPerson === undefined
          ? this.pricePerPersonMinor
          : assertPrice(changes.pricePerPerson.amountMinor, 'El precio por persona'),
      currency:
        changes.pricePerPerson === undefined
          ? this.currency
          : normalizeCurrency(changes.pricePerPerson.currency),
      imageUrl:
        changes.imageUrl === undefined
          ? this.imageUrl
          : normalizeHttpUrl(changes.imageUrl, 'La imagen de la actividad'),
      tags: changes.tags === undefined ? this.tags : normalizeTags(changes.tags),
      isActive: changes.isActive ?? this.isActive,
      updatedAt: now,
    });
  }

  deactivate(now: Date): Activity {
    if (!this.isActive) return this;
    return new Activity({ ...this.props, isActive: false, updatedAt: now });
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

  get intensity(): ActivityIntensity {
    return this.props.intensity;
  }

  get durationMinutes(): number {
    return this.props.durationMinutes;
  }

  get pricePerPersonMinor(): number {
    return this.props.pricePerPersonMinor;
  }

  get currency(): string {
    return this.props.currency;
  }

  get imageUrl(): string | null {
    return this.props.imageUrl;
  }

  get tags(): string[] {
    return this.props.tags;
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
