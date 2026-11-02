# Backend — mapa de implementación y conexión

> **Estado:** Fase 0, backend de Fase 1 y backend de Fase 2 (catálogo) completos. El frontend
> (rebanadas 1.4 y 2.4) y los módulos de intake, generación, edición y publicación todavía no
> existen. Este documento describe lo que **ya está implementado** y el patrón exacto para agregar lo
> que sigue.

Documentos relacionados: [`API.md`](API.md) (contrato REST), [`ARCHITECTURE.md`](ARCHITECTURE.md)
(capas y seguridad), [`DOMAIN.md`](DOMAIN.md) (modelo de datos), [`AI.md`](AI.md) (Gemini y grounding).

---

## 1. Arranque local

Requisitos: Node.js 22+, npm 11+ y una base PostgreSQL (Supabase o local).

```bash
npm install

# El backend lee backend/.env, no el .env de la raíz.
cp .env.example backend/.env
# Edita backend/.env con tus credenciales reales.

npm run db:generate -w backend   # genera el cliente Prisma
npm run db:migrate -w backend    # aplica migraciones con DIRECT_URL
npm run db:seed -w backend       # crea/actualiza el usuario ADMIN
npm run dev -w backend           # API en http://localhost:3000
```

Comprobación rápida:

```bash
curl -i http://localhost:3000/health
curl -i http://localhost:3000/health/ready
```

- `/health` responde `200 { "status": "ok" }` si el proceso está vivo.
- `/health/ready` responde `200 { "status": "ready" }` solo si la base de datos responde; si no,
  `503 { "status": "unavailable" }`.

> **Supabase:** `DATABASE_URL` debe apuntar al pooler (`:6543`, `?pgbouncer=true`) y `DIRECT_URL` a la
> conexión directa (`:5432`). Mezclarlos produce errores de *prepared statements*. El seed y las
> migraciones usan `DIRECT_URL`.

### Variables de entorno

Todas se validan con Zod al arrancar (`backend/src/config/env.ts`). Si falta una requerida, el proceso
no inicia y muestra el campo exacto.

| Variable | Requerida | Valor por defecto | Uso |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development` \| `test` \| `production` |
| `PORT` | no | `3000` | Puerto HTTP |
| `CORS_ORIGINS` | no | `http://localhost:5173` | Allowlist separada por comas |
| `TRUST_PROXY` | no | `false` | `true` solo detrás de proxy de confianza |
| `DATABASE_URL` | sí | — | Pooler de Supabase en runtime |
| `DIRECT_URL` | sí | — | Conexión directa para migraciones/seed |
| `JWT_ACCESS_SECRET` | sí | — | ≥ 32 caracteres; `openssl rand -base64 48` |
| `ACCESS_TOKEN_TTL_SECONDS` | no | `900` | Vida del access token (15 min) |
| `REFRESH_TOKEN_TTL_DAYS` | no | `7` | Vida del refresh token |
| `COOKIE_DOMAIN` | no | vacío | Dominio compartido entre SPA y API |
| `AI_PROVIDER` | no | `mock` | `mock` \| `gemini` |
| `GEMINI_API_KEY` | si `gemini` | — | Nunca en el repo |
| `GEMINI_MODEL` | no | `gemini-2.5-flash` | Modelo de Google |
| `AI_TIMEOUT_MS` | no | `45000` | Timeout del proveedor |
| `LOG_LEVEL` | no | `info` | `fatal`…`silent` |
| `RATE_LIMIT_ENABLED` | no | `true` | Desactivar solo en tests |
| `ADMIN_NAME` | no | `Administrador` | Seed |
| `ADMIN_EMAIL` | si seed | — | Email del admin |
| `ADMIN_PASSWORD` | si seed | — | Mínimo 12 caracteres |

---

## 2. Mapa de carpetas

