# Contrato de API — TuriViajes v1

Base: `/api/v1`. JSON UTF-8. Autenticación `Authorization: Bearer <accessToken>` salvo donde se indique.
Este documento es el contrato que consumen el frontend y los tests; cambia junto con el código.

## 1. Convenciones

- **Fechas:** `YYYY-MM-DD` para días; ISO-8601 UTC (`2026-11-03T14:05:00Z`) para instantes.
- **Dinero:** `{ "amountMinor": 59909900, "currency": "COP" }`. Nunca strings formateados ni floats.
- **IDs:** UUID v4 en string.
- **Paginación:** `?page=1&pageSize=20` (máx. 100) → `{ "items": [], "page": 1, "pageSize": 20, "total": 0 }`.
- **Errores:** `application/problem+json` con `type`, `title`, `status`, `code`, `detail`, `requestId`,
  `errors[]` (solo validación). Códigos en [`ARCHITECTURE.md`](ARCHITECTURE.md#modelo-de-errores).
- **Idempotencia:** `POST /plans/:id/publish` y `/generate` aceptan `Idempotency-Key` (UUID).
- **Campos desconocidos:** rechazados (Zod `.strict()`) → `422 VALIDATION_ERROR`.

## 2. Auth e identidad

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/auth/login` | público | Email + password → access token + cookie refresh |
| POST | `/auth/refresh` | cookie | Rota refresh y devuelve nuevo access |
| POST | `/auth/logout` | autenticado | Revoca refresh actual |
| GET | `/auth/me` | autenticado | Usuario y rol actuales |
| POST | `/users` | `ADMIN` | Crea asesor (`ADVISOR`) |
| PATCH | `/users/:id` | `ADMIN` | Activa/desactiva o cambia rol |

```http
POST /api/v1/auth/login
{ "email": "asesor@agencia.co", "password": "..." }

200 OK
Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth
{ "accessToken": "...", "expiresIn": 900, "user": { "id": "...", "name": "...", "role": "ADVISOR" } }
```

Errores: `401 UNAUTHENTICATED` (credenciales inválidas, mismo mensaje para email inexistente),
`429 RATE_LIMITED` (5/min/IP).

## 3. Catálogo (solo lectura en el MVP)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/catalog/destinations?q=&country=&page=` | autenticado | Busca destinos activos |
| GET | `/catalog/destinations/:id` | autenticado | Ficha con lat/lng y hero |
| GET | `/catalog/hotels?destinationId=&maxPriceMinor=&page=` | autenticado | Hoteles activos |
| GET | `/catalog/activities?destinationId=&interest=` | autenticado | Actividades activas |
| GET | `/catalog/transport?originId=&destinationId=&mode=` | autenticado | Opciones de transporte |

`ADMIN` podrá crear/editar catálogo en la fase 2b (`POST/PATCH /catalog/...`), aún no implementado.

## 4. Solicitud de viaje (intake)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/trip-requests` | `ADVISOR` | Crea solicitud desde el super prompt |
| GET | `/trip-requests/:id` | dueño/`ADMIN` | Estado, slots y preguntas pendientes |
| POST | `/trip-requests/:id/answers` | dueño/`ADMIN` | Responde slots; devuelve faltantes o `READY` |
| POST | `/trip-requests/:id/generate` | dueño/`ADMIN` | Encola generación (`202`) |
| GET | `/trip-requests` | dueño/`ADMIN` | Historial paginado |

```http
POST /api/v1/trip-requests
{ "prompt": "Quiero un viaje para dos personas en Colombia, 5 días, playa" }

201 Created
{
  "id": "9f1c...",
  "status": "AWAITING_INPUT",
  "slots": { "destination": null, "durationDays": 5, "adults": 2, "children": 0,
             "interests": ["playa"], "budget": null },
  "missingFields": ["destination", "startDate", "budget"],
  "questions": [
    { "field": "destination", "prompt": "¿A dónde quieren viajar?",
      "chips": ["Cartagena y playa", "Eje Cafetero", "Sorpréndenos"] },
    { "field": "budget", "prompt": "¿Qué presupuesto manejan por persona?",
      "chips": ["Económico", "Medio", "Premium"] }
  ]
}
```

```http
POST /api/v1/trip-requests/9f1c.../answers
{ "answers": [
    { "field": "destination", "value": "Cartagena y playa" },
    { "field": "budget", "value": "MEDIUM" },
    { "field": "startDate", "value": "2026-12-10" }
] }

200 OK
{ "id": "9f1c...", "status": "READY", "missingFields": [], "questions": [] }
```

Reglas: máx. 2 preguntas por respuesta; valor inválido → `422` con `errors[].field`; responder una
solicitud que no está en `COLLECTING|AWAITING_INPUT` → `409 CONFLICT`.

### Generación asíncrona

```http
POST /api/v1/trip-requests/9f1c.../generate
Idempotency-Key: 0b0e...

202 Accepted
{ "tripRequestId": "9f1c...", "status": "GENERATING", "pollAfterMs": 1500 }
```

El cliente consulta `GET /trip-requests/:id` hasta `GENERATED` (incluye `planId`) o `FAILED`
(incluye `error.code`). Timeout de IA → `FAILED` + `AI_UNAVAILABLE`; reintentar es otro `POST /generate`.
Doble generación con job activo → `409 CONFLICT`.

## 5. Planes

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/plans?status=&q=&destinationId=&page=` | dueño/`ADMIN` | Dashboard con filtros |
| GET | `/plans/:id` | dueño/`ADMIN` | Plan completo (días, ítems, presupuesto) |
| PATCH | `/plans/:id` | dueño/`ADMIN` | Título comercial, resumen, tags (solo `DRAFT`) |
| GET | `/plans/:id/alternatives?itemId=` | dueño/`ADMIN` | 3 alternativas del mismo tipo/destino |
| PATCH | `/plans/:id/items/:itemId` | dueño/`ADMIN` | Reemplaza ítem por `catalogItemId` |
| DELETE | `/plans/:id/items/:itemId` | dueño/`ADMIN` | Quita ítem (solo `DRAFT`) |
| POST | `/plans/:id/publish` | dueño/`ADMIN` | `DRAFT` → `PUBLISHED` |
| POST | `/plans/:id/archive` | dueño/`ADMIN` | → `ARCHIVED` |
| POST | `/plans/:id/duplicate` | dueño/`ADMIN` | Copia como nuevo `DRAFT` |
| GET | `/plans/:id/report` | dueño/`ADMIN` | Resumen JSON/CSV para reporte básico |

```http
GET /api/v1/plans/7a2b...

200 OK
{
  "id": "7a2b...",
  "title": "Cartagena Esencial 5 días",
  "status": "DRAFT",
  "destination": { "id": "...", "city": "Cartagena", "country": "Colombia",
                   "latitude": 10.391, "longitude": -75.479, "heroImageUrl": "..." },
  "tags": ["playa", "cultura"],
  "days": [
    { "dayNumber": 1, "date": "2026-12-10", "subtotal": { "amountMinor": 218000000, "currency": "COP" },
      "items": [
        { "id": "i1", "type": "TRANSPORT", "name": "Vuelo MDE → CTG",
          "startTime": "08:00", "unitPrice": { "amountMinor": 45000000, "currency": "COP" },
          "quantity": 2, "subtotal": { "amountMinor": 90000000, "currency": "COP" } },
        { "id": "i2", "type": "ACCOMMODATION", "name": "Hotel Casa San Agustín",
          "startTime": "15:00", "unitPrice": { "amountMinor": 32000000, "currency": "COP" },
          "quantity": 4, "subtotal": { "amountMinor": 128000000, "currency": "COP" } }
      ] }
  ],
  "budget": {
    "flights": { "amountMinor": 90000000, "currency": "COP" },
    "hotels":  { "amountMinor": 128000000, "currency": "COP" },
    "activities": { "amountMinor": 36000000, "currency": "COP" },
    "subtotal": { "amountMinor": 254000000, "currency": "COP" },
    "marginPercent": 12, "margin": { "amountMinor": 30480000, "currency": "COP" },
    "total": { "amountMinor": 284480000, "currency": "COP" }
  }
}
```

```http
PATCH /api/v1/plans/7a2b.../items/i2
{ "catalogItemId": "hotel-uuid" }

200 OK
{ "item": { "id": "i2", "name": "Hotel Bóvedas de San Pedro", "quantity": 4 },
  "budget": { "total": { "amountMinor": 297920000, "currency": "COP" } } }
```

Reglas: editar un plan `PUBLISHED` → `409 CONFLICT` (`PLAN_NOT_EDITABLE`); `catalogItemId` de otro
tipo, destino o moneda → `422`; el servidor recalcula y devuelve el presupuesto actualizado.

## 6. Mapa y sugerencias

El mapa del MVP consume `GET /plans/:id` y `GET /catalog/destinations`; no hay endpoint de tiles.
El carrusel "Destinos para ti" usa `GET /catalog/destinations?featured=true` (`is_featured`).
Cada destino incluye `fromPriceMinor` (derivado del hotel activo más económico) y `tags`; los pines de
sugerencias muestran `fromPriceMinor` y los del plan abierto muestran `budget.total`. Sin plan, no se
inventa un precio: si `fromPriceMinor` es `null`, el pin solo muestra el nombre.

## 7. RBAC

| Recurso | `ADVISOR` | `ADMIN` |
|---|---|---|
| Catálogo (lectura) | ✅ | ✅ |
| Catálogo (escritura) | ❌ | ✅ (fase 2b) |
| `trip-requests` propias | CRUD | CRUD |
| `trip-requests` ajenas | ❌ (`404`) | ✅ |
| `plans` propios | CRUD + publicar | CRUD + publicar |
| `plans` ajenos | ❌ (`404`) | ✅ |
| Usuarios | ❌ | ✅ |

Recurso ajeno ⇒ `404`, no `403` (no revelar existencia).

## 8. Límites

| Endpoint | Límite |
|---|---|
| `POST /auth/login` | 5/min/IP |
| `POST /auth/refresh` | 30/min/IP |
| `POST /trip-requests` | 20/h/usuario |
| `POST /trip-requests/:id/generate` | 10/h/usuario |
| Global | 300/min/IP |

Cabeceras `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`; al exceder, `429` con
`Retry-After`.
