import type { PlanItemType, PlanStatus, PricingUnit } from '@turiviaje/shared';
import {
  assertPrice,
  normalizeCurrency,
  normalizeHttpUrl,
  normalizeOptionalText,
  normalizeTags,
  normalizeText,
} from '../catalog/values.js';
import {
  ConflictError,
  NotFoundError,
  PlanNotEditableError,
  ValidationError,
} from '../shared/app-error.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ITEM_TYPES: readonly PlanItemType[] = ['ACCOMMODATION', 'ACTIVITY', 'TRANSPORT'];
const PRICING_UNITS: readonly PricingUnit[] = ['PER_PERSON', 'PER_NIGHT', 'PER_DAY', 'PER_TRIP'];

export interface PlanItemProps {
  id: string;
  type: PlanItemType;
  catalogItemId: string;
  nameSnapshot: string;
  imageUrl: string | null;
  unitPriceMinor: number;
  quantity: number;
  pricingUnit: PricingUnit;
  subtotalMinor: number;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  position: number;
}

export interface PlanDayProps {
  id: string;
  dayNumber: number;
  date: string;
  title: string | null;
  notes: string | null;
  items: PlanItemProps[];
}

export interface PlanProps {
  id: string;
  tripRequestId: string;
  advisorId: string;
  destinationId: string;
  title: string | null;
  status: PlanStatus;
  summary: string | null;
  heroImageUrl: string | null;
  tags: string[];
  currency: string;
  marginPercent: number;
  version: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  days: PlanDayProps[];
}

export interface PlanItemInput {
  id: string;
  type: PlanItemType;
  catalogItemId: string;
  nameSnapshot: string;
  imageUrl?: string | null;
  unitPriceMinor: number;
  quantity: number;
  pricingUnit: PricingUnit;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
}

export interface PlanDayInput {
  id: string;
  dayNumber: number;
  date: string;
  title?: string | null;
  notes?: string | null;
  items: Array<PlanItemInput & { position?: number }>;
}

export interface CreatePlanData {
  id: string;
  tripRequestId: string;
  advisorId: string;
  destinationId: string;
  title?: string | null;
  summary?: string | null;
  heroImageUrl?: string | null;
  tags?: string[];
  currency: string;
  marginPercent?: number;
  /** Duplicated plans keep the source revision number. */
  version?: number;
  days: PlanDayInput[];
  now: Date;
}

export interface PlanBudget {
  flightsMinor: number;
  hotelsMinor: number;
  activitiesMinor: number;
  subtotalMinor: number;
  marginPercent: number;
  marginMinor: number;
  totalMinor: number;
}

export interface PlanItemChanges {
  quantity?: number;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
}

export interface PlanMetadataChanges {
  title?: string | null;
  summary?: string | null;
  tags?: string[];
}

function normalizeItemType(value: PlanItemType): PlanItemType {
  if (!ITEM_TYPES.includes(value)) {
    throw new ValidationError('El tipo de ítem no es válido');
  }
  return value;
}

function normalizePricingUnit(value: PricingUnit): PricingUnit {
  if (!PRICING_UNITS.includes(value)) {
    throw new ValidationError('La unidad de precio no es válida');
  }
  return value;
}

function normalizeId(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ValidationError(`${field} es obligatorio`);
  return normalized;
}

function normalizeQuantity(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 99) {
    throw new ValidationError('La cantidad debe ser un entero entre 1 y 99');
  }
  return value;
}

function normalizeTime(value: string | null | undefined, field: string): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  if (!TIME.test(normalized)) {
    throw new ValidationError(`${field} debe usar el formato HH:mm`);
  }
  return normalized;
}