```text
backend/
  prisma/
    schema.prisma                 # modelo completo del dominio
    migrations/0001_init/         # migración inicial + CHECK constraints
    migrations/0002_catalog_search/ # pg_trgm + índices GIN del catálogo
    seed.ts                       # admin + catálogo de Colombia idempotente
  src/
    domain/
      identity/
        user.ts                   # entidad User + normalización + toPublic()
        ports.ts                  # UserRepository, PasswordHasher, tokens, Clock
      catalog/
        destination.ts            # entidad + validación de slug, coordenadas y tags
        hotel.ts                  # entidad + categoría 1..5 y precio por noche
        activity.ts               # entidad + intensidad, duración y tags
        transport-option.ts       # entidad + pricing_unit compatible con mode
        values.ts                 # normalización y validaciones compartidas
        ports.ts                  # repositorios y criterios de búsqueda
      shared/
        app-error.ts              # errores de dominio → HTTP
    application/
      identity/
        login.use-case.ts
        refresh.use-case.ts
        logout.use-case.ts
        create-user.use-case.ts
        get-me.use-case.ts
        dto.ts
      catalog/
        *-use-case.ts             # list/get/create/update/deactivate por entidad
        presenters.ts             # entidad → DTO compartido
        assert-destination.ts     # destino activo para hoteles/actividades/transporte
    infrastructure/
      persistence/prisma/
        client.ts
        catalog-mappers.ts        # BigInt/Decimal/JSON → tipos seguros
        user.repository.ts
        refresh-token.repository.ts
        destination.repository.ts
        hotel.repository.ts
        activity.repository.ts
        transport-option.repository.ts
      security/
        argon2-password-hasher.ts
        jwt-access-token.service.ts
        random-token.generator.ts
      system-clock.ts
    interfaces/http/
      routes.ts                   # router /api/v1
      auth.controller.ts
      user.controller.ts
      destination.controller.ts
      hotel.controller.ts
      activity.controller.ts
      transport.controller.ts
      cookies.ts                  # cookie HttpOnly del refresh
      middleware/
        auth.ts                   # requireAuth + requireRole
        validate.ts               # validateBody/Query/Params con Zod
        error-handler.ts          # application/problem+json
      rate-limit.ts
    config/
      env.ts                      # validación Zod del entorno
      logger.ts                   # pino + redacción de secretos
      container.ts                # composition root (wiring manual)
    app.ts                        # helmet, CORS, JSON 100kb, health, errores
    server.ts                     # listen + graceful shutdown
  test/
    fakes.ts                      # puertos de identidad en memoria
    catalog-fakes.ts              # repositorios de catálogo en memoria
    user.test.ts
    login.use-case.test.ts
    refresh.use-case.test.ts
    catalog.domain.test.ts        # invariantes del catálogo
    catalog.http.test.ts          # Supertest: lecturas, RBAC y CRUD
    auth.http.test.ts
    test-app.ts
```

### Regla de dependencia

```text
interfaces/http → application → domain
infrastructure  → implementa puertos de domain
config          → composition root (puede importar todo)
```

- `domain/` y `application/` **no** importan Express, Prisma ni el SDK de Gemini.
- Los controllers solo traducen HTTP ↔ caso de uso; no contienen reglas de negocio.
- El wiring es manual y explícito en `backend/src/config/container.ts`.

---

## 3. Ciclo de una petición

```text
request
  → pino-http (requestId)
  → helmet
  → cors (allowlist)
  → express.json({ limit: '100kb' })
  → cookie-parser
  → rate-limit global
  → requireAuth (si aplica)
  → requireRole (si aplica)
  → validateBody / validateQuery / validateParams (Zod)
  → controller
  → use case
  → repository / puerto
  → respuesta JSON
        ↘ AppError / ZodError → errorHandler → application/problem+json
```

---

## 4. Controllers y endpoints implementados

Router montado en `/api/v1` (`backend/src/interfaces/http/routes.ts`).

