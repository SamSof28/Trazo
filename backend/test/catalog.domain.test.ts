import { describe, expect, it } from 'vitest';
import { Activity } from '../src/domain/catalog/activity.js';
import { Destination } from '../src/domain/catalog/destination.js';
import { Hotel } from '../src/domain/catalog/hotel.js';
import { TransportOption } from '../src/domain/catalog/transport-option.js';

const NOW = new Date('2026-11-02T15:00:00.000Z');
const LATER = new Date('2026-11-03T15:00:00.000Z');

const destinationInput = {
  id: 'destination-1',
  city: '  Cartagena  ',
  country: 'Colombia',
  latitude: 10.391049,
  longitude: -75.479426,
  tags: ['Playa', ' playa ', 'Historia'],
  now: NOW,
};

const hotelInput = {
  id: 'hotel-1',
  destinationId: 'destination-1',
  name: '  Hotel Casa San Agustín  ',
  category: 5,
  roomType: 'Suite',
  pricePerNight: { amountMinor: 128_000_000, currency: 'cop' },
  now: NOW,
};

const activityInput = {
  id: 'activity-1',
  destinationId: 'destination-1',
  name: 'City tour',
  durationMinutes: 180,
  pricePerPerson: { amountMinor: 12_000_000, currency: 'COP' },
  tags: ['Historia', 'Cultura'],
  now: NOW,
};

const transportInput = {
  id: 'transport-1',
  originDestinationId: 'destination-2',
  destinationId: 'destination-1',
  mode: 'FLIGHT' as const,
  provider: 'Avianca',
  price: { amountMinor: 45_000_000, currency: 'COP' },
  pricingUnit: 'PER_PERSON' as const,
  durationMinutes: 90,
  now: NOW,
};

describe('Destination', () => {
  it('normalizes city, slug and tags', () => {
    const destination = Destination.create(destinationInput);
    expect(destination.city).toBe('Cartagena');
    expect(destination.slug).toBe('cartagena');
    expect(destination.tags).toEqual(['playa', 'historia']);
    expect(destination.isActive).toBe(true);
    expect(destination.fromPriceMinor).toBeNull();
  });

  it('derives an accent-free slug and keeps it stable on rename', () => {
    const bogota = Destination.create({
      ...destinationInput,
      city: 'Bogotá',
      country: 'Colombia',
    });
    expect(bogota.slug).toBe('bogota');

    const renamed = bogota.withChanges({ city: 'Bogotá D.C.' }, LATER);
    expect(renamed.slug).toBe('bogota');
    expect(renamed.updatedAt).toEqual(LATER);
  });

  it('rejects invalid coordinates, slugs and non-http images', () => {
    expect(() => Destination.create({ ...destinationInput, latitude: 91 })).toThrow(/latitud/i);
    expect(() => Destination.create({ ...destinationInput, longitude: -181 })).toThrow(/longitud/i);
    expect(() => Destination.create({ ...destinationInput, slug: 'Cartagena!' })).toThrow(/slug/i);
    expect(() =>
      Destination.create({
        ...destinationInput,
        heroImageUrl: 'javascript:alert(1)',
      }),
    ).toThrow(/http/i);
  });

  it('deactivates idempotently', () => {
    const destination = Destination.create(destinationInput);
    const inactive = destination.deactivate(LATER);
    expect(inactive.isActive).toBe(false);
    expect(inactive.deactivate(new Date())).toBe(inactive);
  });
});

describe('Hotel', () => {
  it('normalizes text, currency and defaults', () => {
    const hotel = Hotel.create(hotelInput);
    expect(hotel.name).toBe('Hotel Casa San Agustín');
    expect(hotel.currency).toBe('COP');
    expect(hotel.isActive).toBe(true);
    expect(hotel.amenities).toBeNull();
  });

  it('rejects categories outside 1..5 and unsafe prices', () => {
    expect(() => Hotel.create({ ...hotelInput, category: 0 })).toThrow(/categoría/i);
    expect(() => Hotel.create({ ...hotelInput, category: 6 })).toThrow(/categoría/i);
    expect(() =>
      Hotel.create({
        ...hotelInput,
        pricePerNight: { amountMinor: 1.5, currency: 'COP' },
      }),
    ).toThrow(/entero/i);
    expect(() =>
      Hotel.create({
        ...hotelInput,
        pricePerNight: { amountMinor: -1, currency: 'COP' },
      }),
    ).toThrow(/negativo|entero/i);
  });

  it('updates the price and keeps the destination', () => {
    const hotel = Hotel.create(hotelInput);
    const updated = hotel.withChanges(
      { pricePerNight: { amountMinor: 150_000_000, currency: 'COP' } },
      LATER,
    );
    expect(updated.pricePerNightMinor).toBe(150_000_000);
    expect(updated.destinationId).toBe('destination-1');
    expect(updated.updatedAt).toEqual(LATER);
  });
});

describe('Activity', () => {
  it('normalizes tags and defaults to low intensity', () => {
    const activity = Activity.create(activityInput);
    expect(activity.tags).toEqual(['historia', 'cultura']);
    expect(activity.intensity).toBe('LOW');
    expect(activity.pricePerPersonMinor).toBe(12_000_000);
  });

  it('rejects non-positive durations', () => {
    expect(() => Activity.create({ ...activityInput, durationMinutes: 0 })).toThrow(/duración/i);
    expect(() => Activity.create({ ...activityInput, durationMinutes: 10_081 })).toThrow(
      /duración/i,
    );
  });
});

describe('TransportOption', () => {
  it('accepts a flight priced per person', () => {
    const option = TransportOption.create(transportInput);
    expect(option.mode).toBe('FLIGHT');
    expect(option.pricingUnit).toBe('PER_PERSON');
  });

  it('enforces the pricing unit allowed by each mode', () => {
    expect(() =>
      TransportOption.create({
        ...transportInput,
        mode: 'CAR_RENTAL',
        pricingUnit: 'PER_TRIP',
      }),
    ).toThrow(/unidad de precio/i);

    expect(() =>
      TransportOption.create({
        ...transportInput,
        mode: 'FLIGHT',
        pricingUnit: 'PER_DAY',
      }),
    ).toThrow(/unidad de precio/i);

    expect(() =>
      TransportOption.create({
        ...transportInput,
        mode: 'FLIGHT',
        pricingUnit: 'PER_NIGHT',
      }),
    ).toThrow(/unidad de precio/i);
  });

  it('rejects the same origin and destination', () => {
    expect(() =>
      TransportOption.create({
        ...transportInput,
        originDestinationId: 'destination-1',
      }),
    ).toThrow(/origen y el destino/i);
  });

  it('revalidates the pricing unit when the mode changes', () => {
    const rental = TransportOption.create({
      ...transportInput,
      mode: 'CAR_RENTAL',
      pricingUnit: 'PER_DAY',
      originDestinationId: null,
      durationMinutes: 1440,
    });

    expect(() => rental.withChanges({ mode: 'FLIGHT' }, LATER)).toThrow(/unidad de precio/i);
  });
});