function normalizeIsoDate(value: string, field: string): string {
  const normalized = value.trim();
  if (!ISO_DATE.test(normalized)) {
    throw new ValidationError(`${field} debe usar el formato YYYY-MM-DD`);
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new ValidationError(`${field} no es una fecha válida`);
  }
  return normalized;
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function normalizeMarginPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new ValidationError('El margen debe estar entre 0 y 100');
  }
  const basisPoints = Math.round(value * 100);
  if (Math.abs(value * 100 - basisPoints) > 1e-6) {
    throw new ValidationError('El margen admite máximo dos decimales');
  }
  return basisPoints / 100;
}

function normalizeItem(input: PlanItemInput, position: number): PlanItemProps {
  const type = normalizeItemType(input.type);
  const unitPriceMinor = assertPrice(input.unitPriceMinor, 'El precio unitario');
  const quantity = normalizeQuantity(input.quantity);
  const subtotalMinor = unitPriceMinor * quantity;
  if (!Number.isSafeInteger(subtotalMinor)) {
    throw new ValidationError('El subtotal del ítem excede el rango permitido');
  }

  return {
    id: normalizeId(input.id, 'El id del ítem'),
    type,
    catalogItemId: normalizeId(input.catalogItemId, 'El ítem de catálogo'),
    nameSnapshot: normalizeText(input.nameSnapshot, 'El nombre del ítem', 1, 160),
    imageUrl: normalizeHttpUrl(input.imageUrl, 'La imagen del ítem'),
    unitPriceMinor,
    quantity,
    pricingUnit: normalizePricingUnit(input.pricingUnit),
    subtotalMinor,
    startTime: normalizeTime(input.startTime, 'La hora de inicio'),
    endTime: normalizeTime(input.endTime, 'La hora de fin'),
    notes: normalizeOptionalText(input.notes, 'Las notas del ítem', 500),
    position,
  };
}

function reindexItems(items: PlanItemProps[]): PlanItemProps[] {
  return items.map((item, index) => ({ ...item, position: index }));
}

function normalizeDays(input: PlanDayInput[]): PlanDayProps[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 30) {
    throw new ValidationError('El plan debe tener entre 1 y 30 días');
  }

  const sorted = [...input].sort((a, b) => a.dayNumber - b.dayNumber);
  const firstDate = normalizeIsoDate(sorted[0]!.date, 'La fecha del primer día');

  return sorted.map((day, index) => {
    const expectedNumber = index + 1;
    if (day.dayNumber !== expectedNumber) {
      throw new ValidationError('Los días deben ser consecutivos desde 1');
    }
    const expectedDate = addDays(firstDate, index);
    if (normalizeIsoDate(day.date, `La fecha del día ${expectedNumber}`) !== expectedDate) {
      throw new ValidationError('Las fechas de los días deben ser consecutivas');
    }
    if (day.items.length > 6) {
      throw new ValidationError('Cada día admite máximo 6 ítems');
    }
    const items = [...day.items]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((item, itemIndex) => normalizeItem(item, itemIndex));

    return {
      id: normalizeId(day.id, 'El id del día'),
      dayNumber: expectedNumber,
      date: expectedDate,
      title: normalizeOptionalText(day.title, 'El título del día', 160),
      notes: normalizeOptionalText(day.notes, 'Las notas del día', 1000),
      items,
    };
  });
}

function normalizeTagsValue(value: string[] | undefined): string[] {
  return normalizeTags(value ?? []);
}

function sumByType(days: readonly PlanDayProps[], type: PlanItemType): number {
  return days.reduce(
    (total, day) =>
      total + day.items.reduce((dayTotal, item) => dayTotal + (item.type === type ? item.subtotalMinor : 0), 0),
    0,
  );
}

