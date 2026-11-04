import type { Money } from './money.js';

export type TripRequestStatus =
  | 'COLLECTING'
  | 'AWAITING_INPUT'
  | 'READY'
  | 'GENERATING'
  | 'GENERATED'
  | 'FAILED';

export type TravelerType = 'SOLO' | 'COUPLE' | 'FAMILY' | 'FRIENDS' | 'BUSINESS';

/** Slots that must be resolved before a trip request can be generated. */
export type MissingField = 'destination' | 'duration' | 'travelers' | 'budget';

export type BudgetBand = 'LOW' | 'MEDIUM' | 'HIGH';

export interface TripRequestDestinationDto {
  id: string;
  city: string;
  country: string;
}

export interface TripRequestSlotsDto {
  destination: TripRequestDestinationDto | null;
  startDate: string | null;
  endDate: string | null;
  durationDays: number | null;
  adults: number | null;
  children: number;
  travelerType: TravelerType | null;
  interests: string[];
  budgetMin: Money | null;
  budgetMax: Money | null;
  currency: string;
}

export interface IntakeQuestion {
  field: MissingField;
  prompt: string;
  chips: string[];
}

export interface TripRequestDto {
  id: string;
  promptOriginal: string;
  status: TripRequestStatus;
  slots: TripRequestSlotsDto;
  missingFields: MissingField[];
  questions: IntakeQuestion[];
  /** Set once generation succeeds; null while the request has no plan. */
  planId: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripRequestResponse {
  tripRequest: TripRequestDto;
}

export interface TripRequestAnswer {
  field: MissingField;
  value: string;
}

export interface AnswerTripRequestInput {
  answers: TripRequestAnswer[];
}
