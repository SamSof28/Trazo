# Contrato de API — Trazo v1

Base: `/api/v1`. JSON UTF-8. Autenticación `Authorization: Bearer <accessToken>` salvo donde se indique.
Este documento es el contrato que consumen el frontend y los tests; cambia junto con el código.

> **Estado:** las secciones 2 (auth e identidad), 3 (catálogo), 4 (solicitud de viaje y generación),
> 5 (planes, edición, ciclo de vida, reportes y PDF) y 6 (mapa y sugerencias) están implementadas en
> backend. El frontend y la disponibilidad de catálogo (HU 3.3–3.4) siguen pendientes. El mapa real de
> controllers y el ejemplo de cliente HTTP están en [`BACKEND.md`](BACKEND.md).

## 1. Convenciones

- **Fechas:** `YYYY-MM-DD` para días; ISO-8601 UTC (`2026-11-03T14:05:00Z`) para instantes.
- **Dinero:** `{ "amountMinor": 59909900, "currency": "COP" }`. Nunca strings formateados ni floats.
- **IDs:** UUID v4 en string.
- **Paginación:** `?page=1&pageSize=20` (máx. 100) → `{ "items": [], "page": 1, "pageSize": 20, "total": 0 }`.
- **Errores:** `application/problem+json` con `type`, `title`, `status`, `code`, `detail`, `requestId`,
  `errors[]` (solo validación). Códigos en [`ARCHITECTURE.md`](ARCHITECTURE.md#modelo-de-errores).
- **Idempotencia:** `save` y `archive` son idempotentes por estado. `publish` y `generate` no aceptan
  `Idempotency-Key`; `generate` solo se reintenta cuando la solicitud quedó `FAILED`.
- **Campos desconocidos:** rechazados (Zod `.strict()`) → `422 VALIDATION_ERROR`.

## 2. Auth e identidad (implementado)

| Método | Ruta | Auth | Descripción | Estado |
|---|---|---|---|---|
| POST | `/auth/login` | público, 5/min/IP | Email + password → access token + cookie refresh | ✅ |
| POST | `/auth/refresh` | cookie `refresh_token`, 30/min/IP | Rota refresh y devuelve nuevo access | ✅ |
| POST | `/auth/logout` | cookie `refresh_token` | Revoca refresh actual; idempotente | ✅ |
| GET | `/auth/me` | Bearer | Usuario y rol actuales | ✅ |
| POST | `/users` | Bearer + `ADMIN` | Crea asesor (`ADVISOR`) | ✅ |
| PATCH | `/users/:id` | Bearer + `ADMIN` | Activa/desactiva o cambia rol | ⏳ pendiente |

`PublicUser` (nunca incluye `passwordHash`):

```json
{
  "id": "uuid",
  "name": "Asesor Demo",
  "email": "asesor@agencia.co",
  "role": "ADVISOR",
  "isActive": true,
  "createdAt": "2026-11-02T15:00:00.000Z",
  "lastLoginAt": "2026-11-02T15:00:00.000Z"
}
```

### 2.1 Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "asesor@agencia.co", "password": "..." }
```

```http
200 OK
Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Expires=...

{ "accessToken": "...", "expiresIn": 900, "user": { ...PublicUser } }
```

- El email se normaliza (trim + minúsculas).
- `401 UNAUTHENTICATED` para email inexistente o contraseña incorrecta (mismo mensaje).
- `422 VALIDATION_ERROR` si el body no cumple el esquema.
- `429 RATE_LIMITED` a partir de 5 intentos/min/IP.
- El refresh token **no** viaja en el body.

### 2.2 Refresh

```http
POST /api/v1/auth/refresh
Cookie: refresh_token=...
```

```http
200 OK
Set-Cookie: refresh_token=<nuevo>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth

{ "accessToken": "...", "expiresIn": 900 }
```

- Rotación obligatoria: el token anterior queda revocado.
- Reuso de un token revocado → `401` y revocación de toda la familia.
- Token ausente, expirado o desconocido → `401 UNAUTHENTICATED`.
- No requiere `Authorization`; la cookie es la credencial.

### 2.3 Logout

```http
POST /api/v1/auth/logout
Cookie: refresh_token=...
```

```http
204 No Content
Set-Cookie: refresh_token=; ...; Expires=Thu, 01 Jan 1970 00:00:00 GMT
```

Idempotente: sin cookie o con token ya revocado también responde `204`.

### 2.4 Me

```http
GET /api/v1/auth/me
Authorization: Bearer <accessToken>
```

```http
200 OK
{ "user": { ...PublicUser } }
```

`401` si el token falta, expiró, es inválido o el usuario fue desactivado.

### 2.5 Crear usuario (ADMIN)

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
{ "user": { ...PublicUser } }
```

- `password` mínimo 12 caracteres; `role` por defecto `ADVISOR`.
- `ADVISOR` → `403 FORBIDDEN`; email duplicado → `409 CONFLICT`.
- No hay registro público: solo un `ADMIN` crea usuarios.

### 2.6 Cookie de refresh

| Atributo | Valor |
|---|---|
| Nombre | `refresh_token` |
| `HttpOnly` | siempre |
| `Secure` | sí en producción; no en desarrollo local |
| `SameSite` | `Strict` |
| `Path` | `/api/v1/auth` |
| Vigencia | `REFRESH_TOKEN_TTL_DAYS` (7 por defecto) |

El frontend debe usar `credentials: 'include'` y no puede leer la cookie.

## 3. Catálogo (implementado — Fase 2)

Lectura autenticada para `ADVISOR` y `ADMIN`; escritura solo `ADMIN`. Los precios siempre viajan como
`Money` (`{ amountMinor, currency }`) y los filtros de precio usan unidades menores.

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/catalog/destinations?q=&country=&featured=&page=&pageSize=` | autenticado | Destinos activos, ordenados por destacados y ciudad |
| GET | `/catalog/destinations/:id` | autenticado | Ficha de un destino activo |
| GET | `/catalog/hotels?destinationId=&maxPriceMinor=&currency=&page=&pageSize=` | autenticado | Hoteles activos, ordenados por precio |
| GET | `/catalog/activities?destinationId=&interest=&intensity=&page=&pageSize=` | autenticado | Actividades activas |
| GET | `/catalog/transport?originId=&destinationId=&mode=&page=&pageSize=` | autenticado | Opciones de transporte activas |
| POST | `/catalog/destinations` | `ADMIN` | Crea destino |
| PATCH | `/catalog/destinations/:id` | `ADMIN` | Actualiza campos del destino |
| DELETE | `/catalog/destinations/:id` | `ADMIN` | Desactiva (soft delete) |
| POST | `/catalog/hotels` | `ADMIN` | Crea hotel |
| PATCH | `/catalog/hotels/:id` | `ADMIN` | Actualiza hotel |
| DELETE | `/catalog/hotels/:id` | `ADMIN` | Desactiva hotel |
| POST | `/catalog/activities` | `ADMIN` | Crea actividad |
| PATCH | `/catalog/activities/:id` | `ADMIN` | Actualiza actividad |
| DELETE | `/catalog/activities/:id` | `ADMIN` | Desactiva actividad |
| POST | `/catalog/transport` | `ADMIN` | Crea opción de transporte |
| PATCH | `/catalog/transport/:id` | `ADMIN` | Actualiza opción de transporte |
| DELETE | `/catalog/transport/:id` | `ADMIN` | Desactiva opción de transporte |

### 3.1 Listado y ficha de destinos

```http
GET /api/v1/catalog/destinations?q=cartagena&featured=true&page=1&pageSize=20
Authorization: Bearer <accessToken>
```

```http
200 OK
{
  "items": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "city": "Cartagena",
      "country": "Colombia",
      "slug": "cartagena",
      "description": "Ciudad amurallada frente al Caribe...",
      "heroImageUrl": "https://...",
      "latitude": 10.391049,
      "longitude": -75.479426,
      "timezone": "America/Bogota",
      "tags": ["playa", "historia", "gastronomia"],
      "isFeatured": true,
      "isActive": true,
      "fromPrice": { "amountMinor": 52000000, "currency": "COP" },
      "createdAt": "2026-11-02T15:00:00.000Z",
      "updatedAt": "2026-11-02T15:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

`GET /catalog/destinations/:id` devuelve `{ "destination": { ... } }` con la misma forma.

- `q` busca por `city`, `country` y `slug` con `ILIKE` (índices trigram).
- `country` compara sin distinguir mayúsculas; `featured` acepta `true`/`false`.
- `fromPrice` se deriva del hotel activo más económico en COP. Si el destino no tiene hoteles
  activos en COP, es `null`. No se almacena.
- Los destinos inactivos no aparecen en listados ni en la ficha (`404`).

### 3.2 Hoteles, actividades y transporte

```http
GET /api/v1/catalog/hotels?destinationId=<uuid>&maxPriceMinor=60000000&currency=COP
GET /api/v1/catalog/activities?destinationId=<uuid>&interest=playa&intensity=MEDIUM
GET /api/v1/catalog/transport?originId=<uuid>&destinationId=<uuid>&mode=FLIGHT
```

`HotelDto`:

```json
{
  "id": "uuid",
  "destinationId": "uuid",
  "name": "Hotel Casa San Agustín",
  "description": "Hotel boutique en una casona colonial.",
  "category": 5,
  "roomType": "Suite",
  "pricePerNight": { "amountMinor": 128000000, "currency": "COP" },
  "imageUrl": "https://...",
  "amenities": { "wifi": true, "pool": true },
  "isActive": true,
  "createdAt": "2026-11-02T15:00:00.000Z",
  "updatedAt": "2026-11-02T15:00:00.000Z"
}
```

`ActivityDto` añade `intensity` (`LOW|MEDIUM|HIGH`), `durationMinutes`, `pricePerPerson` y `tags`.

`TransportOptionDto`:

```json
{
  "id": "uuid",
  "originDestinationId": "uuid-o-null",
  "destinationId": "uuid",
  "mode": "FLIGHT",
  "provider": "Avianca",
  "price": { "amountMinor": 45000000, "currency": "COP" },
  "imageUrl": "https://.../transport/cartagena/flight-avianca.webp",
  "pricingUnit": "PER_PERSON",
  "durationMinutes": 90,
  "isActive": true,
  "createdAt": "2026-11-02T15:00:00.000Z",
  "updatedAt": "2026-11-02T15:00:00.000Z"
}
```

- `maxPriceMinor` se compara en la moneda indicada por `currency` (por defecto `COP`).
- `interest` filtra por etiqueta exacta normalizada a minúsculas.
- `mode` acepta `FLIGHT|BUS|CAR_RENTAL|BOAT|TRAIN`.
- `imageUrl` es la imagen principal del transporte; puede ser `null` si el ítem no tiene imagen.
- `pricingUnit` debe respetar el modo: `CAR_RENTAL` solo `PER_DAY`; `FLIGHT` `PER_TRIP` o
  `PER_PERSON`; `BUS`, `BOAT` y `TRAIN` `PER_PERSON` o `PER_TRIP`. `PER_NIGHT` no aplica a
  transporte. `originId` y `destinationId` no pueden ser el mismo destino.
- Los listados devuelven solo ítems activos de destinos activos.

### 3.3 Escritura de catálogo (solo `ADMIN`)

```http
POST /api/v1/catalog/destinations
Authorization: Bearer <accessTokenAdmin>
Content-Type: application/json

{
  "city": "Bogotá",
  "country": "Colombia",
  "latitude": 4.711,
  "longitude": -74.0721,
  "tags": ["cultura", "gastronomia"],
  "isFeatured": true
}
```

```http
201 Created
{ "destination": { "id": "uuid", "slug": "bogota", "isActive": true, ... } }
```

- `slug` es opcional; si falta se deriva de `city` (sin tildes, minúsculas y guiones). Es único:
  duplicado → `409 CONFLICT`.
- `PATCH` acepta cualquier subconjunto de campos y exige al menos uno; body vacío → `422`.
- `DELETE` es un **soft delete**: pone `isActive=false` y responde `204`; no borra filas ni rompe
  referencias de planes existentes.
- Los cuerpos de hotel/actividad/transporte usan `pricePerNight`, `pricePerPerson` y `price` como
  `Money`, respectivamente. Ejemplo de hotel:

```json
{
  "destinationId": "uuid",
  "name": "Hotel Nuevo",
  "category": 4,
  "roomType": "Doble",
  "pricePerNight": { "amountMinor": 48000000, "currency": "COP" },
  "amenities": { "wifi": true, "breakfast": true }
}
```

- Los campos desconocidos se rechazan con `422`; los IDs de destino inexistentes responden `404`.
- Un `ADVISOR` recibe `403 FORBIDDEN` en cualquier escritura de catálogo.


## 4. Solicitud de viaje (implementado — Fase 3)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/trip-requests` | `ADVISOR`/`ADMIN` | Crea solicitud desde el super prompt |
| GET | `/trip-requests/:id` | dueño/`ADMIN` | Estado, slots y preguntas pendientes |
| POST | `/trip-requests/:id/answers` | dueño/`ADMIN` | Responde slots; devuelve faltantes o `READY` |
| GET | `/trip-requests?status=&page=&pageSize=` | dueño/`ADMIN` | Historial paginado; `ADMIN` ve todo |
| POST | `/trip-requests/:id/generate` | dueño/`ADMIN` | Encola generación asíncrona (`202`) |

### 4.1 Crear solicitud

```http
POST /api/v1/trip-requests
Authorization: Bearer <accessToken>
{ "prompt": "Quiero un viaje para dos personas en Colombia, 5 días, playa" }
```

```http
201 Created
{
  "tripRequest": {
    "id": "9f1c...",
    "promptOriginal": "Quiero un viaje para dos personas en Colombia, 5 días, playa",
    "status": "AWAITING_INPUT",
    "slots": {
      "destination": null,
      "startDate": null,
      "endDate": null,
      "durationDays": 5,
      "adults": 2,
      "children": 0,
      "travelerType": null,
      "interests": ["playa"],
      "budgetMin": null,
      "budgetMax": null,
      "currency": "COP"
    },
    "missingFields": ["destination", "budget"],
    "questions": [
      {
        "field": "destination",
        "prompt": "¿A dónde quieren viajar?",
        "chips": ["Cartagena", "Medellín", "Santa Marta", "Sorpréndenos"]
      },
      {
        "field": "budget",
        "prompt": "¿Qué presupuesto manejan por persona?",
        "chips": ["Económico", "Medio", "Premium"]
      }
    ],
    "planId": null,
    "errorCode": null,
    "createdAt": "2026-11-03T15:00:00.000Z",
    "updatedAt": "2026-11-03T15:00:00.000Z"
  }
}
```

- `prompt` es obligatorio, se recorta y admite 1–2000 caracteres; los campos desconocidos se rechazan
  con `422`.
- El `advisorId` sale del JWT; nunca se acepta en el body.
- `slots.destination` es `{ id, city, country } | null`; los presupuestos son `Money | null`.
- `missingFields` solo contiene `destination`, `duration`, `travelers` y `budget`. Los intereses son
  opcionales y no bloquean `READY`.
- `questions` trae **máximo 2** preguntas por turno; los chips de destino salen del catálogo activo.
- `status` es `AWAITING_INPUT` si falta algún slot requerido y `READY` si están todos.

### 4.2 Consultar y listar

```http
GET /api/v1/trip-requests/9f1c...
GET /api/v1/trip-requests?status=READY&page=1&pageSize=20
Authorization: Bearer <accessToken>
```

El detalle responde `{ "tripRequest": { ... } }`. El listado responde
`Paginated<TripRequestDto>`: `{ items, page, pageSize, total }`. Un `ADVISOR` solo ve sus solicitudes;
un `ADMIN` ve todas. Un ID ajeno o inexistente responde `404` (no `403`).

### 4.3 Responder preguntas

```http
POST /api/v1/trip-requests/9f1c.../answers
{ "answers": [
    { "field": "destination", "value": "Cartagena y playa" },
    { "field": "budget", "value": "Medio" }
] }

200 OK
{ "tripRequest": { "status": "READY", "missingFields": [], "questions": [], ... } }
```

- `field` ∈ `destination|duration|travelers|budget`; `value` es texto libre (1–200 chars) y lo
  interpreta el parser determinista.
- Se aceptan de 1 a 4 respuestas por turno, sin campos repetidos (`422` con `errors[].field`).
- Un destino que no existe en el catálogo responde `422` con
  `errors: [{ "field": "destination", "message": "No encontramos ... en el catálogo..." }]`.
- Se puede responder incluso en `READY` para refinar; el estado se recalcula.
- Responder en un estado que no sea `AWAITING_INPUT` o `READY` (p. ej. `GENERATING`) responde
  `409 CONFLICT`.

### 4.4 Generación asíncrona

```http
POST /api/v1/trip-requests/9f1c.../generate
Authorization: Bearer <accessToken>

202 Accepted
{
  "tripRequestId": "9f1c...",
  "jobId": "5b2e...",
  "status": "GENERATING",
  "pollAfterMs": 1500
}
```

- Solo se puede generar desde `READY` o `FAILED` (reintento). En cualquier otro estado → `409 CONFLICT`.
- Si la solicitud ya tiene un plan (`planId` no nulo) → `409 CONFLICT`; hay que editar o duplicar el plan.
- El servidor marca la solicitud `GENERATING`, crea un `ai_jobs` en `QUEUED` y ejecuta el job
  **in-process**. La respuesta no espera a Gemini.
- El cliente consulta `GET /trip-requests/:id` cada `pollAfterMs` hasta `GENERATED` (incluye `planId`)
  o `FAILED` (incluye `errorCode`).
- `FAILED` puede reintentarse con otro `POST /generate`. El plan no se crea si el job falla.
- Códigos de fallo posibles: `AI_UNAVAILABLE` (timeout, 429 o 5xx del proveedor), `AI_INVALID_OUTPUT`
  (JSON inválido tras una reparación), `VALIDATION_ERROR` (catálogo insuficiente o solicitud
  incompleta), `NOT_FOUND` e `INTERNAL_ERROR`.
- Rate limit: 10/h/usuario.

## 5. Planes (implementado — Fases 4–6)

Un plan nace `DRAFT` al terminar la generación. `SAVED` sigue siendo editable; `PUBLISHED` es de solo
lectura y `ARCHIVED` queda fuera del flujo activo. Todas las rutas exigen `Bearer`; un `ADVISOR` solo
accede a sus planes y un `ADMIN` a todos. Un plan ajeno responde `404`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/plans?status=&q=&destinationId=&page=&pageSize=` | Dashboard con filtros y paginación |
| GET | `/plans/:id` | Plan completo (días, ítems, presupuesto) |
| PATCH | `/plans/:id` | Título, resumen, tags y margen (solo `DRAFT`/`SAVED`) |
| GET | `/plans/:id/alternatives?itemId=` | Hasta 3 alternativas del mismo tipo/destino/moneda |
| POST | `/plans/:id/items` | Agrega un ítem del catálogo a un día |
| PATCH | `/plans/:id/items/:itemId` | Reemplaza el ítem por otro `catalogItemId` del mismo tipo |
| PATCH | `/plans/:id/items/:itemId/details` | Ajusta cantidad, horarios o notas |
| PATCH | `/plans/:id/items/:itemId/position` | Mueve el ítem a otro día/posición |
| DELETE | `/plans/:id/items/:itemId` | Quita el ítem |
| POST | `/plans/:id/save` | `DRAFT` → `SAVED` (idempotente) |
| POST | `/plans/:id/publish` | `DRAFT`/`SAVED` → `PUBLISHED` |
| POST | `/plans/:id/archive` | → `ARCHIVED` (idempotente) |
| POST | `/plans/:id/duplicate` | Copia como nuevo `DRAFT` con su propio `TripRequest` |
| GET | `/plans/:id/report?format=json\|csv` | Reporte JSON o CSV |
| GET | `/plans/:id/pdf` | PDF descargable del plan |

`PlanDto` (todas las mutaciones devuelven `{ "plan": PlanDto }`; el listado devuelve
`Paginated<PlanDto>`):

```json
{
  "id": "7a2b...",
  "tripRequestId": "9f1c...",
  "title": "Cartagena Esencial 5 días",
  "status": "DRAFT",
  "summary": "Cinco días entre el centro histórico, las islas y la gastronomía local.",
  "heroImageUrl": "https://...",
  "tags": ["playa", "cultura"],
  "destination": {
    "id": "...",
    "city": "Cartagena",
    "country": "Colombia",
    "latitude": 10.391049,
    "longitude": -75.479426,
    "timezone": "America/Bogota",
    "heroImageUrl": "https://..."
  },
  "currency": "COP",
  "days": [
    {
      "id": "d1...",
      "dayNumber": 1,
      "date": "2026-12-10",
      "title": "Llegada y centro histórico",
      "notes": null,
      "subtotal": { "amountMinor": 218000000, "currency": "COP" },
      "items": [
        {
          "id": "i1...",
          "type": "TRANSPORT",
          "catalogItemId": "transport-uuid",
          "name": "Avianca (FLIGHT)",
          "imageUrl": null,
          "unitPrice": { "amountMinor": 45000000, "currency": "COP" },
          "quantity": 2,
          "pricingUnit": "PER_PERSON",
          "subtotal": { "amountMinor": 90000000, "currency": "COP" },
          "startTime": "08:00",
          "endTime": "09:30",
          "notes": "Llegada al destino.",
          "position": 0
        }
      ]
    }
  ],
  "budget": {
    "flights": { "amountMinor": 90000000, "currency": "COP" },
    "hotels": { "amountMinor": 128000000, "currency": "COP" },
    "activities": { "amountMinor": 36000000, "currency": "COP" },
    "subtotal": { "amountMinor": 254000000, "currency": "COP" },
    "marginPercent": 12,
    "margin": { "amountMinor": 30480000, "currency": "COP" },
    "total": { "amountMinor": 284480000, "currency": "COP" }
  },
  "version": 3,
  "publishedAt": null,
  "createdAt": "2026-11-03T15:00:00.000Z",
  "updatedAt": "2026-11-03T15:05:00.000Z"
}
```

### 5.1 Metadatos y margen

```http
PATCH /api/v1/plans/7a2b...
{ "title": "Cartagena Premium", "summary": "Versión con hoteles boutique.",
  "tags": ["playa", "lujo"], "marginPercent": 12.5 }
```

- Todos los campos son opcionales, pero debe venir al menos uno; body vacío → `422`.
- `title` 2–120, `summary` hasta 1000, `tags` hasta 20 de 1–40 caracteres.
- `marginPercent` entre 0 y 100, máximo dos decimales; el margen y el total se recalculan.
- El cliente **nunca** envía precios ni totales.

### 5.2 Ítems

```http
POST /api/v1/plans/7a2b.../items
{ "dayNumber": 2, "type": "ACTIVITY", "catalogItemId": "activity-uuid",
  "quantity": 3, "startTime": "15:00", "notes": "Tarde de playa" }

201 Created
{ "plan": { ...PlanDto actualizado } }
```

- `dayNumber` 1–30; `type` ∈ `ACCOMMODATION|ACTIVITY|TRANSPORT`; `catalogItemId` debe existir,
  estar activo, pertenecer al destino del plan y usar la misma moneda.
- `quantity` es opcional (1–99). Si falta, el servidor la deriva: noches para alojamiento, viajeros
  para `PER_PERSON`, días para `PER_DAY`, 1 para `PER_TRIP`.
- Cada día admite máximo 6 ítems. El servidor copia nombre, imagen y precio del catálogo (snapshot).

```http
PATCH /api/v1/plans/7a2b.../items/i2
{ "catalogItemId": "hotel-uuid" }

PATCH /api/v1/plans/7a2b.../items/i2/details
{ "quantity": 4, "startTime": "16:00", "endTime": null, "notes": "Check-in tardío" }

PATCH /api/v1/plans/7a2b.../items/i2/position
{ "dayNumber": 3, "position": 0 }

DELETE /api/v1/plans/7a2b.../items/i2
```

- Reemplazar exige el mismo `type` del ítem original; un tipo distinto → `422`.
- `details` acepta cualquier subconjunto de `quantity`, `startTime`, `endTime`, `notes`; body vacío → `422`.
- `position` mueve el ítem al día indicado; si se omite, va al final.
- `DELETE` responde `200` con el plan completo actualizado.
- Editar un plan `PUBLISHED` o `ARCHIVED` → `409 PLAN_NOT_EDITABLE`; duplica para editar.

### 5.3 Alternativas

```http
GET /api/v1/plans/7a2b.../alternatives?itemId=i2

200 OK
{
  "itemId": "i2",
  "alternatives": [
    {
      "id": "hotel-uuid",
      "type": "ACCOMMODATION",
      "name": "Hotel Bóvedas de San Pedro",
      "imageUrl": "https://...",
      "price": { "amountMinor": 96000000, "currency": "COP" },
      "pricingUnit": "PER_NIGHT",
      "tags": [],
      "category": 4,
      "durationMinutes": null
    }
  ]
}
```

- Mismo `type`, `destinationId` y moneda; se excluye el ítem actual y se devuelven máximo 3,
  ordenados por precio ascendente.

### 5.4 Ciclo de vida

```http
POST /api/v1/plans/7a2b.../save
POST /api/v1/plans/7a2b.../publish
POST /api/v1/plans/7a2b.../archive
POST /api/v1/plans/7a2b.../duplicate
```

- `save`: `DRAFT` → `SAVED`; si ya está `SAVED`, responde el mismo plan sin error.
- `publish`: exige título, al menos un ítem y total > 0; `DRAFT`/`SAVED` → `PUBLISHED`.
  Publicar dos veces → `409 CONFLICT`; publicar un `ARCHIVED` → `409 PLAN_NOT_EDITABLE`.
- `archive`: pasa a `ARCHIVED`; es idempotente.
- `duplicate`: crea un `TripRequest` copia y un `Plan DRAFT` nuevo con título `"(copia)"`,
  ítems y presupuesto recalculados. `version` del nuevo plan = `version` del origen + 1.
  Responde `201`.

### 5.5 Reportes y PDF

```http
GET /api/v1/plans/7a2b.../report
GET /api/v1/plans/7a2b.../report?format=csv
GET /api/v1/plans/7a2b.../pdf
```

`PlanReportDto` (JSON):

```json
{
  "planId": "7a2b...",
  "title": "Cartagena Esencial 5 días",
  "status": "DRAFT",
  "destination": "Cartagena, Colombia",
  "days": [
    {
      "dayNumber": 1,
      "date": "2026-12-10",
      "subtotal": { "amountMinor": 218000000, "currency": "COP" },
      "items": [
        { "type": "TRANSPORT", "name": "Avianca (FLIGHT)", "quantity": 2,
          "subtotal": { "amountMinor": 90000000, "currency": "COP" } }
      ]
    }
  ],
  "budget": { "flights": { "...": "..." }, "hotels": { "...": "..." },
              "activities": { "...": "..." }, "subtotal": { "...": "..." },
              "marginPercent": 12, "margin": { "...": "..." }, "total": { "...": "..." } },
  "generatedAt": "2026-11-03T15:05:00.000Z"
}
```

- `format=csv` responde `text/csv; charset=utf-8` con
  `Content-Disposition: attachment; filename="plan-<id>.csv"` y columnas
  `dia,fecha,tipo,item,cantidad,subtotal_minor,moneda`, seguidas de `subtotal`, `margen_pct`,
  `margen` y `total`.
- `GET /plans/:id/pdf` responde `application/pdf` con portada, resumen de presupuesto e itinerario.
  El PDF se genera en el servidor sin dependencias externas.
- Todos los montos salen del plan persistido; el cliente no calcula nada.

## 6. Mapa y sugerencias (implementado)

El mapa del MVP consume `GET /plans/:id` y `GET /catalog/destinations`; no hay endpoint de tiles.
El carrusel "Destinos para ti" usa `GET /catalog/destinations?featured=true` (`is_featured`).
Cada destino incluye `fromPrice` (derivado del hotel activo más económico en COP) y `tags`; los pines
de sugerencias muestran `fromPrice` y los del plan abierto muestran `budget.total`. Sin plan, no se
inventa un precio: si `fromPrice` es `null`, el pin solo muestra el nombre.

## 7. RBAC

| Recurso | `ADVISOR` | `ADMIN` | Estado |
|---|---|---|---|
| `GET /auth/me` | propio | propio | ✅ |
| `POST /users` | ❌ (`403`) | ✅ | ✅ |
| Catálogo (lectura) | ✅ | ✅ | ✅ |
| Catálogo (escritura) | ❌ (`403`) | ✅ | ✅ |
| `trip-requests` propias | CRUD | CRUD | ✅ Fase 3 |
| `trip-requests` ajenas | ❌ (`404`) | ✅ | ✅ Fase 3 |
| `plans` propios | CRUD + publicar | CRUD + publicar | ✅ Fases 4–6 |
| `plans` ajenos | ❌ (`404`) | ✅ | ✅ Fases 4–6 |
| `PATCH /users/:id` | ❌ | ✅ | ⏳ pendiente |

Recurso ajeno ⇒ `404`, no `403` (no revelar existencia). El `advisorId` sale del JWT verificado, nunca
del body.

## 8. Límites

| Endpoint | Límite | Estado |
|---|---|---|
| `POST /auth/login` | 5/min/IP | ✅ |
| `POST /auth/refresh` | 30/min/IP | ✅ |
| Global | 300/min/IP | ✅ |
| `POST /trip-requests` | 20/h/usuario | ✅ |
| `POST /trip-requests/:id/generate` | 10/h/usuario | ✅ |

Cabeceras `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`; al exceder, `429` con
`Retry-After`. En tests se desactiva con `RATE_LIMIT_ENABLED=false`; en producción debe quedar `true`.