| Método | Ruta | Auth | Controller | Caso de uso | Estado |
|---|---|---|---|---|---|
| `POST` | `/auth/login` | público (rate limit 5/min/IP) | `AuthController.login` | `LoginUseCase` | ✅ |
| `POST` | `/auth/refresh` | cookie `refresh_token` (30/min/IP) | `AuthController.refresh` | `RefreshUseCase` | ✅ |
| `POST` | `/auth/logout` | cookie `refresh_token` | `AuthController.logout` | `LogoutUseCase` | ✅ |
| `GET` | `/auth/me` | `Bearer` | `AuthController.me` | `GetMeUseCase` | ✅ |
| `POST` | `/users` | `Bearer` + `ADMIN` | `UserController.create` | `CreateUserUseCase` | ✅ |
| `GET` | `/catalog/destinations` | `Bearer` | `DestinationController.list` | `ListDestinationsUseCase` | ✅ |
| `GET` | `/catalog/destinations/:id` | `Bearer` | `DestinationController.get` | `GetDestinationUseCase` | ✅ |
| `POST` | `/catalog/destinations` | `Bearer` + `ADMIN` | `DestinationController.create` | `CreateDestinationUseCase` | ✅ |
| `PATCH` | `/catalog/destinations/:id` | `Bearer` + `ADMIN` | `DestinationController.update` | `UpdateDestinationUseCase` | ✅ |
| `DELETE` | `/catalog/destinations/:id` | `Bearer` + `ADMIN` | `DestinationController.remove` | `DeactivateDestinationUseCase` | ✅ |
| `GET` | `/catalog/hotels` | `Bearer` | `HotelController.list` | `ListHotelsUseCase` | ✅ |
| `POST` | `/catalog/hotels` | `Bearer` + `ADMIN` | `HotelController.create` | `CreateHotelUseCase` | ✅ |
| `PATCH` | `/catalog/hotels/:id` | `Bearer` + `ADMIN` | `HotelController.update` | `UpdateHotelUseCase` | ✅ |
| `DELETE` | `/catalog/hotels/:id` | `Bearer` + `ADMIN` | `HotelController.remove` | `DeactivateHotelUseCase` | ✅ |
| `GET` | `/catalog/activities` | `Bearer` | `ActivityController.list` | `ListActivitiesUseCase` | ✅ |
| `POST` | `/catalog/activities` | `Bearer` + `ADMIN` | `ActivityController.create` | `CreateActivityUseCase` | ✅ |
| `PATCH` | `/catalog/activities/:id` | `Bearer` + `ADMIN` | `ActivityController.update` | `UpdateActivityUseCase` | ✅ |
| `DELETE` | `/catalog/activities/:id` | `Bearer` + `ADMIN` | `ActivityController.remove` | `DeactivateActivityUseCase` | ✅ |
| `GET` | `/catalog/transport` | `Bearer` | `TransportController.list` | `ListTransportOptionsUseCase` | ✅ |
| `POST` | `/catalog/transport` | `Bearer` + `ADMIN` | `TransportController.create` | `CreateTransportOptionUseCase` | ✅ |
| `PATCH` | `/catalog/transport/:id` | `Bearer` + `ADMIN` | `TransportController.update` | `UpdateTransportOptionUseCase` | ✅ |
| `DELETE` | `/catalog/transport/:id` | `Bearer` + `ADMIN` | `TransportController.remove` | `DeactivateTransportOptionUseCase` | ✅ |
| `GET` | `/health` | público | — | — | ✅ |
| `GET` | `/health/ready` | público | — | — | ✅ |
| `PATCH` | `/users/:id` | `ADMIN` | — | — | ⏳ pendiente |

Los endpoints de `trip-requests` y `plans` están especificados en [`API.md`](API.md), pero **aún no
están implementados**. No los consumas todavía.

### 4.1 `POST /api/v1/auth/login`

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "admin@turiviaje.co", "password": "ChangeMe12345!" }
```

```http
200 OK
Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Expires=...

{
  "accessToken": "eyJ...",
  "expiresIn": 900,
  "user": {
    "id": "uuid",
    "name": "Administrador",
    "email": "admin@turiviaje.co",
    "role": "ADMIN",
    "isActive": true,
    "createdAt": "2026-11-02T15:00:00.000Z",
    "lastLoginAt": "2026-11-02T15:00:00.000Z"
  }
}
```

- Email normalizado a minúsculas y sin espacios.
- Mismo error para email inexistente y contraseña incorrecta (`401 UNAUTHENTICATED`).
- El hash de contraseña **nunca** sale en la respuesta.
- El refresh token va **solo** en la cookie; el cuerpo no lo incluye.

### 4.2 `POST /api/v1/auth/refresh`

```http
POST /api/v1/auth/refresh
Cookie: refresh_token=...
```

```http
200 OK
Set-Cookie: refresh_token=<nuevo>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth

{ "accessToken": "eyJ...", "expiresIn": 900 }
```

- Rota el refresh token: el anterior queda revocado y se emite uno nuevo.
- Si se reutiliza un token ya revocado, se revoca **toda la familia** y se responde `401`.
- No requiere `Authorization`; la cookie es la credencial.

### 4.3 `POST /api/v1/auth/logout`

```http
POST /api/v1/auth/logout
Cookie: refresh_token=...
```

```http
204 No Content
Set-Cookie: refresh_token=; ...; Expires=Thu, 01 Jan 1970 00:00:00 GMT
```

- Idempotente: si no hay cookie o ya estaba revocado, también responde `204`.
- El frontend debe limpiar su access token en memoria.

### 4.4 `GET /api/v1/auth/me`

```http
GET /api/v1/auth/me
Authorization: Bearer <accessToken>
```

```http
200 OK
{ "user": { "id": "...", "name": "...", "email": "...", "role": "ADVISOR",
            "isActive": true, "createdAt": "...", "lastLoginAt": null } }
