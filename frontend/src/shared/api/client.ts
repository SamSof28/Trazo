import type {
  AuthSessionResponse,
  CreateTripRequestInput,
  AnswerTripRequestPayload,
  TripRequestResponse,
  ProblemDetails,
  PublicUser,
  DestinationDto,
  Paginated,
  PlanResponse,
  PlanAlternativesResponse,
  RegisterInput,
  UpdatePlanInput,
  ReplacePlanItemInput,
} from '@trazo/shared';

const API_BASE_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3000' : '')
).replace(/\/+$/, '');

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem?: ProblemDetails,
  ) {
    super(problem?.detail ?? problem?.title ?? `HTTP ${status}`);
    this.name = 'ApiError';
  }
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) {
          accessToken = null;
          return false;
        }
        const data = (await response.json()) as { accessToken: string };
        accessToken = data.accessToken;
        return true;
      })
      .catch(() => {
        accessToken = null;
        return false;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  allowRetry = true,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && allowRetry && (await refreshSession())) {
    return apiFetch(path, init, false);
  }

  return response;
}

export async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let problem: ProblemDetails | undefined;
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      // not JSON
    }
    throw new ApiError(response.status, problem);
  }
  if (response.status === 204) {
    return undefined as unknown as T;
  }
  return (await response.json()) as T;
}

/** Fetch JSON with the in-memory access token and a single silent refresh. */
export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  return parseResponse<T>(response);
}

/** Downloads an authenticated binary response (PDF, CSV) through the API. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await apiFetch(path);
  if (!response.ok) {
    let problem: ProblemDetails | undefined;
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      // not JSON
    }
    throw new ApiError(response.status, problem);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/** Turns an unknown thrown value into a short, user-facing message. */
export function errorMessage(
  error: unknown,
  fallback = 'Algo no salió como esperábamos. Inténtalo de nuevo.',
): string {
  if (error instanceof ApiError) {
    const firstField = error.problem?.errors?.[0]?.message;
    if (firstField) return firstField;
    if (error.problem?.detail) return error.problem.detail;
    if (error.status === 403) return 'No tienes permisos para esta acción.';
    if (error.status === 404) return 'No encontramos ese recurso.';
    if (error.status === 409) return 'El plan cambió de estado. Recarga e inténtalo otra vez.';
    if (error.status === 429) return 'Demasiadas solicitudes. Espera un momento.';
    if (error.status >= 500) return 'El servidor no respondió. Inténtalo de nuevo en un momento.';
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function loginRequest(email: string, password: string): Promise<AuthSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await parseResponse<AuthSessionResponse>(response);
  accessToken = data.accessToken;
  return data;
}

export async function registerRequest(payload: RegisterInput): Promise<AuthSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await parseResponse<AuthSessionResponse>(response);
  accessToken = data.accessToken;
  return data;
}

export async function logoutRequest(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } finally {
    accessToken = null;
  }
}

export async function fetchCurrentUser(): Promise<PublicUser> {
  const res = await apiFetch('/api/v1/auth/me');
  const data = await parseResponse<{ user: PublicUser }>(res);
  return data.user;
}

// Intake API
export async function createTripRequest(payload: CreateTripRequestInput): Promise<TripRequestResponse> {
  const res = await apiFetch('/api/v1/trip-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return parseResponse<TripRequestResponse>(res);
}

export async function getTripRequest(id: string): Promise<TripRequestResponse> {
  const res = await apiFetch(`/api/v1/trip-requests/${encodeURIComponent(id)}`);
  return parseResponse<TripRequestResponse>(res);
}

export async function answerTripRequest(
  id: string,
  payload: AnswerTripRequestPayload,
): Promise<TripRequestResponse> {
  const res = await apiFetch(`/api/v1/trip-requests/${encodeURIComponent(id)}/answers`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return parseResponse<TripRequestResponse>(res);
}

export async function generateTripPlan(
  id: string,
): Promise<{ tripRequestId: string; jobId: string; status: string; pollAfterMs: number }> {
  const res = await apiFetch(`/api/v1/trip-requests/${encodeURIComponent(id)}/generate`, {
    method: 'POST',
  });
  return parseResponse(res);
}

// Catalog API
export async function fetchFeaturedDestinations(): Promise<DestinationDto[]> {
  const res = await apiFetch('/api/v1/catalog/destinations?featured=true&pageSize=6');
  const data = await parseResponse<Paginated<DestinationDto>>(res);
  return data.items;
}

// Planning API
export async function getPlan(id: string): Promise<PlanResponse> {
  const res = await apiFetch(`/api/v1/plans/${encodeURIComponent(id)}`);
  return parseResponse<PlanResponse>(res);
}

export async function updatePlan(id: string, payload: UpdatePlanInput): Promise<PlanResponse> {
  const res = await apiFetch(`/api/v1/plans/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return parseResponse<PlanResponse>(res);
}

export async function getPlanAlternatives(planId: string, itemId: string): Promise<PlanAlternativesResponse> {
  const res = await apiFetch(
    `/api/v1/plans/${encodeURIComponent(planId)}/alternatives?itemId=${encodeURIComponent(itemId)}`,
  );
  return parseResponse<PlanAlternativesResponse>(res);
}

export async function replacePlanItem(
  planId: string,
  itemId: string,
  payload: ReplacePlanItemInput,
): Promise<PlanResponse> {
  const res = await apiFetch(
    `/api/v1/plans/${encodeURIComponent(planId)}/items/${encodeURIComponent(itemId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return parseResponse<PlanResponse>(res);
}

export async function deletePlanItem(planId: string, itemId: string): Promise<PlanResponse> {
  const res = await apiFetch(
    `/api/v1/plans/${encodeURIComponent(planId)}/items/${encodeURIComponent(itemId)}`,
    {
      method: 'DELETE',
    },
  );
  return parseResponse<PlanResponse>(res);
}

export async function savePlan(id: string): Promise<PlanResponse> {
  const res = await apiFetch(`/api/v1/plans/${encodeURIComponent(id)}/save`, {
    method: 'POST',
  });
  return parseResponse<PlanResponse>(res);
}

export async function publishPlan(id: string): Promise<PlanResponse> {
  const res = await apiFetch(`/api/v1/plans/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
  });
  return parseResponse<PlanResponse>(res);
}

export async function downloadPlanPdf(id: string): Promise<Blob> {
  const res = await apiFetch(`/api/v1/plans/${encodeURIComponent(id)}/pdf`);
  if (!res.ok) {
    throw new ApiError(res.status);
  }
  return res.blob();
}
