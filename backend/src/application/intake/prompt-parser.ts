import type { MissingField, TravelerType } from '@turiviaje/shared';
import type { Destination } from '../../domain/catalog/destination.js';
import type { TripRequestSlots } from '../../domain/intake/trip-request.js';
import { ValidationError } from '../../domain/shared/app-error.js';

export interface ParsedPrompt {
  slots: Partial<TripRequestSlots>;
  extractedSlots: Record<string, unknown>;
}

interface DateRange {
  startDate: string;
  endDate: string | null;
}

const MONTHS: Record<string, number> = {
  enero: 1,
  ene: 1,
  febrero: 2,
  feb: 2,
  marzo: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  mayo: 5,
  may: 5,
  junio: 6,
  jun: 6,
  julio: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  septiembre: 9,
  setiembre: 9,
  sep: 9,
  set: 9,
  octubre: 10,
  oct: 10,
  noviembre: 11,
  nov: 11,
  diciembre: 12,
  dic: 12,
};

const WORD_NUMBERS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
};

const BUDGET_BANDS = {
  LOW: { minMinor: 0, maxMinor: 200_000_000 },
  MEDIUM: { minMinor: 200_000_000, maxMinor: 500_000_000 },
  HIGH: { minMinor: 500_000_000, maxMinor: null },
} as const;

const INTEREST_PATTERNS: ReadonlyArray<{ tag: string; pattern: RegExp }> = [
  { tag: 'playa', pattern: /\bplayas?\b/ },
  { tag: 'cultura', pattern: /\b(cultura|cultural|museos?|arquitectura)\b/ },
  { tag: 'aventura', pattern: /\b(aventura|adrenalina|extremo)\b/ },
  { tag: 'gastronomia', pattern: /\b(gastronomia|gastronomico|comida|culinario)\b/ },
  { tag: 'naturaleza', pattern: /\b(naturaleza|natural|paisajes?)\b/ },
  { tag: 'historia', pattern: /\b(historia|historico|colonial)\b/ },
  {
    tag: 'vida-nocturna',
    pattern: /\b(vida nocturna|fiesta|rumba|nightlife|bares?)\b/,
  },
  { tag: 'ciudad', pattern: /\b(ciudad|urbano|urbana)\b/ },
  { tag: 'cafe', pattern: /\b(cafe|cafetero|cafetera)\b/ },
  { tag: 'buceo', pattern: /\b(buceo|snorkel|bucear)\b/ },
  { tag: 'caribe', pattern: /\bcaribe\b/ },
  { tag: 'artesania', pattern: /\b(artesania|artesanias|artesanal)\b/ },
  { tag: 'compras', pattern: /\b(compras|shopping)\b/ },
  { tag: 'relax', pattern: /\b(relax|descanso|descansar|spa)\b/ },
  { tag: 'senderismo', pattern: /\b(senderismo|trekking|caminata|caminatas)\b/ },
  { tag: 'ecoturismo', pattern: /\b(ecoturismo|ecologico|ecologica)\b/ },
  { tag: 'deporte', pattern: /\b(deporte|deportes|bicicleta|ciclismo)\b/ },
];

/** Lowercase, strip accents and collapse whitespace so matching is stable. */
export function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function destinationAliases(destination: Destination): string[] {
  return [normalizeForMatch(destination.city), normalizeForMatch(destination.slug.replace(/-/g, ' '))];
}

function isSurpriseRequest(text: string): boolean {
  return /\b(sorprendenos|sorprendeme|sorprendanos|inspirame|lo que sea)\b/.test(text);
}

/**
 * Resolves a free-text destination against the active catalog. It never invents a destination:
 * an unknown place such as "Paris" returns null and stays as a missing slot.
 */
