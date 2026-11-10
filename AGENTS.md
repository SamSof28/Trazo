# AGENTS.md

Instrucciones para sesiones de OpenCode en **Trazo** (Módulo 1: diseñador inteligente de planes
turísticos). El repositorio ya tiene el monorepo y el backend completo de las fases 0–7: fundación,
identidad, catálogo, intake conversacional determinista, generación con IA anclada al catálogo, edición
y presupuesto, guardado/publicación/dashboard y reportes JSON/CSV + PDF, todo con tests. La base de
datos Supabase ya está creada y sembrada con 7 destinos. El frontend ya existe en `frontend/` con
login, layout, guards, cliente API, banner de cookies, landing, catálogo y ficha de destino, intake
conversacional, workspace del plan, dashboard y administración del equipo.

## Contexto de producto

Un asesor escribe el viaje en lenguaje natural y la app devuelve un plan turístico editable
(itinerario por días, hoteles, actividades, transporte y presupuesto) listo para publicar. Reemplaza
el proceso manual en hojas de cálculo y correos. UX tipo Layla.ai: super prompt → chat que pregunta
solo lo que falta → split-view con mapa, carrusel y timeline.

Problema, objetivo, alcance, HUs y diagramas: [`README.md`](README.md) §1–§8. Fase actual: **7 —
Reportes y endurecimiento**; backend completo y frontend pendiente (1.4, 2.4, 3.3–3.4, 4.5–4.6, 5.3,
6.4), al igual que la disponibilidad 2.5 (HU 3.3–3.4), el clima 5.7 y las pruebas de carga 7.3
([`docs/ROADMAP.md`](docs/ROADMAP.md)).

## Leer antes de codificar

