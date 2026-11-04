import type { TripRequestStatus } from '@turiviaje/shared';
import type { TripRequest } from './trip-request.js';

export interface TripRequestPage<T> {
  items: T[];
  total: number;
}

export interface TripRequestSearchCriteria {
  /** Only used by ADMIN. ADVISOR queries are always scoped to their own userId. */
  advisorId?: string;
  status?: TripRequestStatus;
  page: number;
  pageSize: number;
}

export interface TripRequestRepository {
  create(request: TripRequest): Promise<TripRequest>;
  findById(id: string): Promise<TripRequest | null>;
  update(request: TripRequest): Promise<TripRequest | null>;
  search(criteria: TripRequestSearchCriteria): Promise<TripRequestPage<TripRequest>>;
}