export function resolveDestination(
  value: string,
  destinations: Destination[],
): Destination | null {
  const text = normalizeForMatch(value);
  if (!text) return null;

  if (isSurpriseRequest(text)) {
    return destinations.find((destination) => destination.isFeatured) ?? destinations[0] ?? null;
  }

  const exact = destinations.find((destination) =>
    destinationAliases(destination).some((alias) => alias === text),
  );
  if (exact) return exact;

  const sorted = [...destinations].sort((a, b) => {
    const longestA = Math.max(...destinationAliases(a).map((alias) => alias.length));
    const longestB = Math.max(...destinationAliases(b).map((alias) => alias.length));
    return longestB - longestA;
  });

  for (const destination of sorted) {
    for (const alias of destinationAliases(destination)) {
      if (alias.length >= 4 && text.includes(alias)) return destination;
    }
  }
  return null;
}

function parseCount(token: string): number | null {
  if (/^\d+$/.test(token)) {
    const value = Number(token);
    return Number.isInteger(value) ? value : null;
  }
  return WORD_NUMBERS[token] ?? null;
}

function buildIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function inferYear(month: number, day: number, now: Date, explicitYear?: number): number | null {
  if (explicitYear !== undefined) {
    return buildIsoDate(explicitYear, month, day) ? explicitYear : null;
  }
  const today = buildIsoDate(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
  const candidate = buildIsoDate(now.getUTCFullYear(), month, day);
  if (!today || !candidate) return null;
  return candidate < today ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
}

function parseExplicitDates(text: string, now: Date): DateRange | null {
  const isoDates = [...text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)]
    .map((match) => buildIsoDate(Number(match[1]), Number(match[2]), Number(match[3])))
    .filter((value): value is string => value !== null);
  if (isoDates.length >= 2) {
    return { startDate: isoDates[0]!, endDate: isoDates[1]! };
  }
  if (isoDates.length === 1) {
    return { startDate: isoDates[0]!, endDate: null };
  }

  const slashDates = [...text.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)]
    .map((match) => {
      const year = match[3]
        ? Number(match[3].length === 2 ? `20${match[3]}` : match[3])
        : inferYear(Number(match[2]), Number(match[1]), now);
      return year === null ? null : buildIsoDate(year, Number(match[2]), Number(match[1]));
    })
    .filter((value): value is string => value !== null);
  if (slashDates.length >= 2) {
    return { startDate: slashDates[0]!, endDate: slashDates[1]! };
  }
  if (slashDates.length === 1) {
    return { startDate: slashDates[0]!, endDate: null };
  }

  // "10 de diciembre al 15 de diciembre (de 2026)"
  const monthToMonth = text.match(
    /(?:del?\s+)?(\d{1,2})\s+de\s+([a-z]+)(?:\s+(?:de|del)\s+(\d{4}))?\s+(?:al|hasta)\s+(\d{1,2})\s+de\s+([a-z]+)(?:\s+(?:de|del)\s+(\d{4}))?/,
  );
  if (monthToMonth) {
    const month1 = MONTHS[monthToMonth[2]!];
    const month2 = MONTHS[monthToMonth[5]!];
    if (month1 && month2) {
      const startYear = inferYear(
        month1,
        Number(monthToMonth[1]),
        now,
        monthToMonth[3] ? Number(monthToMonth[3]) : undefined,
      );
      let endYear = monthToMonth[6]
        ? Number(monthToMonth[6])
        : (startYear ?? now.getUTCFullYear());
      const start = startYear === null ? null : buildIsoDate(startYear, month1, Number(monthToMonth[1]));
      let end = buildIsoDate(endYear, month2, Number(monthToMonth[4]));
      if (start && end && end < start && !monthToMonth[6]) {
        endYear += 1;
        end = buildIsoDate(endYear, month2, Number(monthToMonth[4]));
      }
      if (start && end) return { startDate: start, endDate: end };
    }
  }

  // "del 10 al 15 de diciembre (de 2026)"
  const dayRange = text.match(
    /(?:del?\s+)?(\d{1,2})\s*(?:al|hasta)\s*(\d{1,2})\s+de\s+([a-z]+)(?:\s+(?:de|del)\s+(\d{4}))?/,
  );
  if (dayRange) {
    const month = MONTHS[dayRange[3]!];
    if (month) {
      const year = inferYear(
        month,
        Number(dayRange[1]),
        now,
        dayRange[4] ? Number(dayRange[4]) : undefined,
      );
      if (year !== null) {
        const start = buildIsoDate(year, month, Number(dayRange[1]));
        let end = buildIsoDate(year, month, Number(dayRange[2]));
        if (start && end && end < start) {
          end = buildIsoDate(year + 1, month, Number(dayRange[2]));
        }
        if (start && end) return { startDate: start, endDate: end };
      }
    }
  }

  // "diciembre 10 al 15 (de 2026)"
  const monthFirstRange = text.match(
    /([a-z]+)\s+(\d{1,2})\s*(?:al|hasta)\s*(\d{1,2})(?:\s+(?:de|del)\s+(\d{4}))?/,
  );
  if (monthFirstRange) {
    const month = MONTHS[monthFirstRange[1]!];
    if (month) {
      const year = inferYear(
        month,
        Number(monthFirstRange[2]),
        now,
        monthFirstRange[4] ? Number(monthFirstRange[4]) : undefined,
      );
      if (year !== null) {
        const start = buildIsoDate(year, month, Number(monthFirstRange[2]));
        let end = buildIsoDate(year, month, Number(monthFirstRange[3]));
        if (start && end && end < start) {
          end = buildIsoDate(year + 1, month, Number(monthFirstRange[3]));
        }
        if (start && end) return { startDate: start, endDate: end };
      }
    }
  }

  // "10 de diciembre (de 2026)"
  const singleDay = text.match(
    /(\d{1,2})\s+de\s+([a-z]+)(?:\s+(?:de|del)\s+(\d{4}))?/,
  );
  if (singleDay) {
    const month = MONTHS[singleDay[2]!];
    if (month) {
      const year = inferYear(
        month,
        Number(singleDay[1]),
        now,
        singleDay[3] ? Number(singleDay[3]) : undefined,
      );
      const start = year === null ? null : buildIsoDate(year, month, Number(singleDay[1]));
      if (start) return { startDate: start, endDate: null };
    }
  }

  // "diciembre 10 (de 2026)"
  const monthFirst = text.match(/([a-z]+)\s+(\d{1,2})(?:\s+(?:de|del)\s+(\d{4}))?/);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1]!];
    if (month) {
      const year = inferYear(
        month,
        Number(monthFirst[2]),
        now,
        monthFirst[3] ? Number(monthFirst[3]) : undefined,
      );
      const start = year === null ? null : buildIsoDate(year, month, Number(monthFirst[2]));
      if (start) return { startDate: start, endDate: null };
    }
  }

  return null;
}

