# Hoja de ruta — Trazo

Entrega **incremental por rebanadas verticales**. Una fase no empieza hasta que la anterior cumple su
definición de terminado (DoD). Cada rebanada incluye dominio + caso de uso + adaptador + ruta + tests +
docs. No se hace `git commit` sin autorización del usuario.

**Fase actual: 7 — Reportes y endurecimiento (backend completo).** Fases 4–7 implementadas en
backend: generación con IA anclada al catálogo, edición y presupuesto, guardado/publicación/dashboard
API, reportes JSON/CSV y PDF. Quedan pendientes el frontend (1.4, 2.4, 3.3–3.4, 4.5–4.6, 5.3, 6.4),
la disponibilidad de catálogo 2.5 (HU 3.3–3.4), el clima 5.7, el chat de refinamiento 5.8, las pruebas
de carga 7.3 y aplicar migraciones/seed cuando se configure Supabase.

## DoD común

- `npm run lint && npm run typecheck && npm run test && npm run build` en verde.
- Tests nuevos cubren la regla de negocio, no solo el happy path.
- `docs/API.md` y `docs/DOMAIN.md` actualizados si cambió el contrato o el esquema.
- Sin secretos en el repo; `.env.example` actualizado si hay variables nuevas.
- Sin `TODO` sin dueño ni código muerto.

## Fase 0 — Fundación (sin funcionalidad de negocio)

| Rebanada | Entrega | Estado |
|---|---|---|
| 0.1 | Monorepo npm workspaces, `backend/`, `packages/shared/`, TS strict, ESLint flat, Prettier, Vitest. `frontend/` queda para su fase | ✅ |
| 0.2 | `config/env.ts` con Zod, `config/container.ts`, logger pino con redacción, `errorHandler` problem+json, `/health` y `/health/ready` | ✅ |
| 0.3 | `prisma/schema.prisma` con todo el dominio, migración `0001_init` con CHECK constraints, seed de admin | ✅ código; ⏳ aplicar migración/seed con credenciales reales |
| 0.4 | Script `verify` (`lint → typecheck → test → build`) | ✅ |

**DoD:** `npm run dev -w backend` levanta, `/health/ready` responde, la migración aplica en Supabase,
`packages/shared` se importa desde ambos workspaces. El código y los tests están listos; la migración
y el seed se ejecutan cuando el equipo configure `DATABASE_URL`/`DIRECT_URL`.

## Fase 1 — Identidad y acceso

| Rebanada | Entrega | Estado |
|---|---|---|
| 1.1 | `User` + `PasswordHasher` (argon2id) + `POST /auth/login` + test de credenciales | ✅ |
| 1.2 | Access JWT + refresh rotativo con familia y detección de reuso + `/auth/refresh`, `/auth/logout` | ✅ |
| 1.3 | `requireAuth`, `requireRole`, `GET /auth/me`, `POST /users` (ADMIN) | ✅ |
| 1.4 | Frontend: `/login`, guard de rutas, restauración de sesión, cliente HTTP con refresh silencioso | ⏳ |

**DoD:** no existe registro público; un `ADVISOR` no puede crear usuarios; reuso de refresh revoca la
familia; tests de 401/403/429. Backend cumplido (22 tests + 6 de shared); falta la rebanada 1.4.

## Fase 2 — Catálogo

| Rebanada | Entrega | Estado |
|---|---|---|
| 2.1 | `Destination` CRUD (ADMIN) + `GET /catalog/destinations` con búsqueda trigram | ✅ |
| 2.2 | `Hotel` + `Activity` + `TransportOption` con precios en unidades menores y `pricing_unit` | ✅ |
| 2.3 | Seed de Colombia: Cartagena, Eje Cafetero, Medellín, San Andrés, Santa Marta (≥ 8 hoteles, ≥ 20 actividades) | ✅ código; ⏳ ejecutar con credenciales reales |
| 2.4 | Frontend: selector de destino con chips y tarjetas | ⏳ |
| 2.5 | Disponibilidad de catálogo: modelo de cupos/bloqueos, consulta por fechas y explorador con indicador (HU 3.3–3.4) | ⏳ decisión de producto |