```

- Si el token expiró o es inválido: `401 UNAUTHENTICATED`.
- Si el usuario fue desactivado: `401` (la sesión deja de ser válida).

### 4.5 `POST /api/v1/users` (solo `ADMIN`)

```http
POST /api/v1/users
Authorization: Bearer <accessTokenAdmin>
Content-Type: application/json

{
  "name": "Asesor Nuevo",
  "email": "asesor@agencia.co",
  "password": "password-larga-123",
  "role": "ADVISOR"
}
```

```http
201 Created
{ "user": { "id": "...", "name": "Asesor Nuevo", "email": "asesor@agencia.co",
            "role": "ADVISOR", "isActive": true, "createdAt": "...", "lastLoginAt": null } }
```

- No hay registro público: solo un `ADMIN` crea usuarios.
- `role` por defecto es `ADVISOR`; `password` mínimo 12 caracteres.
- Email duplicado: `409 CONFLICT`.

### 4.6 Catálogo (lectura y administración)

El contrato completo está en [`API.md` §3](API.md#3-catálogo-implementado--fase-2). Resumen:

```http
GET /api/v1/catalog/destinations?featured=true&pageSize=10
Authorization: Bearer <accessToken>
```

```json
{
  "items": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "city": "Cartagena",
      "country": "Colombia",
      "slug": "cartagena",
      "latitude": 10.391049,
      "longitude": -75.479426,
      "tags": ["playa", "historia"],
      "isFeatured": true,
      "fromPrice": { "amountMinor": 52000000, "currency": "COP" }
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 1
}
```

Filtros disponibles:

| Recurso | Query params |
|---|---|
| Destinos | `q`, `country`, `featured`, `page`, `pageSize` |
| Hoteles | `destinationId`, `maxPriceMinor`, `currency`, `page`, `pageSize` |
| Actividades | `destinationId`, `interest`, `intensity`, `page`, `pageSize` |
| Transporte | `originId`, `destinationId`, `mode`, `page`, `pageSize` |

Escritura (solo `ADMIN`): `POST`/`PATCH`/`DELETE` en `/catalog/destinations`, `/catalog/hotels`,
`/catalog/activities` y `/catalog/transport`. Los precios se envían como
`{ "amountMinor": 48000000, "currency": "COP" }`; `DELETE` desactiva (`isActive=false`) y responde
`204`. Los bodies desconocidos se rechazan con `422` y los IDs inexistentes con `404`.

---

## 5. Autenticación desde el frontend

Reglas de oro:

1. El **access token** vive solo en memoria (variable de módulo, Zustand o contexto). Nunca en
   `localStorage` ni en una cookie legible por JavaScript.
2. El **refresh token** vive en una cookie `HttpOnly`, así que el frontend no puede leerlo ni debe
   intentarlo. Solo debe enviar `credentials: 'include'`.
3. Al recargar la página, se llama a `POST /auth/refresh` para restaurar la sesión.
4. Si una petición devuelve `401`, se intenta **un** refresh y se reintenta una vez. Varias peticiones
   simultáneas deben compartir la misma promesa de refresh (*single-flight*).
5. `POST /auth/login`, `/auth/refresh` y `/auth/logout` necesitan `credentials: 'include'`; el resto
   necesita `Authorization: Bearer <accessToken>`.
6. El origen del SPA debe estar exactamente en `CORS_ORIGINS`; con cookies no se puede usar `*`.

Cliente mínimo de referencia para el compañero:

```ts
// frontend/src/shared/api/client.ts
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_URL}/api/v1/auth/refresh`, {
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

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && allowRetry && (await refreshSession())) {
    return apiFetch(path, init, false);
  }
  return response;
}

export async function login(email: string, password: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw await response.json();
  const data = (await response.json()) as { accessToken: string };
  accessToken = data.accessToken;
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/api/v1/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  accessToken = null;
}
```

