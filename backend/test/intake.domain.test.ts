import { describe, expect, it } from 'vitest';
import { ConflictError, ValidationError } from '../src/domain/shared/app-error.js';
import {
  TripRequest,
  emptyTripRequestSlots,
  sanitizePrompt,
} from '../src/domain/intake/trip-request.js';

const NOW = new Date('2026-11-02T15:00:00.000Z');
const LATER = new Date('2026-11-03T15:00:00.000Z');

function createTripRequest(slots: Parameters<typeof TripRequest.create>[0]['slots'] = {}) {
  return TripRequest.create({
    id: 'trip-request-1',
    advisorId: 'user-1',
    prompt: 'Quiero un viaje',
    slots,
    now: NOW,
  });
}

describe('TripRequest', () => {
  it('starts in AWAITING_INPUT with every required slot missing', () => {
    const request = createTripRequest();

    expect(request.status).toBe('AWAITING_INPUT');
    expect(request.missingFields).toEqual([
      'destination',
      'duration',
      'travelers',
      'budget',
    ]);
    expect(request.slots.adults).toBeNull();
    expect(request.slots.children).toBe(0);
    expect(request.slots.currency).toBe('COP');
    expect(request.isReady).toBe(false);
  });

  it('becomes READY when destination, duration, travelers and budget are present', () => {
    const request = createTripRequest({
      destinationId: 'destination-1',
      durationDays: 5,
      adults: 2,
      budgetMaxMinor: 300_000_000,
    });

    expect(request.status).toBe('READY');
    expect(request.missingFields).toEqual([]);
    expect(request.isReady).toBe(true);
  });

  it('derives the end date from a start date and duration', () => {
    const request = createTripRequest({
      destinationId: 'destination-1',
      startDate: '2026-12-10',
      durationDays: 5,
      adults: 2,
      budgetMaxMinor: 300_000_000,
    });

    expect(request.slots.endDate).toBe('2026-12-14');
  });

  it('derives duration from explicit dates and rejects contradictions', () => {
    const request = createTripRequest({
      destinationId: 'destination-1',
      startDate: '2026-12-10',
      endDate: '2026-12-14',
      adults: 2,
      budgetMaxMinor: 300_000_000,
    });
    expect(request.slots.durationDays).toBe(5);

    expect(() =>
      createTripRequest({
        destinationId: 'destination-1',
        startDate: '2026-12-10',
        endDate: '2026-12-14',
        durationDays: 4,
        adults: 2,
      }),
    ).toThrowError(/duración no coincide/i);
  });

  it('merges answers, recomputes missing fields and normalizes interests', () => {
    const request = createTripRequest({ destinationId: 'destination-1' });
    const answered = request.withAnswers(
      {
        durationDays: 5,
        adults: 2,
        children: 1,
        travelerType: 'FAMILY',
        interests: ['Gastronomía', 'Vida nocturna'],
        budgetMaxMinor: 500_000_000,
      },
      LATER,
    );

    expect(answered.status).toBe('READY');
    expect(answered.missingFields).toEqual([]);
    expect(answered.slots.interests).toEqual(['gastronomia', 'vida-nocturna']);
    expect(answered.slots.travelerType).toBe('FAMILY');
    expect(answered.updatedAt).toEqual(LATER);
  });

  it('keeps existing interests when more are added', () => {
    const request = createTripRequest({
      destinationId: 'destination-1',
      durationDays: 5,
      adults: 2,
      budgetMaxMinor: 300_000_000,
      interests: ['playa'],
    });
    const answered = request.withAnswers({ interests: ['cultura', 'playa'] }, LATER);

    expect(answered.slots.interests).toEqual(['playa', 'cultura']);
  });

  it('rejects invalid budgets, travelers and dates', () => {
    expect(() => createTripRequest({ budgetMaxMinor: -1 })).toThrowError(ValidationError);
    expect(() => createTripRequest({ budgetMaxMinor: 1.5 })).toThrowError(ValidationError);
    expect(() => createTripRequest({ adults: 0 })).toThrowError(/adultos/i);
    expect(() => createTripRequest({ adults: 21 })).toThrowError(/adultos/i);
    expect(() => createTripRequest({ children: -1 })).toThrowError(/niños/i);
    expect(() => createTripRequest({ durationDays: 31 })).toThrowError(/duración/i);
    expect(() => createTripRequest({ startDate: '2026-02-30' })).toThrowError(/fecha/i);
    expect(() =>
      createTripRequest({ startDate: '2026-12-10', endDate: '2026-12-01' }),
    ).toThrowError(/anterior/i);
  });

  it('rejects answers after the request left the collecting state', () => {
    const generated = TripRequest.fromPersistence({
      id: 'trip-request-2',
      advisorId: 'user-1',
      promptOriginal: 'Quiero un viaje',
      status: 'GENERATED',
      slots: emptyTripRequestSlots(),
      extractedSlots: {},
      missingFields: [],
      errorCode: null,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    expect(() => generated.withAnswers({ adults: 2 }, LATER)).toThrowError(ConflictError);
  });

  it('sanitizes control characters and enforces the prompt limit', () => {
    expect(sanitizePrompt('  Hola\u0000  mundo  ')).toBe('Hola mundo');
    expect(() => sanitizePrompt('   ')).toThrowError(/vacío/i);
    expect(() => sanitizePrompt('a'.repeat(2001))).toThrowError(/2000/i);
  });
});
