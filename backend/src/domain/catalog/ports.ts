import type { ActivityIntensity, TransportMode } from '@turiviaje/shared';
import type { Activity } from './activity.js';
import type { Destination } from './destination.js';
import type { Hotel } from './hotel.js';
import type { TransportOption } from './transport-option.js';

export interface Page<T> {
  items: T[];
  total: number;
}

export interface DestinationSearchCriteria {
  query?: string;
  country?: string;
  featured?: boolean;
  page: number;
  pageSize: number;
}

export interface HotelSearchCriteria {
  destinationId?: string;
  maxPriceMinor?: number;
  currency?: string;
  page: number;
  pageSize: number;
}

export interface ActivitySearchCriteria {
  destinationId?: string;
  interest?: string;
  intensity?: ActivityIntensity;
  page: number;
  pageSize: number;
}

export interface TransportSearchCriteria {
  originDestinationId?: string;
  destinationId?: string;
  mode?: TransportMode;
  page: number;
  pageSize: number;
}

export interface DestinationRepository {
  search(criteria: DestinationSearchCriteria): Promise<Page<Destination>>;
  findById(id: string): Promise<Destination | null>;
  create(destination: Destination): Promise<Destination>;
  update(destination: Destination): Promise<Destination | null>;
}

export interface HotelRepository {
  search(criteria: HotelSearchCriteria): Promise<Page<Hotel>>;
  findById(id: string): Promise<Hotel | null>;
  create(hotel: Hotel): Promise<Hotel>;
  update(hotel: Hotel): Promise<Hotel | null>;
}

export interface ActivityRepository {
  search(criteria: ActivitySearchCriteria): Promise<Page<Activity>>;
  findById(id: string): Promise<Activity | null>;
  create(activity: Activity): Promise<Activity>;
  update(activity: Activity): Promise<Activity | null>;
}

export interface TransportOptionRepository {
  search(criteria: TransportSearchCriteria): Promise<Page<TransportOption>>;
  findById(id: string): Promise<TransportOption | null>;
  create(option: TransportOption): Promise<TransportOption>;
  update(option: TransportOption): Promise<TransportOption | null>;
}