> El cliente de arriba es una referencia. Si el frontend usa TanStack Query, el refresh silencioso
> puede ir en el `queryFn` global o en un interceptor; lo importante es no duplicar refresh
> concurrentes y no persistir el access token.

### 5.1 Consumo del catálogo

El catálogo se consume con el mismo `apiFetch` (Bearer + refresh silencioso). Ejemplo para el
carrusel y los pines del mapa:

```ts
// frontend/src/features/catalog/api.ts
import type { DestinationDto, Paginated } from '@turiviaje/shared';
import { apiFetch } from '../../shared/api/client';

export async function fetchFeaturedDestinations(): Promise<Paginated<DestinationDto>> {
  const response = await apiFetch(
    '/api/v1/catalog/destinations?featured=true&pageSize=10',
  );
  if (!response.ok) throw await response.json();
  return (await response.json()) as Paginated<DestinationDto>;
}

export async function fetchDestinations(query: string): Promise<Paginated<DestinationDto>> {
  const params = new URLSearchParams({ q: query, page: '1', pageSize: '20' });
  const response = await apiFetch(`/api/v1/catalog/destinations?${params}`);
  if (!response.ok) throw await response.json();
  return (await response.json()) as Paginated<DestinationDto>;
}
```

- Usa TanStack Query con claves estables, por ejemplo `['catalog', 'destinations', { q, featured }]`,
  y `staleTime` de 5–10 minutos: el catálogo cambia poco.
- `fromPrice` es `Money | null`; si es `null`, el pin muestra solo el nombre. No calcules precios en
  el cliente.