**DoD:** precios y monedas consistentes; índices creados; `GET` paginado y filtrable; sin escritura
para `ADVISOR`. Backend cumplido (47 tests de catálogo + 6 de shared, migración `0002_catalog_search`
generada); faltan 2.4, 2.5 y aplicar migraciones/seed cuando el equipo configure Supabase.

## Fase 3 — Intake conversacional (sin IA generativa)

| Rebanada | Entrega | Estado |
|---|---|---|
| 3.1 | `TripRequest` + `POST /trip-requests` + extracción determinista de slots (fechas, personas, días, banda de presupuesto) | ✅ |
| 3.2 | Motor de preguntas con catálogo de chips + `POST /answers` + transición a `READY` | ✅ |
| 3.3 | Frontend: landing con super prompt y chips + transición a workspace split-view | ⏳ |
| 3.4 | Chat con `aria-live`, estado "pensando", historial de mensajes en Zustand | ⏳ |

**DoD:** un prompt incompleto nunca falla; máx. 2 preguntas por turno; `missingFields` correcto;
tests de extracción con ≥ 10 prompts reales. Backend cumplido: 3.1–3.2 implementados, migración
`0003_trip_request_adults_nullable`; la suite completa suma 124 tests de backend. Faltan las
rebanadas de frontend 3.3–3.4.

## Fase 4 — Generación con IA anclada al catálogo

| Rebanada | Entrega | Estado |
|---|---|---|
| 4.1 | `AiPlannerPort` + `PromptBuilder` + `PlanOutputValidator` (Zod) + adaptador `mock` determinista | ✅ |
| 4.2 | Adaptador Gemini con JSON schema, timeout, 1 reparación, métricas de tokens/latencia | ✅ |
| 4.3 | `GeneratePlanUseCase`: shortlist → IA → validación de IDs → recálculo → `Plan DRAFT` | ✅ |
| 4.4 | `ai_jobs` + worker in-process + `POST /generate` (202) + polling | ✅ |
| 4.5 | Frontend: mapa Leaflet con pines de precio + carrusel "Destinos para ti" + timeline por días | ⏳ |
| 4.6 | Progreso por etapas en UI (HU 1.4): interpretando → consultando catálogo → armando itinerario → calculando presupuesto | ⏳ |
| 4.7 | Validación de disponibilidad del shortlist antes de generar (HU 3.4); un ítem no disponible se descarta o sustituye | ⏳ depende de 2.5 |

**DoD:** ningún precio proviene del modelo; IDs inválidos se descartan sin romper el plan; timeout
produce `FAILED` recuperable; el modo `mock` corre los tests sin red; `AI_PROVIDER=mock` funciona en
demo; ninguna generación incluye ítems no disponibles.

## Fase 5 — Edición y presupuesto

| Rebanada | Entrega | Estado |
|---|---|---|
| 5.1 | `GET /plans/:id/alternatives` (mismo tipo/destino/moneda, 3 opciones) | ✅ |
| 5.2 | `PATCH /plans/:id/items/:itemId` + recálculo transaccional + snapshot | ✅ |
| 5.3 | Frontend: modal de alternativas, actualización optimista con rollback, tarjeta sticky de costos | ⏳ |
| 5.4 | Subtotal por día en el timeline y en el resumen (HU 2.4) | ✅ API (`PlanDayDto.subtotal`) |
| 5.5 | Edición manual de ítems: agregar, quitar, reordenar y ajustar horarios/cantidades (HU 2.5) | ✅ |
| 5.6 | Margen 0–100 % + migración del CHECK `plans.margin_percent` (HU 2.9) | ✅ migración `0004` |
| 5.7 | Clima por día para destino y fechas (HU 2.6); si el proveedor falla, el plan se muestra sin clima | ⏳ proveedor por decidir |
| 5.8 | Chat de refinamiento conversacional sobre el plan editable (HU 1.3) | ⏳ |

**DoD:** el total del cliente coincide con el del servidor; `PUBLISHED` rechaza edición con `409`;
test de redondeo de margen; la suma de subtotales diarios coincide con `plan.subtotal`; el clima es
solo informativo y su fallo no bloquea el plan.

## Fase 6 — Guardado, publicación y dashboard

