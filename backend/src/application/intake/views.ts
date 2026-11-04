import type { IntakeQuestion } from '@turiviaje/shared';
import type { Destination } from '../../domain/catalog/destination.js';
import type { TripRequest } from '../../domain/intake/trip-request.js';

export interface TripRequestView {
  tripRequest: TripRequest;
  destination: Destination | null;
  questions: IntakeQuestion[];
}

export interface TripRequestListResult {
  items: TripRequestView[];
  total: number;
}
