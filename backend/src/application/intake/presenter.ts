import type { IntakeQuestion, TripRequestDto } from '@trazo/shared';
import type { Destination } from '../../domain/catalog/destination.js';
import type { TripRequest } from '../../domain/intake/trip-request.js';

export function toTripRequestDto(
  request: TripRequest,
  destination: Destination | null,
  questions: IntakeQuestion[],
): TripRequestDto {
  const { slots } = request;

  return {
    id: request.id,
    promptOriginal: request.promptOriginal,
    status: request.status,
    slots: {
      destination:
        destination === null
          ? null
          : {
              id: destination.id,
              city: destination.city,
              country: destination.country,
            },
      startDate: slots.startDate,
      endDate: slots.endDate,
      durationDays: slots.durationDays,
      adults: slots.adults,
      children: slots.children,
      travelerType: slots.travelerType,
      interests: [...slots.interests],
      budgetMin:
        slots.budgetMinMinor === null
          ? null
          : { amountMinor: slots.budgetMinMinor, currency: slots.currency },
      budgetMax:
        slots.budgetMaxMinor === null
          ? null
          : { amountMinor: slots.budgetMaxMinor, currency: slots.currency },
      currency: slots.currency,
    },
    missingFields: [...request.missingFields],
    questions,
    planId: request.planId,
    errorCode: request.errorCode,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}
