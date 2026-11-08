import type {
  Paginated,
  PlanGenerationAccepted,
  TripRequestAnswer,
  TripRequestDto,
  TripRequestResponse,
} from '@trazo/shared';
import { apiJson } from './client';

export async function createTripRequest(prompt: string): Promise<TripRequestDto> {
  const data = await apiJson<TripRequestResponse>('/api/v1/trip-requests', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
  return data.tripRequest;
}

export async function fetchTripRequest(id: string): Promise<TripRequestDto> {
  const data = await apiJson<TripRequestResponse>(`/api/v1/trip-requests/${id}`);
  return data.tripRequest;
}

export async function answerTripRequest(
  id: string,
  answers: TripRequestAnswer[],
): Promise<TripRequestDto> {
  const data = await apiJson<TripRequestResponse>(`/api/v1/trip-requests/${id}/answers`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
  return data.tripRequest;
}

export async function generatePlan(tripRequestId: string): Promise<PlanGenerationAccepted> {
  return apiJson<PlanGenerationAccepted>(`/api/v1/trip-requests/${tripRequestId}/generate`, {
    method: 'POST',
  });
}

export interface TripRequestFilters {
  status?: TripRequestDto['status'];
  page?: number;
  pageSize?: number;
}

export async function listTripRequests(
  filters: TripRequestFilters = {},
): Promise<Paginated<TripRequestDto>> {
  const search = new URLSearchParams({
    page: String(filters.page ?? 1),
    pageSize: String(filters.pageSize ?? 20),
  });
  if (filters.status) search.set('status', filters.status);
  return apiJson<Paginated<TripRequestDto>>(`/api/v1/trip-requests?${search.toString()}`);
}