export function computePlanBudget(
  days: readonly PlanDayProps[],
  marginPercent: number,
): PlanBudget {
  const flightsMinor = sumByType(days, 'TRANSPORT');
  const hotelsMinor = sumByType(days, 'ACCOMMODATION');
  const activitiesMinor = sumByType(days, 'ACTIVITY');
  const subtotalMinor = flightsMinor + hotelsMinor + activitiesMinor;
  if (!Number.isSafeInteger(subtotalMinor)) {
    throw new ValidationError('El subtotal del plan excede el rango permitido');
  }

  const percent = normalizeMarginPercent(marginPercent);
  const basisPoints = Math.round(percent * 100);
  const marginMinor = Math.floor((subtotalMinor * basisPoints + 5_000) / 10_000);
  if (!Number.isSafeInteger(marginMinor)) {
    throw new ValidationError('El margen del plan excede el rango permitido');
  }

  return {
    flightsMinor,
    hotelsMinor,
    activitiesMinor,
    subtotalMinor,
    marginPercent: percent,
    marginMinor,
    totalMinor: subtotalMinor + marginMinor,
  };
}

function findItem(
  days: readonly PlanDayProps[],
  itemId: string,
): { day: PlanDayProps; item: PlanItemProps; dayIndex: number; itemIndex: number } {
  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    const day = days[dayIndex]!;
    const itemIndex = day.items.findIndex((item) => item.id === itemId);
    if (itemIndex >= 0) {
      return { day, item: day.items[itemIndex]!, dayIndex, itemIndex };
    }
  }
  throw new NotFoundError('Ítem del plan');
}

export class Plan {
  private constructor(private readonly props: PlanProps) {}

  static fromPersistence(props: PlanProps): Plan {
    const days = normalizeDays(
      props.days.map((day) => ({
        id: day.id,
        dayNumber: day.dayNumber,
        date: day.date,
        title: day.title,
        notes: day.notes,
        items: day.items.map((item) => ({ ...item, imageUrl: item.imageUrl ?? null })),
      })),
    );

    return new Plan({
      ...props,
      title: normalizeOptionalText(props.title, 'El título del plan', 120),
      summary: normalizeOptionalText(props.summary, 'El resumen del plan', 1000),
      heroImageUrl: normalizeHttpUrl(props.heroImageUrl, 'La imagen del plan'),
      tags: normalizeTags(props.tags),
      currency: normalizeCurrency(props.currency),
      marginPercent: normalizeMarginPercent(props.marginPercent),
      days,
    });
  }

  static createDraft(input: CreatePlanData): Plan {
    return new Plan({
      id: normalizeId(input.id, 'El id del plan'),
      tripRequestId: normalizeId(input.tripRequestId, 'La solicitud de viaje'),
      advisorId: normalizeId(input.advisorId, 'El asesor'),
      destinationId: normalizeId(input.destinationId, 'El destino'),
      title: normalizeOptionalText(input.title, 'El título del plan', 120),
      status: 'DRAFT',
      summary: normalizeOptionalText(input.summary, 'El resumen del plan', 1000),
      heroImageUrl: normalizeHttpUrl(input.heroImageUrl, 'La imagen del plan'),
      tags: normalizeTagsValue(input.tags),
      currency: normalizeCurrency(input.currency),
      marginPercent: normalizeMarginPercent(input.marginPercent ?? 0),
      version: input.version ?? 1,
      publishedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
      deletedAt: null,
      days: normalizeDays(input.days),
    });
  }

  get id(): string {
    return this.props.id;
  }

  get tripRequestId(): string {
    return this.props.tripRequestId;
  }

  get advisorId(): string {
    return this.props.advisorId;
  }

  get destinationId(): string {
    return this.props.destinationId;
  }

  get title(): string | null {
    return this.props.title;
  }

  get status(): PlanStatus {
    return this.props.status;
  }

  get summary(): string | null {
    return this.props.summary;
  }

  get heroImageUrl(): string | null {
    return this.props.heroImageUrl;
  }

  get tags(): string[] {
    return [...this.props.tags];
  }

  get currency(): string {
    return this.props.currency;
  }

  get marginPercent(): number {
    return this.props.marginPercent;
  }

  get version(): number {
    return this.props.version;
  }