function parseDurationDays(text: string): number | null {  if (/\bfin de semana\b/.test(text)) return 3;
  if (/\bquincena\b/.test(text)) return 15;

  const days = text.match(/\b(\d{1,2})\s*dias?\b/);
  if (days) {
    const value = Number(days[1]);
    return value >= 1 && value <= 30 ? value : null;
  }

  const nights = text.match(/\b(\d{1,2})\s*noches?\b/);
  if (nights) {
    const value = Number(nights[1]) + 1;
    return value >= 1 && value <= 30 ? value : null;
  }

  const weeks = text.match(/\b(\d{1,2})\s*semanas?\b/);
  if (weeks) {
    const value = Number(weeks[1]) * 7;
    return value >= 1 && value <= 30 ? value : null;
  }

  const wordDuration = text.match(
    /\b(una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince)\s+(dias?|noches?|semanas?)\b/,
  );
  if (wordDuration) {
    const count = WORD_NUMBERS[wordDuration[1]!];
    if (!count) return null;
    const unit = wordDuration[2]!;
    const value = unit.startsWith('noche') ? count + 1 : unit.startsWith('semana') ? count * 7 : count;
    return value >= 1 && value <= 30 ? value : null;
  }

  return null;
}

function parseTravelers(text: string): Partial<TripRequestSlots> {
  const result: Partial<TripRequestSlots> = {};
  let adults: number | null = null;
  let children: number | null = null;
  let travelerType: TravelerType | null = null;

  const people = text.match(
    /\b(\d{1,2}|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince)\s+(adultos?|mayores?|personas?|pasajeros?|huespedes?)\b/,
  );
  if (people) adults = parseCount(people[1]!);

  const kids = text.match(
    /\b(\d{1,2}|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(ninos?|menores?)\b/,
  );
  if (kids) children = parseCount(kids[1]!);

  const friends = text.match(
    /\b(\d{1,2}|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(amigos?|amigas?)\b/,
  );
  if (friends) {
    adults = parseCount(friends[1]!);
    travelerType = 'FRIENDS';
  } else if (/\b(amigos?|amigas?)\b/.test(text) && travelerType === null) {
    travelerType = 'FRIENDS';
  }

  if (/\b(pareja|luna de miel|con mi (novio|novia|esposo|esposa|pareja)|mi (novio|novia|esposo|esposa|pareja) y yo)\b/.test(text)) {
    adults = adults ?? 2;
    travelerType = 'COUPLE';
  }

  if (/\bfamilia\b/.test(text)) {
    const familySize = text.match(/\bfamilia\s+(?:de\s+)?(\d{1,2})\b/);
    adults = adults ?? (familySize ? (parseCount(familySize[1]!) ?? 2) : 2);
    travelerType = 'FAMILY';
  }

  if (/\b(viajo solo|viajar solo|viaje solo|para mi solo|solo yo)\b/.test(text) || text === 'solo') {
    adults = 1;
    travelerType = 'SOLO';
  }

  if (/\b(negocios|trabajo|business|corporativo)\b/.test(text)) {
    travelerType = 'BUSINESS';
  }

  if (children !== null && children > 0) {
    travelerType = 'FAMILY';
  } else if (adults === 1 && travelerType === null) {
    travelerType = 'SOLO';
  }

  if (adults !== null) {
    result.adults = adults;
    result.children = children ?? 0;
  } else if (children !== null) {
    result.children = children;
  }
  if (travelerType !== null) result.travelerType = travelerType;
  return result;
}

function parseAmount(raw: string, unit: string | undefined): number | null {
  const normalized = raw.trim();
  if (!normalized) return null;

  const hasUnit = Boolean(unit);
  let numeric: string;
  if (normalized.includes(',') && normalized.includes('.')) {
    numeric = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    numeric = hasUnit ? normalized.replace(',', '.') : normalized.replace(/,/g, '');
  } else if (normalized.includes('.')) {
    const parts = normalized.split('.');
    numeric = hasUnit && parts.length === 2 ? normalized : normalized.replace(/\./g, '');
  } else {
    numeric = normalized;
  }

  const value = Number(numeric);
  if (!Number.isFinite(value) || value <= 0) return null;

  if (unit === 'millones' || unit === 'millon' || unit === 'palos' || unit === 'm') {
    return Math.round(value * 1_000_000);
  }
  if (unit === 'mil') return Math.round(value * 1_000);
  return Math.round(value);
}

function toMinor(cop: number): number {
  return Math.round(cop * 100);
}

function parseBudget(text: string): Partial<TripRequestSlots> {
  const range = text.match(
    /\b(?:entre|de|desde)\s+\$?\s*([\d][\d.,]*)\s*(millones?|millon|palos?|mil|m)?\s*(?:y|a|hasta|-)\s*\$?\s*([\d][\d.,]*)\s*(millones?|millon|palos?|mil|m)?\b/,
  );
  const rangeWithUnit = text.match(
    /\b([\d][\d.,]*)\s*(?:a|y|-)\s*([\d][\d.,]*)\s*(millones?|millon|palos?|mil)\b/,
  );

  const rangeMatch = range ?? rangeWithUnit;
  if (rangeMatch) {
    const minRaw = rangeMatch[1];
    const maxRaw = range ? rangeMatch[3] : rangeMatch[2];
    const firstUnit = range ? rangeMatch[2] : rangeMatch[3];
    const secondUnit = range ? rangeMatch[4] : rangeMatch[3];
    const unitForFirst = firstUnit ?? secondUnit;
    const unitForSecond = secondUnit ?? firstUnit;
    const minCop = minRaw ? parseAmount(minRaw, unitForFirst) : null;
    const maxCop = maxRaw ? parseAmount(maxRaw, unitForSecond) : null;
    if (minCop !== null && maxCop !== null && maxCop >= minCop) {
      return {
        budgetMinMinor: toMinor(minCop),
        budgetMaxMinor: toMinor(maxCop),
        currency: 'COP',
      };
    }
  }

  // A phrase such as "de 4 días" also matches the single-amount pattern, so every candidate is
  // tried in order until one actually looks like money ("presupuesto de 4 millones").
  const candidates: Array<{ raw: string; unit: string | undefined }> = [];
  const single =
    /\b(?:presupuesto|maximo|max|hasta|minimo|min|desde|de|con|por|gastar|invertir)\s+(?:de\s+)?\$?\s*([\d][\d.,]*)\s*(millones?|millon|palos?|mil|m)?\b/g;
  for (const match of text.matchAll(single)) {
    candidates.push({ raw: match[1]!, unit: match[2] });
  }
  for (const match of text.matchAll(/\$?\s*([\d][\d.,]*)\s*(millones?|millon|palos?)\b/g)) {
    candidates.push({ raw: match[1]!, unit: match[2] });
  }
  for (const match of text.matchAll(
    /\$?\s*([\d]{1,3}(?:[.,]\d{3})+|\d{5,})\s*(cop|pesos?|colombianos?)?\b/g,
  )) {
    candidates.push({ raw: match[1]!, unit: undefined });
  }

  const hasCurrencyHint = /\$|\bcop\b|\bpesos?\b|\bcolombianos?\b/.test(text);
  for (const { raw, unit } of candidates) {
    const rawLooksMoney = /[.,]\d{3}/.test(raw) || raw.replace(/\D/g, '').length >= 5;
    if (!unit && !hasCurrencyHint && !rawLooksMoney) continue;

    const cop = parseAmount(raw, unit);
    if (cop === null) continue;

    const minor = toMinor(cop);
    if (/\b(minimo|min|desde)\b/.test(text)) {
      return { budgetMinMinor: minor, currency: 'COP' };
    }
    return { budgetMaxMinor: minor, currency: 'COP' };
  }

  if (/\b(economico|economica|barato|barata|mochilero|low)\b/.test(text)) {
    return {
      budgetMinMinor: BUDGET_BANDS.LOW.minMinor,
      budgetMaxMinor: BUDGET_BANDS.LOW.maxMinor,
      currency: 'COP',
    };
  }
  if (/\b(medio|media|moderado|intermedio|standard)\b/.test(text)) {
    return {
      budgetMinMinor: BUDGET_BANDS.MEDIUM.minMinor,
      budgetMaxMinor: BUDGET_BANDS.MEDIUM.maxMinor,
      currency: 'COP',
    };
  }
  if (/\b(premium|lujo|alto|alta|exclusivo)\b/.test(text)) {
    // HIGH is open-ended: omit the maximum instead of sending an explicit null.
    return {
      budgetMinMinor: BUDGET_BANDS.HIGH.minMinor,
      currency: 'COP',
    };
  }

  return {};
}

function parseInterests(text: string): string[] {
  const interests: string[] = [];
  for (const { tag, pattern } of INTEREST_PATTERNS) {
    if (pattern.test(text)) interests.push(tag);
  }
  return [...new Set(interests)];
}

function inclusiveDays(start: string, end: string): number | null {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return Math.round((endMs - startMs) / 86_400_000) + 1;
}

export function parsePrompt(
  prompt: string,
  destinations: Destination[],
  now: Date,
): ParsedPrompt {
  const text = normalizeForMatch(prompt);
  const destination = resolveDestination(text, destinations);
  const dates = parseExplicitDates(text, now);
  const durationDays = parseDurationDays(text);
  const travelers = parseTravelers(text);
  const budget = parseBudget(text);
  // The destination name is not an interest: "Eje Cafetero" must not add the `cafe` tag.
  const interestText = destination
    ? destinationAliases(destination).reduce((acc, alias) => acc.split(alias).join(' '), text)
    : text;
  const interests = parseInterests(interestText);

  const slots: Partial<TripRequestSlots> = {
    ...travelers,
    ...budget,
    ...(interests.length > 0 ? { interests } : {}),
  };

  if (destination) slots.destinationId = destination.id;
  if (dates) {
    slots.startDate = dates.startDate;
    if (dates.endDate) {
      slots.endDate = dates.endDate;
      const computed = inclusiveDays(dates.startDate, dates.endDate);
      if (computed !== null) slots.durationDays = computed;
    } else if (durationDays !== null) {
      slots.durationDays = durationDays;
    }
  } else if (durationDays !== null) {
    slots.durationDays = durationDays;
  }

  return {
    slots,
    extractedSlots: {
      parser: 'deterministic-v1',
      matchedDestination: destination?.city ?? null,
      startDate: dates?.startDate ?? null,
      endDate: dates?.endDate ?? null,
      durationDays: slots.durationDays ?? null,
      adults: slots.adults ?? null,
      children: slots.children ?? 0,
      travelerType: slots.travelerType ?? null,
      budgetMinMinor: slots.budgetMinMinor ?? null,
      budgetMaxMinor: slots.budgetMaxMinor ?? null,
      interests: slots.interests ?? [],
    },
  };
}

export function parseAnswer(
  field: MissingField,
  value: string,
  destinations: Destination[],
  now: Date,
): Partial<TripRequestSlots> {
  const text = normalizeForMatch(value);

  switch (field) {
    case 'destination': {
      const destination = resolveDestination(text, destinations);
      if (!destination) {
        throw new ValidationError(
          `No encontramos "${value}" en el catálogo. Elige un destino disponible o escribe "Sorpréndenos".`,
          'destination',
        );
      }
      return { destinationId: destination.id };
    }
    case 'duration': {
      const dates = parseExplicitDates(text, now);
      if (dates) {
        const computed = dates.endDate ? inclusiveDays(dates.startDate, dates.endDate) : null;
        return {
          startDate: dates.startDate,
          ...(dates.endDate ? { endDate: dates.endDate } : {}),
          ...(computed !== null ? { durationDays: computed } : {}),
        };
      }
      const days = parseDurationDays(text);
      if (days === null) {
        throw new ValidationError(
          'Indica la duración en días (por ejemplo "5 días") o las fechas del viaje.',
          'duration',
        );
      }
      return { durationDays: days };
    }
    case 'travelers': {
      const travelers = parseTravelers(text);
      if (travelers.adults === undefined) {
        throw new ValidationError(
          'Indica cuántos adultos viajan (por ejemplo "2 adultos" o "pareja").',
          'travelers',
        );
      }
      return travelers;
    }
    case 'budget': {
      const budget = parseBudget(text);
      if (budget.budgetMinMinor === undefined && budget.budgetMaxMinor === undefined) {
        throw new ValidationError(
          'Indica un presupuesto por persona (por ejemplo "2.000.000 a 5.000.000 COP").',
          'budget',
        );
      }
      return budget;
    }
  }
}
