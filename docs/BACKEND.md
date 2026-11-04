# Backend — mapa de implementación y conexión

> **Estado:** Fase 0 y los backends de Fase 1 (identidad), Fase 2 (catálogo) y Fase 3 (intake
> conversacional) están completos. El frontend (rebanadas 1.4, 2.4 y 3.3–3.4) y los módulos de
> generación, edición y publicación todavía no existen. Este documento describe lo que **ya está
> implementado** y el patrón exacto para agregar lo que sigue.

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
npm run db:deploy -w backend     # aplica migraciones con DIRECT_URL (Supabase)
npm run db:seed -w backend       # crea/actualiza el ADMIN y el catálogo
npm run dev -w backend           # API en http://localhost:3000
```

> En desarrollo local con una base vacía puedes usar `npm run db:migrate -w backend`; ese comando
> crea una *shadow database* y no es el adecuado para Supabase. Para Supabase usa siempre
> `db:deploy`.

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

### 1.1 Configurar Supabase paso a paso

1. **Crear el proyecto.** En [supabase.com/dashboard](https://supabase.com/dashboard) → *New project*.
   Elige organización, nombre, región (la más cercana a los usuarios; p. ej. `us-east-1` o
   `sa-east-1`) y una contraseña de base de datos fuerte. Guárdala: la necesitarás en las URLs.
2. **Obtener las cadenas de conexión.** *Project Settings* → *Database* → *Connection string* →
   pestaña **URI**. Supabase ofrece varias; usa dos:
   - **Transaction pooler** (runtime): host `aws-0-<region>.pooler.supabase.com`, puerto `6543`.
     Añade `?pgbouncer=true` (y `&schema=public` si lo necesitas). Es la que va en `DATABASE_URL`.
   - **Direct connection** (migraciones/seed): host `db.<ref>.supabase.co`, puerto `5432`. Es la que
     va en `DIRECT_URL`.
   - Si tu red no tiene IPv6 y la conexión directa no responde, usa el **Session pooler** (mismo host
     `pooler.supabase.com`, puerto `5432`) como `DIRECT_URL`; sirve para migraciones y no necesita
     `pgbouncer=true`.
3. **Codificar la contraseña.** Si contiene `@`, `#`, `/`, `:` o `%`, reemplázala por su valor
   percent-encoded (`@` → `%40`, `#` → `%23`, `/` → `%2F`). Una contraseña sin codificar es la causa
   más común de `P1001`/`P1010`.
4. **Editar `backend/.env`.**

   ```dotenv
   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
   JWT_ACCESS_SECRET="<openssl rand -base64 48>"
   ADMIN_EMAIL="admin@turiviaje.co"
   ADMIN_PASSWORD="<mínimo 12 caracteres>"
   ```

   `JWT_ACCESS_SECRET` es obligatorio (≥ 32 caracteres); genéralo con
   `openssl rand -base64 48`. No commitees `backend/.env`.
5. **Generar el cliente y aplicar migraciones.**

   ```bash
   npm run db:generate -w backend
   npm run db:deploy -w backend
   ```

   `db:deploy` ejecuta `prisma migrate deploy` contra `DIRECT_URL` y aplica, en orden,
   `0001_init`, `0002_catalog_search` y `0003_trip_request_adults_nullable`. No uses
   `db:migrate` contra Supabase: crea una *shadow database* y falla en planes gratuitos.
6. **Sembrar admin y catálogo.**

   ```bash
   npm run db:seed -w backend
   ```

   El seed es idempotente: crea/actualiza el `ADMIN` con `ADMIN_EMAIL`/`ADMIN_PASSWORD` y carga los
   destinos, hoteles, actividades y transporte de Colombia. Se conecta con `DIRECT_URL`.
7. **Verificar.**

   ```bash
   npm run dev -w backend
   curl -i http://localhost:3000/health/ready
   ```

   Debe responder `200 { "status": "ready" }`. En Supabase, *Table Editor* debe mostrar `users`,
   `destinations`, `hotels`, `activities`, `transport_options` y `trip_requests`; en *SQL Editor*,
   `select count(*) from destinations;` debe devolver al menos 5.
8. **Probar el login.** Usa el `ADMIN_EMAIL`/`ADMIN_PASSWORD` del seed contra
   `POST /api/v1/auth/login`. Si responde `401`, revisa que el seed haya corrido y que el hash esté
   en `users.password_hash`.

**Solución de problemas frecuentes**

