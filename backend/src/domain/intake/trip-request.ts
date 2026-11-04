import type { MissingField, TravelerType, TripRequestStatus } from '@trazo/shared';
import { ConflictError, ValidationError } from '../shared/app-error.js';
import { assertSafeMinor } from '../shared/money.js';

export interface TripRequestSlots {
  destinationId: string | null;
  startDate: string | null;
  endDate: string | null;
  durationDays: number | null;
  adults: number | null;
  children: number;
  travelerType: TravelerType | null;
  interests: string[];
  budgetMinMinor: number | null;
  budgetMaxMinor: number | null;
  currency: string;
}

export interface TripRequestProps {
  id: string;
  advisorId: string;
  promptOriginal: string;
  status: TripRequestStatus;
  slots: TripRequestSlots;
  extractedSlots: Record<string, unknown>;
  missingFields: MissingField[];
  /** Derived from the plan relation on reads; never stored on trip_requests. */
  planId?: string | null;
  errorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateTripRequestData {
  id: string;
  advisorId: string;
  prompt: string;
  slots?: Partial<TripRequestSlots>;
  extractedSlots?: Record<string, unknown>;
  now: Date;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_CURRENCY = /^[A-Z]{3}$/;
const TRAVELER_TYPES: readonly TravelerType[] = [
  'SOLO',
  'COUPLE',
  'FAMILY',
  'FRIENDS',
  'BUSINESS',
];
const MISSING_ORDER: readonly MissingField[] = [
  'destination',
  'duration',
  'travelers',
  'budget',
];

export function emptyTripRequestSlots(): TripRequestSlots {
  return {
    destinationId: null,
    startDate: null,
    endDate: null,
    durationDays: null,
    adults: null,
    children: 0,
    travelerType: null,
    interests: [],
    budgetMinMinor: null,
    budgetMaxMinor: null,
    currency: 'COP',
  };
}

export function sanitizePrompt(value: string): string {
  const normalized = value
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex -- user input must not keep control characters
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length < 1) {
    throw new ValidationError('El prompt no puede estar vacío');
  }
  if (normalized.length > 2000) {
    throw new ValidationError('El prompt no puede superar 2000 caracteres');
  }
  return normalized;
}

function normalizeDate(value: string | null | undefined, field: string): string | null {
  if (value === null || value === undefined) return null;
  const date = value.trim();
  if (!ISO_DATE.test(date)) {
    throw new ValidationError(`${field} debe usar el formato YYYY-MM-DD`);
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new ValidationError(`${field} no es una fecha válida`);
  }
  return date;
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function diffDays(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  return Math.round((endMs - startMs) / 86_400_000);
}

function normalizeCurrency(value: string | null | undefined): string {
  const currency = (value ?? 'COP').trim().toUpperCase();
  if (!ISO_CURRENCY.test(currency)) {
    throw new ValidationError('La moneda debe ser un código ISO-4217 de 3 letras');
  }
  return currency;
}

function normalizeInterest(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function normalizeInterests(values: string[] | null | undefined): string[] {
  if (!values) return [];
  const normalized = [...new Set(values.map(normalizeInterest).filter(Boolean))];
  if (normalized.length > 20) {
    throw new ValidationError('No se permiten más de 20 intereses');
  }
  for (const interest of normalized) {
    if (interest.length > 40) {
      throw new ValidationError('Cada interés admite máximo 40 caracteres');
    }
  }
  return normalized;
}

function normalizeTravelerType(value: TravelerType | null | undefined): TravelerType | null {
  if (value === null || value === undefined) return null;
  if (!TRAVELER_TYPES.includes(value)) {
    throw new ValidationError('El tipo de viajero no es válido');
  }
  return value;
}

function normalizeAdults(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    throw new ValidationError('Los adultos deben ser un entero entre 1 y 20');
  }
  return value;
}

function normalizeChildren(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (!Number.isInteger(value) || value < 0 || value > 20) {
    throw new ValidationError('Los niños deben ser un entero entre 0 y 20');
  }
  return value;
}

function normalizeDuration(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value < 1 || value > 30) {
    throw new ValidationError('La duración debe ser un entero entre 1 y 30 días');
  }
  return value;
}

function normalizeBudget(value: number | null | undefined, field: string): number | null {
  if (value === null || value === undefined) return null;
  return assertSafeMinor(value, field);
}

function normalizeSlots(input: Partial<TripRequestSlots>): TripRequestSlots {
  let startDate = normalizeDate(input.startDate, 'La fecha de inicio');
  let endDate = normalizeDate(input.endDate, 'La fecha de fin');
  let durationDays = normalizeDuration(input.durationDays);
  const adults = normalizeAdults(input.adults);
  const children = normalizeChildren(input.children);
  const budgetMinMinor = normalizeBudget(input.budgetMinMinor, 'El presupuesto mínimo');
  const budgetMaxMinor = normalizeBudget(input.budgetMaxMinor, 'El presupuesto máximo');

  if (adults !== null && adults + children > 20) {
    throw new ValidationError('El viaje no puede tener más de 20 viajeros');
  }
  if (budgetMinMinor !== null && budgetMaxMinor !== null && budgetMaxMinor < budgetMinMinor) {
    throw new ValidationError('El presupuesto máximo no puede ser menor que el mínimo');
  }

  if (startDate && endDate) {
    const computed = diffDays(startDate, endDate) + 1;
    if (computed < 1) {
      throw new ValidationError('La fecha de fin no puede ser anterior a la de inicio');
    }
    if (durationDays !== null && durationDays !== computed) {
      throw new ValidationError('La duración no coincide con las fechas indicadas');
    }
    durationDays = computed;
  } else if (startDate && durationDays !== null) {
    endDate = addDays(startDate, durationDays - 1);
  } else if (endDate && durationDays !== null) {
    startDate = addDays(endDate, -(durationDays - 1));
  } else if (endDate && !startDate) {
    // An end date without a start date or duration is not enough to derive a duration.
    endDate = null;
  }

  return {
    destinationId: input.destinationId?.trim() || null,
    startDate,
    endDate,
    durationDays,
    adults,
    children,
    travelerType: normalizeTravelerType(input.travelerType),
    interests: normalizeInterests(input.interests),
    budgetMinMinor,
    budgetMaxMinor,
    currency: normalizeCurrency(input.currency),
  };
}

function computeMissingFields(slots: TripRequestSlots): MissingField[] {
  const missing: MissingField[] = [];
  if (!slots.destinationId) missing.push('destination');
  if (slots.durationDays === null) missing.push('duration');
  if (slots.adults === null) missing.push('travelers');
  if (slots.budgetMinMinor === null && slots.budgetMaxMinor === null) missing.push('budget');

  return MISSING_ORDER.filter((field) => missing.includes(field));
}

function statusFor(missingFields: MissingField[]): TripRequestStatus {
  return missingFields.length === 0 ? 'READY' : 'AWAITING_INPUT';
}

export class TripRequest {
  private constructor(private readonly props: TripRequestProps) {}

