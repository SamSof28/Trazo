import type {
  ActivityIntensity,
  Money,
  PlanItemType,
  PlanStatus,
  PricingUnit,
  TransportMode,
} from '@trazo/shared';

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function formatMoney(money: Money | null | undefined): string {
  if (!money) return 'Por definir';
  const hasCents = money.amountMinor % 100 !== 0;
  const value = money.amountMinor / 100;
  const formatted = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(value);
  return `${money.currency} ${formatted}`;
}

export function formatMoneyShort(money: Money | null | undefined): string {
  if (!money) return '—';
  const value = money.amountMinor / 100;
  const formatted = new Intl.NumberFormat('es-CO', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
  return `${money.currency} ${formatted}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Por definir';
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(parsed)
    .replaceAll(',', '');
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
    .format(parsed)
    .replaceAll(',', '');
}

export function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start && !end) return 'Fechas por definir';
  if (start && !end) return formatDateShort(start);
  if (!start && end) return `Hasta ${formatDateShort(end)}`;
  return `${formatDateShort(start)} – ${formatDateShort(end)}`;
}

export function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function statusLabel(status: PlanStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Borrador';
    case 'SAVED':
      return 'Guardado';
    case 'PUBLISHED':
      return 'Publicado';
    case 'ARCHIVED':
      return 'Archivado';
  }
}

export function statusVariant(status: PlanStatus): 'draft' | 'saved' | 'published' | 'archived' {
  switch (status) {
    case 'DRAFT':
      return 'draft';
    case 'SAVED':
      return 'saved';
    case 'PUBLISHED':
      return 'published';
    case 'ARCHIVED':
      return 'archived';
  }
}

export function typeLabel(type: PlanItemType): string {
  switch (type) {
    case 'TRANSPORT':
      return 'Transporte';
    case 'ACCOMMODATION':
      return 'Alojamiento';
    case 'ACTIVITY':
      return 'Actividad';
  }
}

export function pricingUnitLabel(unit: PricingUnit): string {
  switch (unit) {
    case 'PER_PERSON':
      return 'por persona';
    case 'PER_NIGHT':
      return 'por noche';
    case 'PER_DAY':
      return 'por día';
    case 'PER_TRIP':
      return 'por trayecto';
  }
}

export function transportModeLabel(mode: TransportMode): string {
  switch (mode) {
    case 'FLIGHT':
      return 'Vuelo';
    case 'BUS':
      return 'Bus';
    case 'CAR_RENTAL':
      return 'Auto';
    case 'BOAT':
      return 'Lancha';
    case 'TRAIN':
      return 'Tren';
  }
}

export function intensityLabel(intensity: ActivityIntensity): string {
  switch (intensity) {
    case 'LOW':
      return 'Suave';
    case 'MEDIUM':
      return 'Media';
    case 'HIGH':
      return 'Exigente';
  }
}

export function intensityVariant(intensity: ActivityIntensity): 'mint' | 'gold' | 'neutral' {
  switch (intensity) {
    case 'LOW':
      return 'mint';
    case 'MEDIUM':
      return 'gold';
    case 'HIGH':
      return 'neutral';
  }
}

export function durationLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

export function travelerLabel(adults: number | null, children: number): string {
  const parts: string[] = [];
  if (adults) parts.push(`${adults} ${adults === 1 ? 'adulto' : 'adultos'}`);
  if (children > 0) parts.push(`${children} ${children === 1 ? 'niño' : 'niños'}`);
  return parts.length > 0 ? parts.join(' · ') : 'Viajeros por definir';
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function titleCase(value: string): string {
  return value
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function percentLabel(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function dateRangeFromDays(days: Array<{ date: string }>): {
  start: string | null;
  end: string | null;
} {
  if (days.length === 0) return { start: null, end: null };
  const sorted = [...days].map((day) => day.date).sort();
  return { start: sorted[0] ?? null, end: sorted[sorted.length - 1] ?? null };
}
