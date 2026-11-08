import type {
  ActivityDto,
  DestinationDto,
  HotelDto,
  Paginated,
  TransportOptionDto,
} from '@trazo/shared';
import { apiJson } from './client';

export interface DestinationFilters {
  q?: string;
  country?: string;
  featured?: boolean;
  page?: number;
  pageSize?: number;
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listDestinations(
  filters: DestinationFilters = {},
): Promise<Paginated<DestinationDto>> {
  return apiJson<Paginated<DestinationDto>>(
    `/api/v1/catalog/destinations${toQuery({
      q: filters.q,
      country: filters.country,
      featured: filters.featured,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 50,
    })}`,
  );
}

export async function getDestination(id: string): Promise<DestinationDto> {
  const data = await apiJson<{ destination: DestinationDto }>(
    `/api/v1/catalog/destinations/${id}`,
  );
  return data.destination;
}

export async function listHotels(destinationId: string): Promise<Paginated<HotelDto>> {
  return apiJson<Paginated<HotelDto>>(
    `/api/v1/catalog/hotels${toQuery({ destinationId, pageSize: 50 })}`,
  );
}

export async function listActivities(destinationId: string): Promise<Paginated<ActivityDto>> {
  return apiJson<Paginated<ActivityDto>>(
    `/api/v1/catalog/activities${toQuery({ destinationId, pageSize: 50 })}`,
  );
}

export async function listTransport(destinationId: string): Promise<Paginated<TransportOptionDto>> {
  return apiJson<Paginated<TransportOptionDto>>(
    `/api/v1/catalog/transport${toQuery({ destinationId, pageSize: 50 })}`,
  );
}