  get publishedAt(): Date | null {
    return this.props.publishedAt;
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

  get days(): readonly PlanDayProps[] {
    return this.props.days;
  }

  get budget(): PlanBudget {
    return computePlanBudget(this.props.days, this.props.marginPercent);
  }

  get canEdit(): boolean {
    return this.props.status === 'DRAFT' || this.props.status === 'SAVED';
  }

  get totalItems(): number {
    return this.props.days.reduce((total, day) => total + day.items.length, 0);
  }

  findItem(itemId: string): PlanItemProps | null {
    for (const day of this.props.days) {
      const item = day.items.find((current) => current.id === itemId);
      if (item) return item;
    }
    return null;
  }

  private assertEditable(): void {
    if (!this.canEdit) {
      throw new PlanNotEditableError(
        'Solo los planes DRAFT o SAVED se pueden editar; duplica un plan publicado para cambiarlo',
      );
    }
  }

  private withDays(days: PlanDayProps[], now: Date, extra: Partial<PlanProps> = {}): Plan {
    return new Plan({
      ...this.props,
      ...extra,
      days,
      updatedAt: now,
      version: this.props.version + 1,
    });
  }

  withMetadata(changes: PlanMetadataChanges, now: Date): Plan {
    this.assertEditable();
    return this.withDays(this.props.days, now, {
      title:
        changes.title === undefined
          ? this.props.title
          : normalizeOptionalText(changes.title, 'El título del plan', 120),
      summary:
        changes.summary === undefined
          ? this.props.summary
          : normalizeOptionalText(changes.summary, 'El resumen del plan', 1000),
      tags: changes.tags === undefined ? this.props.tags : normalizeTags(changes.tags),
    });
  }

  withMargin(marginPercent: number, now: Date): Plan {
    this.assertEditable();
    return new Plan({
      ...this.props,
      marginPercent: normalizeMarginPercent(marginPercent),
      updatedAt: now,
      version: this.props.version + 1,
    });
  }

  replaceItem(itemId: string, replacement: PlanItemInput, now: Date): Plan {
    this.assertEditable();
    const found = findItem(this.props.days, itemId);
    if (found.item.type !== replacement.type) {
      throw new ValidationError('El reemplazo debe ser del mismo tipo que el ítem original');
    }

    const normalized = normalizeItem(
      {
        ...replacement,
        id: found.item.id,
        type: found.item.type,
        quantity: replacement.quantity,
      },
      found.item.position,
    );

    const days = this.props.days.map((day, dayIndex) =>
      dayIndex === found.dayIndex
        ? {
            ...day,
            items: day.items.map((item, itemIndex) =>
              itemIndex === found.itemIndex ? normalized : item,
            ),
          }
        : day,
    );
    return this.withDays(days, now);
  }

  addItem(dayNumber: number, item: PlanItemInput, now: Date): Plan {
    this.assertEditable();
    const dayIndex = this.props.days.findIndex((day) => day.dayNumber === dayNumber);
    if (dayIndex < 0) throw new NotFoundError('Día del plan');

    const day = this.props.days[dayIndex]!;
    if (day.items.length >= 6) {
      throw new ValidationError('Cada día admite máximo 6 ítems');
    }
    const normalized = normalizeItem(item, day.items.length);
    const days = this.props.days.map((current, index) =>
      index === dayIndex ? { ...current, items: [...current.items, normalized] } : current,
    );
    return this.withDays(days, now);
  }

  removeItem(itemId: string, now: Date): Plan {
    this.assertEditable();
    const found = findItem(this.props.days, itemId);
    const days = this.props.days.map((day, dayIndex) =>
      dayIndex === found.dayIndex
        ? {
            ...day,
            items: reindexItems(day.items.filter((item) => item.id !== itemId)),
          }
        : day,
    );
    return this.withDays(days, now);
  }

  moveItem(itemId: string, targetDayNumber: number, position: number | undefined, now: Date): Plan {
    this.assertEditable();
    const found = findItem(this.props.days, itemId);
    const targetIndex = this.props.days.findIndex((day) => day.dayNumber === targetDayNumber);
    if (targetIndex < 0) throw new NotFoundError('Día del plan');

    const target = this.props.days[targetIndex]!;
    if (targetIndex !== found.dayIndex && target.items.length >= 6) {
      throw new ValidationError('Cada día admite máximo 6 ítems');
    }

    const withoutItem = this.props.days.map((day) =>
      day.id === found.day.id
        ? { ...day, items: day.items.filter((item) => item.id !== itemId) }
        : day,
    );
    const destination = withoutItem[targetIndex]!;
    const insertAt = Math.min(Math.max(position ?? destination.items.length, 0), destination.items.length);
    const items = [...destination.items];
    items.splice(insertAt, 0, { ...found.item, position: insertAt });

    const days = withoutItem.map((day, index) =>
      index === targetIndex ? { ...day, items: reindexItems(items) } : { ...day, items: reindexItems([...day.items]) },
    );
    return this.withDays(days, now);
  }

  updateItem(itemId: string, changes: PlanItemChanges, now: Date): Plan {
    this.assertEditable();
    const found = findItem(this.props.days, itemId);
    const quantity =
      changes.quantity === undefined ? found.item.quantity : normalizeQuantity(changes.quantity);
    const unitPriceMinor = found.item.unitPriceMinor;
    const subtotalMinor = unitPriceMinor * quantity;
    if (!Number.isSafeInteger(subtotalMinor)) {
      throw new ValidationError('El subtotal del ítem excede el rango permitido');
    }

    const updated: PlanItemProps = {
      ...found.item,
      quantity,
      subtotalMinor,
      startTime:
        changes.startTime === undefined
          ? found.item.startTime
          : normalizeTime(changes.startTime, 'La hora de inicio'),
      endTime:
        changes.endTime === undefined
          ? found.item.endTime
          : normalizeTime(changes.endTime, 'La hora de fin'),
      notes:
        changes.notes === undefined
          ? found.item.notes
          : normalizeOptionalText(changes.notes, 'Las notas del ítem', 500),
    };

    const days = this.props.days.map((day, dayIndex) =>
      dayIndex === found.dayIndex
        ? {
            ...day,
            items: day.items.map((item, itemIndex) =>
              itemIndex === found.itemIndex ? updated : item,
            ),
          }
        : day,
    );
    return this.withDays(days, now);
  }

  save(now: Date): Plan {
    if (this.props.status === 'SAVED') return this;
    if (this.props.status !== 'DRAFT') {
      throw new PlanNotEditableError('Solo un plan DRAFT se puede guardar');
    }
    return new Plan({
      ...this.props,
      status: 'SAVED',
      updatedAt: now,
      version: this.props.version + 1,
    });
  }

  publish(now: Date): Plan {
    if (this.props.status === 'PUBLISHED') {
      throw new ConflictError('El plan ya está publicado');
    }
    if (this.props.status === 'ARCHIVED') {
      throw new PlanNotEditableError('Un plan archivado no se puede publicar');
    }
    if (!this.props.title || this.props.title.trim().length < 2) {
      throw new ValidationError('El plan necesita un título comercial antes de publicarse');
    }
    if (this.totalItems === 0) {
      throw new ValidationError('El plan necesita al menos un ítem antes de publicarse');
    }
    if (this.budget.totalMinor <= 0) {
      throw new ValidationError('El total del plan debe ser mayor que cero para publicarse');
    }

    return new Plan({
      ...this.props,
      status: 'PUBLISHED',
      publishedAt: now,
      updatedAt: now,
      version: this.props.version + 1,
    });
  }

  archive(now: Date): Plan {
    if (this.props.status === 'ARCHIVED') return this;
    return new Plan({
      ...this.props,
      status: 'ARCHIVED',
      updatedAt: now,
      version: this.props.version + 1,
    });
  }
}