  static fromPersistence(props: TripRequestProps): TripRequest {
    return new TripRequest({
      ...props,
      slots: normalizeSlots(props.slots),
      missingFields: MISSING_ORDER.filter((field) => props.missingFields.includes(field)),
    });
  }

  static create(input: CreateTripRequestData): TripRequest {
    const slots = normalizeSlots(input.slots ?? {});
    const missingFields = computeMissingFields(slots);

    return new TripRequest({
      id: input.id,
      advisorId: input.advisorId,
      promptOriginal: sanitizePrompt(input.prompt),
      status: statusFor(missingFields),
      slots,
      extractedSlots: input.extractedSlots ?? {},
      missingFields,
      errorCode: null,
      createdAt: input.now,
      updatedAt: input.now,
      deletedAt: null,
    });
  }

  withAnswers(changes: Partial<TripRequestSlots>, now: Date): TripRequest {
    if (
      this.status !== 'AWAITING_INPUT' &&
      this.status !== 'READY' &&
      this.status !== 'FAILED'
    ) {
      throw new ConflictError(
        'La solicitud no admite respuestas en su estado actual',
        'CONFLICT',
      );
    }

    const merged: Partial<TripRequestSlots> = {
      ...this.slots,
      ...Object.fromEntries(
        Object.entries(changes).filter(([, value]) => value !== undefined),
      ),
      interests:
        changes.interests === undefined
          ? this.slots.interests
          : [...new Set([...this.slots.interests, ...changes.interests])],
    };
    const slots = normalizeSlots(merged);
    const missingFields = computeMissingFields(slots);

    return new TripRequest({
      ...this.props,
      slots,
      missingFields,
      status: statusFor(missingFields),
      errorCode: null,
      updatedAt: now,
    });
  }

  markGenerating(now: Date): TripRequest {
    if (this.status !== 'READY' && this.status !== 'FAILED') {
      throw new ConflictError(
        'La solicitud debe estar READY (o FAILED para reintentar) antes de generar',
        'CONFLICT',
      );
    }
    return new TripRequest({
      ...this.props,
      status: 'GENERATING',
      errorCode: null,
      updatedAt: now,
    });
  }

  markGenerated(planId: string, now: Date): TripRequest {
    if (this.status !== 'GENERATING') {
      throw new ConflictError('La solicitud no está generando un plan', 'CONFLICT');
    }
    return new TripRequest({
      ...this.props,
      status: 'GENERATED',
      planId,
      errorCode: null,
      updatedAt: now,
    });
  }

  markFailed(errorCode: string, now: Date): TripRequest {
    if (this.status !== 'GENERATING') {
      throw new ConflictError('La solicitud no está generando un plan', 'CONFLICT');
    }
    return new TripRequest({
      ...this.props,
      status: 'FAILED',
      errorCode,
      updatedAt: now,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get advisorId(): string {
    return this.props.advisorId;
  }

  get promptOriginal(): string {
    return this.props.promptOriginal;
  }

  get status(): TripRequestStatus {
    return this.props.status;
  }

  get slots(): Readonly<TripRequestSlots> {
    return this.props.slots;
  }

  get extractedSlots(): Readonly<Record<string, unknown>> {
    return this.props.extractedSlots;
  }

  get missingFields(): ReadonlyArray<MissingField> {
    return this.props.missingFields;
  }

  get planId(): string | null {
    return this.props.planId ?? null;
  }

  get errorCode(): string | null {
    return this.props.errorCode;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  get isReady(): boolean {
    return this.status === 'READY';
  }

  get canGenerate(): boolean {
    return this.status === 'READY' || this.status === 'FAILED';
  }
}
