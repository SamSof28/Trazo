import { describe, expect, it } from 'vitest';
import {
  DEST_CARTAGENA,
  DEST_MEDELLIN,
  DEST_SANTA_MARTA,
  makeDestination,
} from './catalog-fakes.js';
import { NOW } from './fakes.js';
import {
  parseAnswer,
  parsePrompt,
  resolveDestination,
} from '../src/application/intake/prompt-parser.js';

const DEST_SALENTO = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const DEST_SAN_ANDRES = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const destinations = [
  makeDestination(),
  makeDestination({
    id: DEST_MEDELLIN,
    city: 'Medellín',
    slug: 'medellin',
    isFeatured: false,
  }),
  makeDestination({
    id: DEST_SANTA_MARTA,
    city: 'Santa Marta',
    slug: 'santa-marta',
    isFeatured: false,
  }),
  makeDestination({
    id: DEST_SALENTO,
    city: 'Salento',
    slug: 'eje-cafetero',
    isFeatured: false,
  }),
  makeDestination({
    id: DEST_SAN_ANDRES,
    city: 'San Andrés',
    slug: 'san-andres',
    isFeatured: false,
  }),
];

describe('deterministic prompt parser', () => {
  it('extracts destination, duration, travelers, budget and interests', () => {
    const { slots } = parsePrompt(
      'Quiero un viaje a Cartagena para 2 adultos, 5 días, presupuesto de 3 millones, con playa',
      destinations,
      NOW,
    );

    expect(slots.destinationId).toBe(DEST_CARTAGENA);
    expect(slots.durationDays).toBe(5);
    expect(slots.adults).toBe(2);
    expect(slots.children).toBe(0);
    expect(slots.budgetMaxMinor).toBe(300_000_000);
    expect(slots.interests).toEqual(['playa']);
  });

  it('understands couples and inclusive date ranges', () => {
    const { slots } = parsePrompt(
      'Pareja, 5 días en Medellín, del 10 al 14 de diciembre, con cultura y gastronomía',
      destinations,
      NOW,
    );

    expect(slots.destinationId).toBe(DEST_MEDELLIN);
    expect(slots.adults).toBe(2);
    expect(slots.travelerType).toBe('COUPLE');
    expect(slots.startDate).toBe('2026-12-10');
    expect(slots.endDate).toBe('2026-12-14');
    expect(slots.durationDays).toBe(5);
    expect(slots.interests).toEqual(['cultura', 'gastronomia']);
  });

  it('understands families with children and week durations', () => {
    const { slots } = parsePrompt(
      'Familia con 2 niños en Santa Marta, una semana, presupuesto medio',
      destinations,
      NOW,
    );

    expect(slots.destinationId).toBe(DEST_SANTA_MARTA);
    expect(slots.adults).toBe(2);
    expect(slots.children).toBe(2);
    expect(slots.travelerType).toBe('FAMILY');
    expect(slots.durationDays).toBe(7);
    expect(slots.budgetMinMinor).toBe(200_000_000);
    expect(slots.budgetMaxMinor).toBe(500_000_000);
  });

  it('converts nights to days and understands budget bands', () => {
    const { slots } = parsePrompt(
      'Viaje solo a San Andrés, 3 noches, económico',
      destinations,
      NOW,
    );

    expect(slots.destinationId).toBe(DEST_SAN_ANDRES);
    expect(slots.adults).toBe(1);
    expect(slots.travelerType).toBe('SOLO');
    expect(slots.durationDays).toBe(4);
    expect(slots.budgetMinMinor).toBe(0);
    expect(slots.budgetMaxMinor).toBe(200_000_000);
  });

  it('matches a destination by its catalog slug', () => {
    const { slots } = parsePrompt(
      'Quiero ir al Eje Cafetero con 4 amigos del 2026-12-01 al 2026-12-05, aventura',
      destinations,
      NOW,
    );

    expect(slots.destinationId).toBe(DEST_SALENTO);
    expect(slots.adults).toBe(4);
    expect(slots.travelerType).toBe('FRIENDS');
    expect(slots.startDate).toBe('2026-12-01');
    expect(slots.endDate).toBe('2026-12-05');
    expect(slots.durationDays).toBe(5);
    expect(slots.interests).toEqual(['aventura']);
  });

  it('parses weekend escapes and explicit budget ranges', () => {
    const { slots } = parsePrompt(
      'Escapada de fin de semana a Cartagena, 2 personas, entre 2 y 5 millones',
      destinations,
      NOW,
    );

    expect(slots.destinationId).toBe(DEST_CARTAGENA);
    expect(slots.durationDays).toBe(3);
    expect(slots.adults).toBe(2);
    expect(slots.budgetMinMinor).toBe(200_000_000);
    expect(slots.budgetMaxMinor).toBe(500_000_000);
  });

  it('keeps an unknown destination as missing instead of inventing it', () => {
    const { slots, extractedSlots } = parsePrompt(
      'Viaje a París para 2 personas, 5 días, 4 millones',
      destinations,
      NOW,
    );

    expect(slots.destinationId).toBeUndefined();
    expect(slots.adults).toBe(2);
    expect(slots.durationDays).toBe(5);
    expect(slots.budgetMaxMinor).toBe(400_000_000);
    expect(extractedSlots.matchedDestination).toBeNull();
  });

  it('does not resolve an unknown destination from a vague phrase', () => {
    const { slots } = parsePrompt(
      'Quiero un viaje de 8 días con mi pareja, aún no sé a dónde, presupuesto premium',
      destinations,
      NOW,
    );

    expect(slots.destinationId).toBeUndefined();
    expect(slots.durationDays).toBe(8);
    expect(slots.adults).toBe(2);
    expect(slots.travelerType).toBe('COUPLE');
    expect(slots.budgetMinMinor).toBe(500_000_000);
    expect(slots.budgetMaxMinor).toBeUndefined();
  });

  it('extracts only the slots present in a short prompt', () => {
    const { slots } = parsePrompt('5 días en Cartagena', destinations, NOW);

    expect(slots.destinationId).toBe(DEST_CARTAGENA);
    expect(slots.durationDays).toBe(5);
    expect(slots.adults).toBeUndefined();
    expect(slots.budgetMinMinor).toBeUndefined();
    expect(slots.budgetMaxMinor).toBeUndefined();
  });

  it('derives duration from explicit ISO dates', () => {
    const { slots } = parsePrompt(
      'Viaje a Medellín del 2026-12-20 al 2026-12-27 para 3 adultos',
      destinations,
      NOW,
    );

    expect(slots.destinationId).toBe(DEST_MEDELLIN);
    expect(slots.startDate).toBe('2026-12-20');
    expect(slots.endDate).toBe('2026-12-27');
    expect(slots.durationDays).toBe(8);
    expect(slots.adults).toBe(3);
  });

  it('understands adults, children and a maximum budget', () => {
    const { slots } = parsePrompt(
      'Santa Marta, 2 adultos y 1 niño, 6 días, máximo 6.000.000 COP',
      destinations,
      NOW,
    );

    expect(slots.destinationId).toBe(DEST_SANTA_MARTA);
    expect(slots.adults).toBe(2);
    expect(slots.children).toBe(1);
    expect(slots.travelerType).toBe('FAMILY');
    expect(slots.durationDays).toBe(6);
    expect(slots.budgetMaxMinor).toBe(600_000_000);
  });

  it('does not guess a duration from a month alone', () => {
    const { slots } = parsePrompt(
      'Quiero ir a Cartagena en diciembre, no sé cuántos días',
      destinations,
      NOW,
    );

    expect(slots.destinationId).toBe(DEST_CARTAGENA);
    expect(slots.durationDays).toBeUndefined();
    expect(slots.startDate).toBeUndefined();
    expect(slots.adults).toBeUndefined();
  });

  it('handles a family with explicit adults and children plus a budget', () => {
    const { slots } = parsePrompt(
      'Un viaje de 4 días a Santa Marta para mi familia de 2 adultos y 2 niños con presupuesto de 4 millones',
      destinations,
      NOW,
    );

    expect(slots.destinationId).toBe(DEST_SANTA_MARTA);
    expect(slots.durationDays).toBe(4);
    expect(slots.adults).toBe(2);
    expect(slots.children).toBe(2);
    expect(slots.travelerType).toBe('FAMILY');
    expect(slots.budgetMaxMinor).toBe(400_000_000);
  });

  it('understands honeymoon as a couple', () => {
    const { slots } = parsePrompt(
      'Luna de miel en Cartagena, 5 días, todo incluido',
      destinations,
      NOW,
    );

    expect(slots.destinationId).toBe(DEST_CARTAGENA);
    expect(slots.durationDays).toBe(5);
    expect(slots.adults).toBe(2);
    expect(slots.travelerType).toBe('COUPLE');
  });

  it('parses friends without a count and an explicit range with thousands separators', () => {
    const { slots } = parsePrompt(
      '3 días en San Andrés con amigos, presupuesto entre 1.500.000 y 2.500.000',
      destinations,
      NOW,
    );

    expect(slots.destinationId).toBe(DEST_SAN_ANDRES);
    expect(slots.durationDays).toBe(3);
    expect(slots.adults).toBeUndefined();
    expect(slots.travelerType).toBe('FRIENDS');
    expect(slots.budgetMinMinor).toBe(150_000_000);
    expect(slots.budgetMaxMinor).toBe(250_000_000);
  });

  it('parses numeric slash dates and a start date with duration', () => {
    const { slots } = parsePrompt(
      'Quiero ir a Cartagena el 10/12/2026 por 3 días',
      destinations,
      NOW,
    );

    expect(slots.startDate).toBe('2026-12-10');
    expect(slots.durationDays).toBe(3);
  });

  it('resolves "Sorpréndenos" to the first featured destination', () => {
    expect(resolveDestination('Sorpréndenos', destinations)?.id).toBe(DEST_CARTAGENA);
  });
});

