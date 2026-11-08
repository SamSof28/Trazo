import type {
  AddPlanItemInput,
  MovePlanItemInput,
  Paginated,
  PlanAlternativeDto,
  PlanAlternativesResponse,
  PlanDto,
  PlanResponse,
  PlanStatus,
  ReplacePlanItemInput,
  UpdatePlanInput,
  UpdatePlanItemInput,
} from '@trazo/shared';
import { apiJson, downloadFile } from './client';

export interface PlanFilters {
  status?: PlanStatus;
  q?: string;
  destinationId?: string;
  page?: number;
  pageSize?: number;
}

export async function listPlans(filters: PlanFilters = {}): Promise<Paginated<PlanDto>> {
  const search = new URLSearchParams({
    page: String(filters.page ?? 1),
    pageSize: String(filters.pageSize ?? 12),
  });
  if (filters.status) search.set('status', filters.status);
  if (filters.q) search.set('q', filters.q);
  if (filters.destinationId) search.set('destinationId', filters.destinationId);
  return apiJson<Paginated<PlanDto>>(`/api/v1/plans?${search.toString()}`);
}

export async function getPlan(id: string): Promise<PlanDto> {
  const data = await apiJson<PlanResponse>(`/api/v1/plans/${id}`);
  return data.plan;
}

export async function updatePlan(id: string, input: UpdatePlanInput): Promise<PlanDto> {
  const data = await apiJson<PlanResponse>(`/api/v1/plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data.plan;
}

export async function addPlanItem(id: string, input: AddPlanItemInput): Promise<PlanDto> {
  const data = await apiJson<PlanResponse>(`/api/v1/plans/${id}/items`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.plan;
}

export async function replacePlanItem(
  id: string,
  itemId: string,
  input: ReplacePlanItemInput,
): Promise<PlanDto> {
  const data = await apiJson<PlanResponse>(`/api/v1/plans/${id}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data.plan;
}

export async function updatePlanItem(
  id: string,
  itemId: string,
  input: UpdatePlanItemInput,
): Promise<PlanDto> {
  const data = await apiJson<PlanResponse>(`/api/v1/plans/${id}/items/${itemId}/details`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data.plan;
}

export async function movePlanItem(
  id: string,
  itemId: string,
  input: MovePlanItemInput,
): Promise<PlanDto> {
  const data = await apiJson<PlanResponse>(`/api/v1/plans/${id}/items/${itemId}/position`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data.plan;
}

export async function removePlanItem(id: string, itemId: string): Promise<PlanDto> {
  const data = await apiJson<PlanResponse>(`/api/v1/plans/${id}/items/${itemId}`, {
    method: 'DELETE',
  });
  return data.plan;
}

export async function savePlan(id: string): Promise<PlanDto> {
  const data = await apiJson<PlanResponse>(`/api/v1/plans/${id}/save`, { method: 'POST' });
  return data.plan;
}

export async function publishPlan(id: string): Promise<PlanDto> {
  const data = await apiJson<PlanResponse>(`/api/v1/plans/${id}/publish`, { method: 'POST' });
  return data.plan;
}

export async function archivePlan(id: string): Promise<PlanDto> {
  const data = await apiJson<PlanResponse>(`/api/v1/plans/${id}/archive`, { method: 'POST' });
  return data.plan;
}

export async function duplicatePlan(id: string): Promise<PlanDto> {
  const data = await apiJson<PlanResponse>(`/api/v1/plans/${id}/duplicate`, { method: 'POST' });
  return data.plan;
}

export async function listPlanAlternatives(
  id: string,
  itemId: string,
): Promise<PlanAlternativeDto[]> {
  const data = await apiJson<PlanAlternativesResponse>(
    `/api/v1/plans/${id}/alternatives?itemId=${encodeURIComponent(itemId)}`,
  );
  return data.alternatives;
}

export async function downloadPlanPdf(id: string): Promise<void> {
  await downloadFile(`/api/v1/plans/${id}/pdf`, `trazo-plan-${id}.pdf`);
}

export async function downloadPlanCsv(id: string): Promise<void> {
  await downloadFile(`/api/v1/plans/${id}/report?format=csv`, `trazo-plan-${id}.csv`);
}
