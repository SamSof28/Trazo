# Hoja de ruta — TuriViajes

Entrega **incremental por rebanadas verticales**. Una fase no empieza hasta que la anterior cumple su
definición de terminado (DoD). Cada rebanada incluye dominio + caso de uso + adaptador + ruta + tests +
docs. No se hace `git commit` sin autorización del usuario.

**Fase actual: 0 — Fundación. Siguiente rebanada: 0.1 (scaffold del monorepo).**

## DoD común

- `npm run lint && npm run typecheck && npm run test && npm run build` en verde.
- Tests nuevos cubren la regla de negocio, no solo el happy path.
- `docs/API.md` y `docs/DOMAIN.md` actualizados si cambió el contrato o el esquema.
- Sin secretos en el repo; `.env.example` actualizado si hay variables nuevas.
- Sin `TODO` sin dueño ni código muerto.

## Fase 0 — Fundación (sin funcionalidad de negocio)

| Rebanada | Entrega |
|---|---|
| 0.1 | Monorepo npm workspaces, `backend/`, `frontend/`, `packages/shared/`, TS strict, ESLint flat, Prettier, Vitest |
| 0.2 | `config/env.ts` con Zod, `config/container.ts`, logger pino con redacción, `errorHandler` problem+json, `/health` |
| 0.3 | `prisma/schema.prisma` con `users` + `refresh_tokens`, migración inicial, seed de admin |
| 0.4 | CI local: script `verify` (`lint → typecheck → test → build`) |

**DoD:** `npm run dev -w backend` levanta, `/health/ready` responde, la migración aplica en Supabase,
`packages/shared` se importa desde ambos workspaces.

## Fase 1 — Identidad y acceso

| Rebanada | Entrega |
|---|---|
| 1.1 | `User` + `PasswordHasher` (argon2id) + `POST /auth/login` + test de credenciales |
| 1.2 | Access JWT + refresh rotativo con familia y detección de reuso + `/auth/refresh`, `/auth/logout` |
| 1.3 | `requireAuth`, `requireRole`, `GET /auth/me`, `POST /users` (ADMIN) |
| 1.4 | Frontend: `/login`, guard de rutas, restauración de sesión, cliente HTTP con refresh silencioso |

**DoD:** no existe registro público; un `ADVISOR` no puede crear usuarios; reuso de refresh revoca la
familia; tests de 401/403/429.

## Fase 2 — Catálogo

| Rebanada | Entrega |
|---|---|
| 2.1 | `Destination` CRUD (ADMIN) + `GET /catalog/destinations` con búsqueda trigram |
| 2.2 | `Hotel` + `Activity` + `TransportOption` con precios en unidades menores y `pricing_unit` |
| 2.3 | Seed de Colombia: Cartagena, Eje Cafetero, Medellín, San Andrés, Santa Marta (≥ 8 hoteles, ≥ 20 actividades) |
| 2.4 | Frontend: selector de destino con chips y tarjetas |

**DoD:** precios y monedas consistentes; índices creados; `GET` paginado y filtrable; sin escritura
para `ADVISOR`.

## Fase 3 — Intake conversacional (sin IA generativa)

| Rebanada | Entrega |
|---|---|
| 3.1 | `TripRequest` + `POST /trip-requests` + extracción determinista de slots (fechas, personas, días, banda de presupuesto) |
| 3.2 | Motor de preguntas con catálogo de chips + `POST /answers` + transición a `READY` |
| 3.3 | Frontend: landing con super prompt y chips + transición a workspace split-view |
| 3.4 | Chat con `aria-live`, estado "pensando", historial de mensajes en Zustand |

**DoD:** un prompt incompleto nunca falla; máx. 2 preguntas por turno; `missingFields` correcto;
tests de extracción con ≥ 10 prompts reales.

## Fase 4 — Generación con IA anclada al catálogo

| Rebanada | Entrega |
|---|---|
| 4.1 | `AiPlannerPort` + `PromptBuilder` + `PlanOutputValidator` (Zod) + adaptador `mock` determinista |
| 4.2 | Adaptador Gemini con JSON schema, timeout, 1 reparación, métricas de tokens/latencia |
| 4.3 | `GeneratePlanUseCase`: shortlist → IA → validación de IDs → recálculo → `Plan DRAFT` |
| 4.4 | `ai_jobs` + worker in-process + `POST /generate` (202) + polling |
| 4.5 | Frontend: mapa Leaflet con pines de precio + carrusel "Destinos para ti" + timeline por días |

**DoD:** ningún precio proviene del modelo; IDs inválidos se descartan sin romper el plan; timeout
produce `FAILED` recuperable; el modo `mock` corre los tests sin red; `AI_PROVIDER=mock` funciona en demo.

## Fase 5 — Edición y presupuesto

| Rebanada | Entrega |
|---|---|
| 5.1 | `GET /plans/:id/alternatives` (mismo tipo/destino/moneda, 3 opciones) |
| 5.2 | `PATCH /plans/:id/items/:itemId` + recálculo transaccional + snapshot |
| 5.3 | Frontend: modal de alternativas, actualización optimista con rollback, tarjeta sticky de costos |

**DoD:** el total del cliente coincide con el del servidor; `PUBLISHED` rechaza edición con `409`;
test de redondeo de margen.

## Fase 6 — Guardado, publicación y dashboard

| Rebanada | Entrega |
|---|---|
| 6.1 | `PATCH /plans/:id` (título, resumen, tags) + validaciones |
| 6.2 | `POST /publish`, `/archive`, `/duplicate` + reglas INV-07/08 |
| 6.3 | `GET /plans` con filtros (`status`, `q`, `destinationId`) y paginación |
| 6.4 | Frontend: dashboard con filtros, reapertura de plan, confirmación de publicación |

**DoD:** publicar sin título o sin ítems devuelve `422`; duplicar crea `DRAFT` con `version + 1`;
un asesor no ve planes ajenos.

## Fase 7 — Reportes y endurecimiento

| Rebanada | Entrega |
|---|---|
| 7.1 | `GET /plans/:id/report` (JSON/CSV) con desglose por categoría y día |
| 7.2 | Rate limits definitivos, auditoría de dependencias, revisión de logs sin PII |
| 7.3 | Pruebas de carga básicas en `/generate` y `/plans` |
| 7.4 | Documento de despliegue (Supabase + hosting del backend y del SPA) |

**DoD:** reporte cuadra con el presupuesto; `npm audit` sin high/critical; checklist de seguridad de
`AGENTS.md` completo.

## Trazabilidad historias → fases

| HU | Fase |
|---|---|
| 1.1 Super prompt | 3.3 |
| 1.2 Completitud dinámica | 3.1–3.2 |
| 2.1 Ficha y resumen | 4.5, 5.3 |
| 2.2 Itinerario por días | 4.5 |
| 2.3 Alternativas | 5.1–5.3 |
| 3.1 Catálogo real | 2.x, 4.1–4.3 |
| 3.2 Guardado y publicación | 6.x |

## Riesgos abiertos

- **Costo/latencia de Gemini:** mitigado con shortlist, timeout y modo mock; medir tokens por generación.
- **Calidad del catálogo semilla:** sin datos reales el itinerario se ve pobre; invertir en el seed (2.3).
- **Supabase free tier:** límite de conexiones; usar pooler y mantener transacciones cortas.
- **Alcance del curso:** si el tiempo aprieta, 7.3 y 7.4 son recortables; 1–6 son el MVP.