- Para el detalle: `GET /catalog/destinations/:id` → `{ destination }`.
- Para hoteles/actividades/transporte usa `destinationId` y los filtros documentados en
  [`API.md` §3](API.md#3-catálogo-implementado--fase-2).
- Las pantallas de administración deben ocultarse para `ADVISOR`; la API igual responde `403`.
- No guardes respuestas del catálogo en `localStorage`; TanStack Query es la caché.

### Códigos que debe manejar el frontend

| HTTP | `code` | Acción |
|---|---|---|
| `401` | `UNAUTHENTICATED` | Intentar refresh; si falla, ir a `/login` |
| `403` | `FORBIDDEN` | Mostrar "sin permisos"; no reintentar |
| `404` | `NOT_FOUND` | Recurso inexistente o ajeno |
| `409` | `CONFLICT` | Estado incompatible (p. ej. email duplicado) |
| `422` | `VALIDATION_ERROR` | Mostrar `errors[].field` junto al campo |
| `429` | `RATE_LIMITED` | Respetar `Retry-After` |
| `5xx` | `INTERNAL_ERROR` | Mensaje genérico + `requestId` para soporte |

---

## 6. Formato de error

Todos los errores usan `application/problem+json`:

```json
{
  "type": "https://api.turiviaje.co/problems/validation_error",
  "title": "Datos inválidos",
  "status": 422,
  "code": "VALIDATION_ERROR",
  "detail": "Revisa los campos enviados",
  "requestId": "0f5e...",
  "errors": [
    { "field": "email", "message": "Email inválido" },
    { "field": "password", "message": "La contraseña debe tener al menos 12 caracteres" }
  ]
}
```

- `requestId` también viaja en la cabecera `x-request-id`; úsalo para reportar fallos.
- Nunca se exponen stack traces, SQL ni detalles del proveedor de IA.
- Los logs de pino redactan `authorization`, `cookie`, `password` y `apiKey`.

---

## 7. RBAC y ownership

| Recurso | `ADVISOR` | `ADMIN` |
|---|---|---|
| `GET /auth/me` | propio | propio |
| `POST /users` | ❌ `403` | ✅ |
| Catálogo (lectura) | ✅ | ✅ |
| Catálogo (escritura) | ❌ `403` | ✅ |
| `trip-requests` propias (futuro) | CRUD | CRUD |
| `trip-requests` ajenas (futuro) | ❌ `404` | ✅ |
| `plans` propios (futuro) | CRUD + publicar | CRUD + publicar |
| `plans` ajenos (futuro) | ❌ `404` | ✅ |

- El `advisorId` **nunca** se toma del body: sale de `req.auth.userId` (JWT verificado).
- Un recurso ajeno responde `404`, no `403`, para no revelar su existencia.
- El ownership se valida en el caso de uso, no en el controller.

---

## 8. Cómo agregar el siguiente módulo

Patrón obligatorio (una rebanada vertical por vez):

1. **Dominio** (`backend/src/domain/<modulo>/`): entidad/value object, invariantes, puerto
   (`Repository`, `Service`) y errores. Sin Prisma ni Express.
2. **Caso de uso** (`backend/src/application/<modulo>/`): recibe puertos por constructor, valida
   ownership, orquesta y devuelve un DTO. Sin HTTP.
3. **Adaptador** (`backend/src/infrastructure/`): implementa el puerto (Prisma, Gemini, etc.) y mapea
   fila → entidad.
4. **Contrato compartido** (`packages/shared/src/`): esquema Zod de request/response y tipos. Es la
   fuente única para frontend y backend.
5. **Controller** (`backend/src/interfaces/http/<modulo>.controller.ts`): traduce HTTP ↔ caso de uso.
6. **Ruta** (`routes.ts`): `validateBody`, `requireAuth`, `requireRole`, rate limit si aplica.
7. **Wiring** (`config/container.ts`): construye repositorio → caso de uso → controller.
8. **Tests**: dominio/caso de uso con fakes; HTTP con Supertest; adaptador con fixtures.
9. **Docs**: actualizar `docs/API.md` y, si cambia el modelo, `docs/DOMAIN.md`.

Esqueleto de un caso de uso:

```ts
// backend/src/application/catalog/list-destinations.use-case.ts
import type { DestinationRepository } from '../../domain/catalog/ports.js';

export class ListDestinationsUseCase {
  constructor(private readonly destinations: DestinationRepository) {}

  async execute(input: { query?: string; page: number; pageSize: number }) {
    return this.destinations.search(input);
  }
}
```

Esqueleto de ruta:

```ts
router.get(
  '/catalog/destinations',
  auth,
  validateQuery(listDestinationsQuerySchema),
  catalogController.listDestinations,
);
```

> `validateQuery` y `validateParams` ya existen. Escriben en `req.validatedQuery` y
> `req.validatedParams` (no en `req.query`, que en Express 5 es de solo lectura). En el controller
> castea el resultado al tipo inferido del esquema compartido.

---

## 9. Pruebas y verificación

```bash
npm run verify                 # lint → typecheck → test → build
npm run test -w @turiviaje/backend
npm run test -w @turiviaje/backend -- test/auth.http.test.ts
npm run test -w @turiviaje/backend -- -t "rotates"
npm run lint
npm run typecheck
npm run build
```

Estado actual: **47 tests de backend + 6 de `packages/shared`**, sin base de datos ni red (fakes).
Los tests HTTP usan Supertest contra la app real con repositorios en memoria. El catálogo añade
`catalog.domain.test.ts` (invariantes) y `catalog.http.test.ts` (lecturas, filtros, RBAC y CRUD).

Los tests de integración contra Postgres siguen pendientes de credenciales reales. El patrón será
limpiar por transacción o truncado, nunca compartir estado entre tests.

---

## 10. Estado y pendientes

| Elemento | Estado |
|---|---|
| Scaffold, env, logger, errores, health | ✅ |
| Prisma schema + migraciones `0001_init` y `0002_catalog_search` | ✅ (generadas, **no aplicadas** sin credenciales) |
| Seed de admin + catálogo de Colombia | ✅ (código listo, **no ejecutado** sin credenciales) |
| Login, refresh rotativo, logout, `/auth/me` | ✅ |
| RBAC `ADMIN` + `POST /users` | ✅ |
| Catálogo backend: destinos, hoteles, actividades y transporte | ✅ (lectura + CRUD `ADMIN`, soft delete) |
| Frontend `/login`, guard, refresh silencioso | ⏳ Fase 1.4 |
| Frontend del catálogo (selector de destino) | ⏳ Fase 2.4 |
| Intake conversacional | ⏳ Fase 3 |
| Gemini + generación | ⏳ Fase 4 (ver [`AI.md`](AI.md)) |

Antes de conectar el frontend, confirma con el equipo:

1. `CORS_ORIGINS` contiene el origen exacto del SPA (`http://localhost:5173` en desarrollo).
2. `DATABASE_URL` y `DIRECT_URL` son las de Supabase (pooler y directa, respectivamente).
3. La migración y el seed ya corrieron.
4. El admin de prueba existe y puede hacer login.
5. El frontend usa `credentials: 'include'` y guarda el access token solo en memoria.