| Rebanada | Entrega | Estado |
|---|---|---|
| 6.1 | `PATCH /plans/:id` (título, resumen, tags) + validaciones | ✅ |
| 6.2 | `POST /publish`, `/archive`, `/duplicate` + reglas INV-07/08 | ✅ |
| 6.3 | `GET /plans` con filtros (`status`, `q`, `destinationId`) y paginación | ✅ |
| 6.4 | Frontend: dashboard con filtros, reapertura de plan, confirmación de publicación | ⏳ |
| 6.5 | Estado `SAVED` editable: migración del enum y reglas de reapertura (HU 2.7) | ✅ |

**DoD:** publicar sin título o sin ítems devuelve `422`; duplicar crea `DRAFT` con `version + 1`;
un asesor no ve planes ajenos; `SAVED` se puede editar y `PUBLISHED` sigue inmutable.

## Fase 7 — Reportes y endurecimiento

| Rebanada | Entrega | Estado |
|---|---|---|
| 7.1 | `GET /plans/:id/report` (JSON/CSV) con desglose por categoría y día | ✅ |
| 7.2 | Rate limits definitivos, auditoría de dependencias, revisión de logs sin PII | 🟡 rate limits y logs listos; auditoría pendiente |
| 7.3 | Pruebas de carga básicas en `/generate` y `/plans` | ⏳ |
| 7.4 | Documento de despliegue (Supabase + hosting del backend y del SPA) | ✅ [`DEPLOYMENT.md`](DEPLOYMENT.md) |
| 7.5 | Exportación PDF del plan (HU 2.8): portada, itinerario, ítems y totales | ✅ |

**DoD:** reporte cuadra con el presupuesto; `npm audit` sin high/critical; checklist de seguridad de
`AGENTS.md` completo; el PDF se genera desde el plan persistido y no recalcula precios en el cliente.

## Trazabilidad historias → fases

| HU | Fase |
|---|---|
| 1.1 Super prompt | 3.3 |
| 1.2 Completitud dinámica | 3.1–3.2 |
| 1.3 Refinamiento conversacional | 5.8 |
| 1.4 Progreso por etapas | 4.6 |
| 2.1 Ficha y resumen | 4.5, 5.3 |
| 2.2 Itinerario por días | 4.5 |
| 2.3 Alternativas | 5.1–5.3 |
| 2.4 Subtotal por día | 5.4 |
| 2.5 Edición manual de ítems | 5.5 |
| 2.6 Clima | 5.7 |
| 2.7 Estado `SAVED` editable | 6.5 |
| 2.8 Exportación PDF | 7.5 |
| 2.9 Margen 0–100 | 5.6 |
| 3.1 Catálogo real | 2.x, 4.1–4.3 |
| 3.2 Guardado y publicación | 6.x |
| 3.3 Explorador con disponibilidad | 2.5 |
| 3.4 Validación de disponibilidad | 2.5, 4.7 |

## Riesgos abiertos

- **Costo/latencia de Gemini:** mitigado con shortlist, timeout y modo mock; medir tokens por generación.
- **Calidad del catálogo semilla:** sin datos reales el itinerario se ve pobre; invertir en el seed (2.3).
- **Supabase free tier:** límite de conexiones; usar pooler y mantener transacciones cortas.
- **Modelo de disponibilidad:** falta decidir si se modela como cupos por fecha, bloqueos o ambos;
  afecta catálogo, generación y edición. No implementar 2.5 sin esa decisión.
- **Clima:** proveedor, cobertura de Colombia y caché por decidir; debe degradar sin bloquear el plan.
- **Etapas de generación:** definir si el progreso por etapas se persiste en `ai_jobs` o queda solo
  como estado de UI; hoy la decisión es UI, no persistido.
- **Runner in-process:** suficiente para una instancia; multi-instancia exige cola/worker y rate limits
  compartidos (ver [`DEPLOYMENT.md`](DEPLOYMENT.md#11-por-qué-no-todo-en-vercel)).
- **Alcance del curso:** si el tiempo aprieta, 7.3 (pruebas de carga) y la auditoría de 7.2 son
  recortables; el backend de 1–6 y el despliegue son el MVP.
