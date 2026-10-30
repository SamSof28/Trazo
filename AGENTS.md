# AGENTS.md

Instrucciones para sesiones de OpenCode en **TuriViajes** (Módulo 1: diseñador inteligente de planes
turísticos). Repo en estado **greenfield**: solo documentación, sin scaffold ni git inicializado.

## Contexto de producto

Un asesor escribe el viaje en lenguaje natural y la app devuelve un plan turístico editable
(itinerario por días, hoteles, actividades, transporte y presupuesto) listo para publicar. Reemplaza
el proceso manual en hojas de cálculo y correos. UX tipo Layla.ai: super prompt → chat que pregunta
solo lo que falta → split-view con mapa, carrusel y timeline.

Problema, objetivo, alcance, HUs y diagramas: [`README.md`](README.md) §1–§8. Fase actual: **0**
([`docs/ROADMAP.md`](docs/ROADMAP.md)).

## Leer antes de codificar

1. [`README.md`](README.md) — producto, alcance, HUs, diagramas, reglas de negocio.
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — capas, módulos, seguridad, IA.
3. [`docs/DOMAIN.md`](docs/DOMAIN.md) — tablas, invariantes, presupuesto.
4. [`docs/API.md`](docs/API.md) — contrato REST acordado.
5. [`docs/ROADMAP.md`](docs/ROADMAP.md) — fase actual y siguiente rebanada.

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

Monorepo npm workspaces: `backend/`, `frontend/`, `packages/shared/`.

```bash
npm install                 # raíz
npm run dev -w backend      # API en :3000 (tsx watch)
npm run dev -w frontend     # Vite en :5173
npm run lint                # ESLint flat, todos los workspaces
npm run typecheck           # tsc --noEmit
npm run test                # Vitest
npm run test -w backend -- src/application/plan/create-plan.use-case.test.ts  # un archivo
npm run test -w backend -- -t "recalcula"                                     # por nombre
npm run build               # backend tsc + frontend vite build
npm run db:migrate -w backend       # prisma migrate dev (requiere DIRECT_URL)
npm run db:deploy -w backend        # prisma migrate deploy
npm run db:seed -w backend
```

Orden de verificación antes de decir "listo": `lint → typecheck → test → build`.
Estos scripts **aún no existen**; al crear el scaffold, respeta exactamente estos nombres. Los de
Prisma son scripts npm (`npm exec -w backend -- prisma ...`); `npx prisma ... -w backend` no funciona.

## Estructura y regla de dependencia

```
backend/src/
  domain/          # entidades, value objects, puertos (interfaces), errores de dominio
  application/     # casos de uso, DTOs, transacciones; sin Express ni Prisma
  infrastructure/  # adaptadores: Prisma, Gemini, catálogo, hashing, tokens, logger
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
- Módulos (bounded contexts): `identity`, `catalog`, `planning`, `ai`. `planning` puede usar `catalog`
  y `ai`; `catalog` no conoce `planning`; `identity` no conoce a nadie.

## Invariantes de dominio (romperlas es un bug)

- Dinero = entero en unidades menores + moneda ISO-4217. **Cero floats** para precios; formatear solo en presentación.
- El modelo de IA **nunca** produce precios ni nombres finales: devuelve `catalogItemId` + día + horario.
  El servidor valida el ID contra el shortlist y recalcula todo desde la BD.
- Un `Plan` nace `DRAFT`; `PUBLISHED` es de solo lectura (duplicar para editar). Un plan = una moneda.
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
  Mezclarlos produce errores de prepared statements.
- Prisma no soporta transacciones interactivas largas sobre el pooler en modo transaction; mantenerlas cortas.
- COP no usa decimales en la práctica, pero se almacena en unidades menores igual que el resto.
- El mapa no debe renderizarse en SSR; Leaflet requiere `window` y se carga solo en cliente.
- `packages/shared` no puede importar nada de `backend/` ni `frontend/` (evita ciclos).