1. [`README.md`](README.md) — producto, alcance, HUs, diagramas, reglas de negocio.
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — capas, módulos, seguridad, IA.
3. [`docs/DOMAIN.md`](docs/DOMAIN.md) — tablas, invariantes, presupuesto.
4. [`docs/API.md`](docs/API.md) — contrato REST acordado.
5. [`docs/ROADMAP.md`](docs/ROADMAP.md) — fase actual y siguiente rebanada.
6. [`docs/BACKEND.md`](docs/BACKEND.md) — mapa real de controllers, endpoints, auth y conexión del frontend.
7. [`docs/AI.md`](docs/AI.md) — configuración de Gemini, prompt de negocio y grounding al catálogo.
8. [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Supabase, migraciones, seed, Vercel y variables.

Si el código contradice estos docs, gana el código ejecutable: actualiza el doc en el mismo cambio.

## Reglas de proceso (no negociables)

- **Nunca** `git init`, `git commit`, `git push` ni cambio de rama sin autorización explícita del usuario.
- **No** construir la app completa de una vez. Una rebanada vertical por sesión: dominio → caso de uso →
  adaptador → ruta HTTP → tests → docs. Si la tarea es grande, propón el orden y confirma.
- No crear archivos vacíos "para después" ni scaffolding especulativo de módulos no pedidos.
- No inventar requisitos: si falta una decisión de producto, pregunta (máx. 1 lote de preguntas).
- Toda funcionalidad nueva actualiza `docs/API.md` y, si cambia el modelo, `docs/DOMAIN.md`.
- Los docs están en español; identificadores, código, tests y commits en inglés.

## Stack y comandos

Monorepo npm workspaces: `backend/`, `packages/shared/` y `frontend/`.

```bash
npm install                 # raíz
npm run dev -w backend      # API en :3000 (tsx watch)
npm run dev -w frontend     # Vite en :5173
npm run lint                # ESLint flat, todos los workspaces
npm run typecheck           # tsc --noEmit
npm run test                # Vitest
npm run verify              # lint → typecheck → test → build
npm run test -w @trazo/backend -- test/auth.http.test.ts  # un archivo
npm run test -w @trazo/backend -- -t "rotates"           # por nombre
npm run build               # shared + backend + frontend
npm run db:generate -w backend      # prisma generate
npm run db:migrate -w backend       # prisma migrate dev (requiere DIRECT_URL)
npm run db:deploy -w backend        # prisma migrate deploy
npm run db:seed -w backend
```

- El backend carga **`backend/.env`**, no el `.env` de la raíz. Cópialo de `.env.example`.
- Los scripts ya existen; `npm run verify` es el orden oficial antes de decir "listo".
- Prisma CLI: usar los scripts npm (`npm exec -w backend -- prisma ...`); `npx prisma ... -w backend` no funciona.

## Estado actual del backend

- **Implementado:** scaffold del monorepo, `config/env.ts` con Zod, logger pino con redacción,
  `errorHandler` problem+json, `/health`, `/health/ready`, Prisma schema completo + migraciones
  `0001_init`–`0005_transport_image` **aplicadas en Supabase** (`0006_user_agency` pendiente), seed
  de admin y catálogo de Colombia, login, **registro público (`POST /auth/register`, siempre
  `ADVISOR`)**, refresh rotativo con detección de reuso, logout, `/auth/me`, RBAC, `GET/POST /users`
  (solo `ADMIN`), catálogo completo (`destinations`, `hotels`, `activities`, `transport`) con lectura
  autenticada, escritura `ADMIN`, soft delete e `imageUrl` en las cuatro entidades, intake
  conversacional (`TripRequest`, parser determinista, preguntas/respuestas, listado y ownership),
  generación con IA (`mock` + Gemini REST, `ai_jobs`, runner in-process), planes (lectura, edición de
  metadatos e ítems, alternativas, presupuesto), ciclo de vida (`SAVED`, publicar, archivar, duplicar),
  dashboard API y reportes JSON/CSV + PDF. Incluye el puerto `ObjectStorage` y el adaptador REST
  `SupabaseStorage` (bucket público `catalog`) usado por el seed.
- **Tests:** 138 de backend + 6 de `packages/shared`, con fakes (sin DB ni red). `npm run verify` en
  verde el 2026-11-09.
- **Datos sembrados:** 1 admin, 7 destinos, 14 hoteles, 28 actividades y 15 transportes. Las 7 fotos
  de destinos ya están versionadas en `frontend/public/images/destinations/` y
  `backend/prisma/assets/catalog/destinations/`; el seed las sube a Storage y, sin Storage, el SPA usa
  las locales. Hoteles, actividades y transporte heredan la foto del destino si no tienen una propia.
- **IA verificada:** `AI_PROVIDER=gemini` con `gemini-3-flash-preview`; se generó un plan real de 3
  días con IDs del catálogo. `gemini-2.5-flash` ya no está disponible para cuentas nuevas.
- **Auditoría:** `npm audit` y `npm audit --omit=dev` en 0 (Vitest 5.1, ESLint 10.14 y overrides de
  `deepmerge-ts`/`minimatch` documentados en [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)).
- **Frontend actual:** React 19 + Vite 7 + Tailwind 4 en `frontend/`. Implementados: `LoginPage`,
  `RegisterPage` (enlace desde login, auto-login y diseño del mockup `frontend/Registro-html`),
  `CookieBanner`, guards `ProtectedRoute`/`AdminRoute`, router con `AppShell`, cliente API con access
  token en memoria y refresh por cookie, landing con dos caminos (IA/catálogo), catálogo y ficha de
  destino, intake conversacional, workspace del plan con edición y presupuesto, dashboard y
  administración del equipo. El login se probó contra la API local y el refresh funciona tras
  corregir el orden de la FK en `PrismaRefreshTokenRepository.rotate` (test en
  `refresh-token.repository.test.ts`).
- **Pendiente inmediato:** aplicar `0006_user_agency` en Supabase; modelo de disponibilidad (2.5),
  clima (5.7), chat de refinamiento (5.8), mapa Leaflet embebido y pruebas de carga (7.3); despliegue
  cuando el compañero lo indique. **No** hacer commit/push sin autorización.
- **Contrato de conexión:** [`docs/BACKEND.md`](docs/BACKEND.md). **IA:** [`docs/AI.md`](docs/AI.md).
  **Despliegue:** [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). **SQL consolidado:**
  [`docs/supabase-schema.sql`](docs/supabase-schema.sql).

## Estructura y regla de dependencia

```
backend/src/
  domain/          # entidades, value objects, puertos (interfaces), errores de dominio
  application/     # casos de uso, DTOs, transacciones; sin Express ni Prisma
  infrastructure/  # adaptadores: Prisma, Gemini, storage (Supabase REST), hashing, tokens, logger
  interfaces/http/ # routers, controllers, middleware, presenters
  config/          # env validado con Zod + composition root (wiring manual)
frontend/src/
  app/             # router, providers
  features/        # landing, workspace(chat/map/timeline), dashboard, auth
  shared/          # ui, api client, hooks
packages/shared/   # esquemas Zod + tipos de contrato (fuente única)
```

- Dirección permitida: `interfaces → application → domain`. `infrastructure` implementa puertos.
- **Prohibido** importar Express, Prisma o el SDK de Gemini desde `domain/` y `application/`.
- Inyección de dependencias manual en `config/container.ts`; sin decoradores ni contenedores mágicos.
- Módulos (bounded contexts): `identity`, `catalog`, `intake`, `planning`, `ai`. `intake` puede usar
  `catalog`; `planning` puede usar `catalog`, `intake` y `ai`; `catalog` no conoce `intake` ni
  `planning`; `identity` no conoce a nadie.

## Invariantes de dominio (romperlas es un bug)

- Dinero = entero en unidades menores + moneda ISO-4217. **Cero floats** para precios; formatear solo en presentación.
- El modelo de IA **nunca** produce precios ni nombres finales: devuelve `catalogItemId` + día + horario.
  El servidor valida el ID contra el shortlist y recalcula todo desde la BD.
- Un `Plan` nace `DRAFT`; `SAVED` es editable y `PUBLISHED` es de solo lectura (duplicar para editar).
  Un plan = una moneda; `marginPercent` está entre 0 y 100.
- Cuando exista el modelo de disponibilidad (2.5), ningún ítem entra al plan si no está disponible
  para las fechas; la validación es server-side y nunca se sobrevende. Hoy el shortlist solo filtra por
  `isActive` y moneda: no implementes 2.5 sin la decisión de producto.
- `TripRequest` y `Plan` son agregados separados con estados separados (ver `docs/DOMAIN.md`).
  Los estados "pensando"/"consultando APIs" son de UI, no se persisten.
- Ownership en el caso de uso: `ADVISOR` solo ve lo suyo; `ADMIN` ve todo. No confiar en el `advisorId`
  que mande el cliente.
- Fechas de itinerario en `date`; timestamps en `timestamptz` UTC; presentación en `America/Bogota`.
- IDs UUID generados en servidor; nunca autoincrementales expuestos.

## Seguridad (checklist por endpoint)

- Zod valida body, params y query en el borde; `express.json({ limit: '100kb' })`; prompt máx. 2000 chars.
- Auth: access JWT 15 min en memoria del cliente; refresh token rotativo en cookie `HttpOnly; Secure;
  SameSite=Strict`, hash en BD, detección de reuso. Nunca `localStorage`.
- RBAC + ownership en el caso de uso. `helmet`, CORS por allowlist (`CORS_ORIGINS`), rate limit en
  `/auth/*` y `/generate` (coste de IA).
- Errores: `application/problem+json` con código estable; sin stack traces, SQL ni detalles del proveedor
  de IA al cliente. Logs con `pino` y redacción de `authorization`, `cookie`, `password`, `apiKey`.
- Secretos solo por entorno, validados al arrancar (falla rápido si faltan). Nunca commitear `.env`.
- El frontend **no** habla con Supabase directamente; todo pasa por la API. Sin `service_role` en el cliente.
- IA: el prompt del usuario es dato, no instrucción; delimitarlo, pedir JSON con schema y validar con Zod.
  Rechazar y reintentar (máx. 1 reparación) si el output no valida. No enviar PII (nombre, email, teléfono).

## Testing

- Unitarios de dominio/casos de uso con puertos falsos (sin DB, sin red).
- Integración de API con Supertest contra Postgres de test; limpiar por transacción o truncado.
- Adaptador de IA: tests de contrato con respuestas grabadas; el `mock` debe ser determinista.
- Frontend: Testing Library para flujos de chat/alternativas; no snapshot tests de UI completa.
- Bug fix = test que falla primero.

## Gotchas del entorno

- Supabase: runtime usa el pooler (`:6543`, `?pgbouncer=true`); migraciones usan `DIRECT_URL` (`:5432`).
  Mezclarlos produce errores de prepared statements. La conexión directa `db.<ref>.supabase.co:5432`
  puede fallar por IPv6; usa el **Session pooler** (`aws-1-<region>.pooler.supabase.com:5432`).
- Prisma no soporta transacciones interactivas largas sobre el pooler en modo transaction; mantenerlas cortas.
- Gemini: `gemini-2.5-flash` ya no está disponible para cuentas nuevas. El modelo verificado es
  `gemini-3-flash-preview`; los modelos 3.6/3.8 pueden devolver `503` por alta demanda.
- COP no usa decimales en la práctica, pero se almacena en unidades menores igual que el resto.
- El mapa no debe renderizarse en SSR; Leaflet requiere `window` y se carga solo en cliente.
- `packages/shared` no puede importar nada de `backend/` ni `frontend/` (evita ciclos).