| Síntoma | Causa probable | Acción |
|---|---|---|
| `P1001: Can't reach database server` | IPv6, región incorrecta o URL mal formada | Usa *Session pooler* en `DIRECT_URL`, verifica host/puerto y codifica la contraseña |
| `prepared statement "s0" already exists` | Runtime usando conexión directa o pooler sin `pgbouncer=true` | `DATABASE_URL` en `:6543` + `?pgbouncer=true` |
| `P3005: database schema is not empty` | `migrate dev` sobre una base con tablas | Usa `db:deploy`; no borres tablas en una base compartida |
| `P1010: User was denied access` | Contraseña incorrecta o sin percent-encoding | Restablece la contraseña en Supabase y codifícala |
| `db:seed` falla por `ADMIN_PASSWORD` | Falta la variable o tiene < 12 caracteres | Configúrala en `backend/.env` |
| Migración lenta o timeout | Pooler en modo transaction para DDL | Usa la conexión directa o el *Session pooler* en `DIRECT_URL` |

> **Seguridad:** el backend se conecta como el usuario `postgres` del proyecto; no se usa
> `service_role` en el frontend ni se exponen las URLs de base de datos al SPA. RLS no se usa porque
> toda la autorización vive en los casos de uso (JWT + ownership).

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
    migrations/0003_trip_request_adults_nullable/ # adults nullable + CHECK de intake
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
      intake/
        trip-request.ts           # agregado TripRequest, slots, missingFields y transiciones
        ports.ts                  # TripRequestRepository y criterios de búsqueda
      shared/
        app-error.ts              # errores de dominio → HTTP
        clock.ts                  # puerto Clock
        money.ts                  # validación de enteros en unidades menores
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
      intake/
        create-trip-request.use-case.ts
        get-trip-request.use-case.ts
        list-trip-requests.use-case.ts
        answer-trip-request.use-case.ts
        prompt-parser.ts          # extracción determinista de slots (sin IA)
        questions.ts              # máx. 2 preguntas/turno + chips del catálogo
        catalog-context.ts        # carga todos los destinos activos
        ownership.ts              # ADVISOR solo ve lo suyo; ADMIN ve todo
        presenter.ts              # TripRequest → DTO compartido
        views.ts
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
        trip-request.repository.ts
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
      trip-request.controller.ts
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
    intake-fakes.ts               # repositorio de trip requests en memoria
    user.test.ts
    login.use-case.test.ts
    refresh.use-case.test.ts
    catalog.domain.test.ts        # invariantes del catálogo
    catalog.http.test.ts          # Supertest: lecturas, RBAC y CRUD
    intake.domain.test.ts         # invariantes y transiciones de TripRequest
    prompt-parser.test.ts         # extracción determinista de slots y respuestas
    intake.http.test.ts           # Supertest: create/get/list/answers + ownership
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
| `GET` | `/trip-requests` | `Bearer` | `TripRequestController.list` | `ListTripRequestsUseCase` | ✅ |
| `POST` | `/trip-requests` | `Bearer` (20/h/usuario) | `TripRequestController.create` | `CreateTripRequestUseCase` | ✅ |
| `GET` | `/trip-requests/:id` | `Bearer` | `TripRequestController.get` | `GetTripRequestUseCase` | ✅ |
| `POST` | `/trip-requests/:id/answers` | `Bearer` | `TripRequestController.answer` | `AnswerTripRequestUseCase` | ✅ |
| `GET` | `/health` | público | — | — | ✅ |
| `GET` | `/health/ready` | público | — | — | ✅ |
| `PATCH` | `/users/:id` | `ADMIN` | — | — | ⏳ pendiente |

Los endpoints de `plans` y `POST /trip-requests/:id/generate` están especificados en
[`API.md`](API.md), pero corresponden a la Fase 4 y **aún no están implementados**. No los consumas
todavía.

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

### 4.7 Intake conversacional (`/trip-requests`)