describe('deterministic answer parser', () => {
  it('resolves a catalog destination answer', () => {
    expect(parseAnswer('destination', 'Cartagena y playa', destinations, NOW)).toEqual({
      destinationId: DEST_CARTAGENA,
    });
  });

  it('rejects an unknown destination with a field-aware validation error', () => {
    expect(() => parseAnswer('destination', 'París', destinations, NOW)).toThrowError(
      /catálogo/i,
    );
    try {
      parseAnswer('destination', 'París', destinations, NOW);
    } catch (error) {
      expect(error).toMatchObject({ field: 'destination', status: 422 });
    }
  });

  it('parses duration answers', () => {
    expect(parseAnswer('duration', 'Fin de semana', destinations, NOW)).toEqual({
      durationDays: 3,
    });
    expect(parseAnswer('duration', 'del 10 al 15 de diciembre', destinations, NOW)).toEqual({
      startDate: '2026-12-10',
      endDate: '2026-12-15',
      durationDays: 6,
    });
  });

  it('parses traveler answers with children', () => {
    expect(parseAnswer('travelers', 'Familia con 2 niños', destinations, NOW)).toEqual({
      adults: 2,
      children: 2,
      travelerType: 'FAMILY',
    });
  });

  it('parses budget bands and explicit amounts', () => {
    expect(parseAnswer('budget', 'Medio', destinations, NOW)).toEqual({
      budgetMinMinor: 200_000_000,
      budgetMaxMinor: 500_000_000,
      currency: 'COP',
    });
    expect(parseAnswer('budget', '6.000.000 COP', destinations, NOW)).toEqual({
      budgetMaxMinor: 600_000_000,
      currency: 'COP',
    });
  });

  it('rejects an unusable duration answer', () => {
    expect(() => parseAnswer('duration', 'no sé', destinations, NOW)).toThrowError(
      /duración/i,
    );
  });
});
