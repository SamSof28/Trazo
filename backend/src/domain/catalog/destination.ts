import {
  assertLatitude,
  assertLongitude,
  normalizeHttpUrl,
  normalizeOptionalText,
  normalizeSlug,
  normalizeTags,
  normalizeText,
  normalizeTimezone,
  slugify,
} from './values.js';

export interface DestinationProps {
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
  fromPriceMinor: number | null;
  fromPriceCurrency: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDestinationData {
  id: string;
  city: string;
  country: string;
  slug?: string;
  description?: string | null;
  heroImageUrl?: string | null;
  latitude: number;
  longitude: number;
  timezone?: string;
  tags?: string[];
  isFeatured?: boolean;
  isActive?: boolean;
  now: Date;
}

export interface UpdateDestinationData {
  city?: string;
  country?: string;
  slug?: string;
  description?: string | null;
  heroImageUrl?: string | null;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  tags?: string[];
  isFeatured?: boolean;
  isActive?: boolean;
}

export class Destination {
  private constructor(private readonly props: DestinationProps) {}

  static fromPersistence(props: DestinationProps): Destination {
    return new Destination(props);
  }

  static create(input: CreateDestinationData): Destination {
    const city = normalizeText(input.city, 'La ciudad', 2, 120);
    const country = normalizeText(input.country, 'El país', 2, 120);
    const slug = input.slug ? normalizeSlug(input.slug) : slugify(city);

    return new Destination({
      id: input.id,
      city,
      country,
      slug,
      description: normalizeOptionalText(input.description, 'La descripción', 2000),
      heroImageUrl: normalizeHttpUrl(input.heroImageUrl, 'La imagen principal'),
      latitude: assertLatitude(input.latitude),
      longitude: assertLongitude(input.longitude),
      timezone: normalizeTimezone(input.timezone ?? 'America/Bogota'),
      tags: normalizeTags(input.tags ?? []),
      isFeatured: input.isFeatured ?? false,
      isActive: input.isActive ?? true,
      fromPriceMinor: null,
      fromPriceCurrency: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  withChanges(changes: UpdateDestinationData, now: Date): Destination {
    const city =
      changes.city === undefined ? this.city : normalizeText(changes.city, 'La ciudad', 2, 120);
    const country =
      changes.country === undefined
        ? this.country
        : normalizeText(changes.country, 'El país', 2, 120);
    const slug = changes.slug === undefined ? this.slug : normalizeSlug(changes.slug);

    return new Destination({
      ...this.props,
      city,
      country,
      slug,
      description:
        changes.description === undefined
          ? this.description
          : normalizeOptionalText(changes.description, 'La descripción', 2000),
      heroImageUrl:
        changes.heroImageUrl === undefined
          ? this.heroImageUrl
          : normalizeHttpUrl(changes.heroImageUrl, 'La imagen principal'),
      latitude: changes.latitude === undefined ? this.latitude : assertLatitude(changes.latitude),
      longitude:
        changes.longitude === undefined ? this.longitude : assertLongitude(changes.longitude),
      timezone:
        changes.timezone === undefined ? this.timezone : normalizeTimezone(changes.timezone),
      tags: changes.tags === undefined ? this.tags : normalizeTags(changes.tags),
      isFeatured: changes.isFeatured ?? this.isFeatured,
      isActive: changes.isActive ?? this.isActive,
      updatedAt: now,
    });
  }

  deactivate(now: Date): Destination {
    if (!this.isActive) return this;
    return new Destination({ ...this.props, isActive: false, updatedAt: now });
  }

  get id(): string {
    return this.props.id;
  }

  get city(): string {
    return this.props.city;
  }

  get country(): string {
    return this.props.country;
  }

  get slug(): string {
    return this.props.slug;
  }

  get description(): string | null {
    return this.props.description;
  }

  get heroImageUrl(): string | null {
    return this.props.heroImageUrl;
  }

  get latitude(): number {
    return this.props.latitude;
  }

  get longitude(): number {
    return this.props.longitude;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get tags(): string[] {
    return this.props.tags;
  }

  get isFeatured(): boolean {
    return this.props.isFeatured;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get fromPriceMinor(): number | null {
    return this.props.fromPriceMinor;
  }

  get fromPriceCurrency(): string | null {
    return this.props.fromPriceCurrency;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