Contrato completo en [`API.md` §4](API.md#4-solicitud-de-viaje-implementado--fase-3). El flujo es:

```http
POST /api/v1/trip-requests
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "prompt": "Quiero un viaje a Cartagena en diciembre" }
```

```http
201 Created
{
  "tripRequest": {
    "id": "9f1c...",
    "status": "AWAITING_INPUT",
    "slots": {
      "destination": { "id": "...", "city": "Cartagena", "country": "Colombia" },
      "durationDays": null,
      "adults": null,
      "children": 0,
      "interests": [],
      "budgetMin": null,
      "budgetMax": null,
      "currency": "COP"
    },
    "missingFields": ["duration", "travelers", "budget"],
    "questions": [
      { "field": "duration", "prompt": "¿Cuántos días y en qué fechas?", "chips": ["Fin de semana", "5 días", "10 días"] },
      { "field": "travelers", "prompt": "¿Quiénes viajan?", "chips": ["Solo", "Pareja", "Familia con 2 niños", "4 amigos"] }
    ]
  }
}
```

El cliente responde solo las preguntas del turno:

```http
POST /api/v1/trip-requests/9f1c.../answers
{ "answers": [
  { "field": "duration", "value": "5 días" },
  { "field": "travelers", "value": "Pareja" }
] }
```

- El parser es determinista y vive en `application/intake/prompt-parser.ts`; **no llama a Gemini**.
- Los chips de destino se calculan con los destinos activos; "Sorpréndenos" resuelve al primero
  destacado.
- Un destino fuera del catálogo (p. ej. "París") responde `422` con `errors[].field = "destination"`.
- `GET /trip-requests/:id` devuelve el estado actual; `GET /trip-requests?status=READY` lista.
- `POST /trip-requests` tiene rate limit de 20/h/usuario.
- `POST /trip-requests/:id/generate` **todavía no existe**: es la Fase 4.

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

### 5.2 Consumo del intake

El flujo del chat usa los DTOs compartidos `TripRequestDto`, `TripRequestResponse` y
`TripRequestAnswer`. No reimplementes el parser ni calcules `missingFields` en el cliente: el
servidor devuelve `status`, `slots`, `missingFields` y las `questions` del turno.

```ts
// frontend/src/features/workspace/api.ts
import type {
  TripRequestAnswer,
  TripRequestDto,
  TripRequestResponse,
} from '@turiviaje/shared';
import { apiFetch } from '../../shared/api/client';

export async function createTripRequest(prompt: string): Promise<TripRequestDto> {
  const response = await apiFetch('/api/v1/trip-requests', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) throw await response.json();
  const data = (await response.json()) as TripRequestResponse;
  return data.tripRequest;
}

export async function answerTripRequest(
  id: string,
  answers: TripRequestAnswer[],
): Promise<TripRequestDto> {
  const response = await apiFetch(`/api/v1/trip-requests/${id}/answers`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
  if (!response.ok) throw await response.json();
  const data = (await response.json()) as TripRequestResponse;
  return data.tripRequest;
}
```

- Renderiza `questions` tal cual llegan; máximo 2 por turno. Los chips son sugerencias, pero el
  usuario puede escribir texto libre.
- Si `status === 'READY'` y `questions` está vacío, habilita "Generar plan" (cuando exista la Fase 4).
- Un `422` de destino trae `errors[0].field === 'destination'`; muéstralo como error del chip/entrada.
- Guarda el historial de mensajes en Zustand, pero el estado de verdad (`status`, `slots`,
  `missingFields`) siempre viene del servidor.
- No inventes un plan ni precargues precios: la generación es la Fase 4 y aún no existe.

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
| `trip-requests` propias | CRUD | CRUD |
| `trip-requests` ajenas | ❌ `404` | ✅ |
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

Estado actual: **88 tests de backend + 6 de `packages/shared`**, sin base de datos ni red (fakes).
Los tests HTTP usan Supertest contra la app real con repositorios en memoria. El catálogo añade
`catalog.domain.test.ts` (invariantes) y `catalog.http.test.ts` (lecturas, filtros, RBAC y CRUD). El
intake añade `intake.domain.test.ts` (agregado y transiciones), `prompt-parser.test.ts` (extracción
determinista con ≥ 10 prompts reales) e `intake.http.test.ts` (create/get/list/answers, ownership y
validación).

Los tests de integración contra Postgres siguen pendientes de credenciales reales. El patrón será
limpiar por transacción o truncado, nunca compartir estado entre tests.

---

## 10. Estado y pendientes

| Elemento | Estado |
|---|---|
| Scaffold, env, logger, errores, health | ✅ |
| Prisma schema + migraciones `0001_init`, `0002_catalog_search` y `0003_trip_request_adults_nullable` | ✅ (generadas, **no aplicadas** sin credenciales) |
| Seed de admin + catálogo de Colombia | ✅ (código listo, **no ejecutado** sin credenciales) |
| Login, refresh rotativo, logout, `/auth/me` | ✅ |
| RBAC `ADMIN` + `POST /users` | ✅ |
| Catálogo backend: destinos, hoteles, actividades y transporte | ✅ (lectura + CRUD `ADMIN`, soft delete) |
| Intake backend: `TripRequest`, parser determinista, preguntas y respuestas | ✅ (Fase 3.1–3.2) |
| Frontend `/login`, guard, refresh silencioso | ⏳ Fase 1.4 |
| Frontend del catálogo (selector de destino) | ⏳ Fase 2.4 |
| Disponibilidad de catálogo (modelo + explorador) | ⏳ Fase 2.5 |
| Frontend del intake (landing + chat) | ⏳ Fases 3.3–3.4 |
| Gemini + generación | ⏳ Fase 4 (ver [`AI.md`](AI.md)) |

Antes de conectar el frontend, confirma con el equipo:

1. `CORS_ORIGINS` contiene el origen exacto del SPA (`http://localhost:5173` en desarrollo).
2. `DATABASE_URL` y `DIRECT_URL` son las de Supabase (pooler y directa, respectivamente).
3. La migración y el seed ya corrieron.
4. El admin de prueba existe y puede hacer login.
5. El frontend usa `credentials: 'include'` y guarda el access token solo en memoria.
