# Despliegue — Supabase, backend y Vercel

Guía para llevar Trazo de local a producción. Cubre la base de datos en Supabase, las migraciones,
el seed, el hosting del backend y el despliegue del SPA en Vercel.

> **Estado (2026-11-08):** las 5 migraciones ya están aplicadas en Supabase y el seed está cargado
> (1 admin, 7 destinos, 14 hoteles, 28 actividades y 15 transportes). El backend está listo para que
> el frontend consuma la API. Las imágenes de los 7 destinos ya están versionadas como WebP local y
> se muestran desde `frontend/public/images/destinations/`; al correr el seed con Storage se suben al
> bucket `catalog`. El `frontend/` implementa login,
> guards, cliente API con refresh, landing, catálogo, intake, workspace del plan, dashboard y
> administración del equipo.

---

## 1. Topología recomendada

| Componente | Plataforma | Motivo |
|---|---|---|
| Base de datos | **Supabase** (Postgres) | Postgres administrado, backups y pooler |
| API (Express + Prisma) | **Render / Railway / Fly.io** | Proceso Node persistente: el runner de generación es in-process y Prisma mantiene un pool estable |
| SPA (Vite + React) | **Vercel** | Build estático, CDN y rewrites hacia la API |

El SPA vive en Vercel y proxya `/api/*` hacia el backend. Así el navegador ve **un solo origen**, la
cookie `HttpOnly; SameSite=Strict` del refresh funciona y no hace falta CORS cross-site.

```text
Navegador
  └─ https://trazo.vercel.app
       ├─ /              → SPA estático (Vercel)
       └─ /api/v1/*      → rewrite a https://trazo-api.onrender.com/api/v1/*
                              └─ Supabase Postgres (pooler :6543)
```

### 1.1 ¿Por qué no todo en Vercel?

Vercel Functions es serverless: la invocación puede congelarse o terminar al enviar la respuesta. El
código actual responde `202` y ejecuta el job en el event loop
(`InProcessGenerationRunner.run()` no bloquea la respuesta). En Vercel eso deja el `AiJob` en
`QUEUED`/`RUNNING` y la `TripRequest` atascada en `GENERATING`.

Además:

- La función tiene un límite de duración; Gemini puede tardar hasta `AI_TIMEOUT_MS` (45 s) más un
  reintento.
- Cada instancia serverless abre su propio pool de Prisma; el free tier de Supabase limita conexiones.
- Los rate limits en memoria no se comparten entre instancias.

**Conclusión:** hoy el backend no es serverless-ready. Para desplegarlo en Vercel habría que implementar
una cola/worker real (o `waitUntil` + límites de duración) y un almacenamiento compartido de rate limits;
eso es un cambio de arquitectura, no de configuración. Usa un host persistente para la API y Vercel para
el SPA.

### 1.2 Orden de despliegue

1. **Supabase** (ya está): migraciones aplicadas y seed cargado. Para una base nueva,
   `npm run db:deploy -w backend` y `npm run db:seed -w backend`.
2. **Backend** en Render/Railway/Fly: variables de entorno, build con Prisma generate, health check
   `/health`. Anota la URL pública (`https://<api>.onrender.com`).
3. **Frontend** en Vercel: build de `@trazo/shared` + `frontend`, output `frontend/dist`, `vercel.json`
   con el rewrite `/api/:path*` hacia la URL del backend y fallback a `/index.html`.
4. **Probar el circuito completo** desde la URL de Vercel: login, recarga (refresh), `/health/ready`,
   generación y descarga de PDF/CSV.
5. Recién entonces compartir la URL con el equipo. No hace falta correr migraciones en cada deploy.

---

## 2. Supabase

### 2.1 Crear el proyecto

1. Entra a [supabase.com](https://supabase.com) y crea un proyecto.
2. Guarda la contraseña de la base de datos en un gestor de secretos.
3. En **Project Settings → Database → Connection string** copia las dos cadenas:
   - **Transaction pooler** (`:6543`) para el runtime.
   - **Session pooler** o **Direct connection** (`:5432`) para migraciones y seed.

### 2.2 Variables de conexión

```dotenv
# Runtime: pooler en modo transaction. Prisma necesita pgbouncer=true.
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true

# Migraciones y seed: sesión directa, sin pgbouncer.
DIRECT_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Reglas:

- `DATABASE_URL` **nunca** usa `:5432` en runtime y `DIRECT_URL` **nunca** usa `:6543`.
- Si usas la conexión directa clásica, `DIRECT_URL` puede ser
  `postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres`.
- Codifica la contraseña si tiene caracteres especiales (`@`, `:`, `/`, `#`).
- No pongas estas cadenas en el frontend ni en `packages/shared`.

---

## 3. Migraciones y seed

Se ejecutan **desde tu máquina o CI**, nunca desde el runtime del backend ni desde una función
serverless.

### 3.1 Preparar el entorno local

```bash
cp .env.example backend/.env
# Edita backend/.env con DATABASE_URL, DIRECT_URL, JWT_ACCESS_SECRET,
# ADMIN_EMAIL y ADMIN_PASSWORD reales.
```

Genera un secreto de JWT:

```bash
openssl rand -base64 48
```

### 3.2 Aplicar migraciones

```bash
npm ci
npm run db:generate -w backend
npm run db:deploy -w backend
```

`db:deploy` ejecuta `prisma migrate deploy` contra `DIRECT_URL` y aplica, en orden:

1. `0001_init`
2. `0002_catalog_search`
3. `0003_trip_request_adults_nullable`
4. `0004_plan_saved_margin_image` (`SAVED`, margen 0–100 e `image_url` del ítem)
5. `0005_transport_image` (`image_url` de transporte)

No uses `npm run db:migrate` contra Supabase: `prisma migrate dev` crea una *shadow database* y falla en
planes gratuitos. `db:migrate` es solo para desarrollo local.

### 3.3 Sembrar admin y catálogo

```bash
npm run db:seed -w backend
```

El seed es idempotente (upserts) y usa `DIRECT_URL`. Requiere `ADMIN_EMAIL` y `ADMIN_PASSWORD` (mínimo
12 caracteres). Crea:

- Un usuario `ADMIN`.
- Destinos de Colombia (Cartagena, Eje Cafetero, Medellín, San Andrés, Santa Marta).
- Hoteles, actividades y transporte de ejemplo.

> Cambia la contraseña del admin después del primer login y no reutilices la de desarrollo.

### 3.4 Imágenes y Supabase Storage

El bucket público es `catalog`. El seed crea el bucket si no existe y sube los WebP locales de
`backend/prisma/assets/catalog/` con `x-upsert: true`; la base guarda solo la URL pública. Si
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` no están configurados o falta el archivo local, el seed
deja la URL en `null`; el SPA usa las fotos locales de `frontend/public/images/destinations/` y las
hereda para hoteles, actividades y transporte cuando no hay asset específico. Las 7 fotos actuales
de destinos ya están versionadas en ambas carpetas.

```dotenv
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role>
SUPABASE_STORAGE_BUCKET=catalog
```

Rutas de los archivos:

```text
destinations/<slug>.webp
hotels/<destino>/<hotel>.webp
activities/<destino>/<actividad>.webp
transport/<destino>/<modo>-<proveedor>.webp
```

La `service_role` **solo** vive en el backend. El frontend nunca habla con Supabase ni recibe esa
clave; consume `imageUrl` / `heroImageUrl` desde la API.

### 3.5 Verificar

```bash
npm exec -w backend -- prisma migrate status
```

En **Supabase → Table Editor** deben existir, como mínimo:

`users`, `refresh_tokens`, `destinations`, `hotels`, `activities`, `transport_options`,
`trip_requests`, `plans`, `plan_days`, `plan_items`, `ai_jobs`.

En **SQL Editor**:

```sql
select count(*) from destinations; -- >= 5
select count(*) from hotels;       -- >= 8
select count(*) from activities;   -- >= 20
```

---

## 4. Backend en Render / Railway / Fly.io

Los tres funcionan igual: build desde el monorepo, proceso Node persistente y variables de entorno.
Ejemplo con Render:

### 4.1 Configuración del servicio

| Campo | Valor |
|---|---|
| Repository | `https://github.com/SamSof28/Trazo.git` |
| Branch | `main` |
| Runtime | Node 22 |
| Root Directory | raíz del repo (donde está `package.json`) |
| Build Command | `npm ci --include=dev && npm run db:generate -w backend && npm run build -w @trazo/shared && npm run build -w backend` |
| Start Command | `npm run start -w backend` |
| Health Check Path | `/health` |
| Auto-Deploy | solo si el equipo lo autoriza |

Los dos builds compilan `packages/shared` y el backend a `backend/dist`; no hace falta compilar el frontend
en Render. El start ejecuta `node dist/server.js`.

### 4.2 Variables de entorno del backend

```dotenv
NODE_ENV=production
# PORT lo inyecta el host; no lo fijes en Render/Railway.
CORS_ORIGINS=https://trazo.vercel.app
TRUST_PROXY=true

DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-1-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.<ref>:<password>@aws-1-us-west-2.pooler.supabase.com:5432/postgres

JWT_ACCESS_SECRET=<openssl rand -base64 48>
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=7
COOKIE_DOMAIN=

AI_PROVIDER=gemini
GEMINI_API_KEY=<api-key-de-google-ai-studio>
GEMINI_MODEL=gemini-3-flash-preview
AI_TIMEOUT_MS=45000

SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role>
SUPABASE_STORAGE_BUCKET=catalog

LOG_LEVEL=info
RATE_LIMIT_ENABLED=true
```

Notas:

- `TRUST_PROXY=true` solo si el host está detrás de su proxy (Render/Railway lo están). Sin esto, el
  rate limit ve la IP del proxy.
- `COOKIE_DOMAIN` se deja vacío cuando el SPA proxya `/api`: la cookie queda host-only del dominio de
  Vercel.
- Si el SPA y la API comparten un dominio padre (`app.ejemplo.com` y `api.ejemplo.com`), puedes usar
  `COOKIE_DOMAIN=.ejemplo.com`. `SameSite=Strict` sigue funcionando porque es el mismo *site*.
- `NODE_ENV=production` activa `Secure` en la cookie de refresh. El SPA **debe** servirse por HTTPS.
- No configures `ADMIN_*` en el runtime si no vas a ejecutar el seed allí; son solo para el seed.
- Si usas el plan gratuito de Render, el servicio se duerme: la primera petición tarda decenas de
  segundos. Despiértalo con `/health/ready` antes de una demo.

### 4.3 Migraciones en el pipeline

No ejecutes `db:deploy` en cada arranque ni en cada request: puede haber condiciones de carrera entre
instancias. Aplícalas una vez desde local/CI antes de desplegar la versión que las necesita. Si el
proveedor ofrece *release command*, úsalo de forma controlada y con una sola instancia.

### 4.4 Logs y salud

- `GET /health` → liveness, no toca la base.
- `GET /health/ready` → ejecuta `SELECT 1`; responde `503` si Supabase no está disponible.
- Los logs son JSON de pino y redactan `authorization`, `cookie`, `password` y `apiKey`. No se loggea
  el prompt completo en producción.

---

## 5. SPA en Vercel

> El SPA ya existe en `frontend/` (React 19 + Vite 7 + Tailwind 4). Esta sección refleja los scripts
> reales del workspace.

### 5.1 Proyecto

| Campo | Valor |
|---|---|
| Framework Preset | Vite |
| Root Directory | raíz del repo (para reutilizar el lockfile del workspace) |
| Install Command | `npm ci --include=dev` |
| Build Command | `npm run build -w @trazo/shared && npm run build -w frontend` |
| Output Directory | `frontend/dist` |
| Node Version | 22.x |

El build de `@trazo/shared` es obligatorio: el frontend importa los tipos y el `loginSchema` desde
`packages/shared/dist`, no desde el código fuente.

### 5.2 Rewrite hacia la API

El SPA debe llamar a `/api/v1/*` en el mismo origen. En el `vercel.json` de la raíz del repo:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://trazo-api.onrender.com/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

La segunda regla es el fallback del SPA: permite entrar directo a `/login`, `/plans/:id` o
`/workspace/:id` sin que Vercel devuelva 404. El orden importa: primero la API, después el fallback.

Con esto:

- El navegador no hace CORS (mismo origen).
- La cookie `HttpOnly; Secure; SameSite=Strict` se guarda para el dominio de Vercel y viaja en
  `POST /api/v1/auth/refresh`.
- El header `Authorization` pasa sin cambios.
- Los PDF y CSV se descargan igual; no necesitan exponer el backend.

**No definas `VITE_API_URL` en Vercel si usas el rewrite.** El cliente usa rutas relativas en el build
de producción (`/api/v1/...`) y `http://localhost:3000` solo en `vite dev`. Si algún día llamas directo
a la API, define `VITE_API_URL=https://trazo-api.onrender.com` (sin `/api/v1`, el cliente lo agrega).

Si en lugar de rewrite llamas directo a la API en otro dominio, el refresh **no funcionará** con
`SameSite=Strict`: el navegador no envía la cookie en peticiones cross-site. No cambies la cookie a
`SameSite=None` sin revisar CSRF y sin volver a probar el flujo completo.

### 5.3 Variables y secretos

- Solo variables `VITE_*` públicas. **Nunca** `GEMINI_API_KEY`, `DATABASE_URL`, `JWT_ACCESS_SECRET` ni
  la `service_role` de Supabase.
- El frontend no habla con Supabase ni con Gemini: todo pasa por la API.
- El access token vive en memoria; el refresh, en cookie `HttpOnly`. Nada de `localStorage`.

### 5.4 Dominios

- Añade el dominio de Vercel a `CORS_ORIGINS` del backend (aunque uses rewrite, el navegador envía
  `Origin` en POST/PATCH).
- Si usas dominio propio, actualiza `CORS_ORIGINS` y el `destination` del rewrite.
- Mantén HTTPS en ambos lados.

---

## 6. Gemini en producción

Checklist:

- [ ] `AI_PROVIDER=gemini`.
- [ ] `GEMINI_API_KEY` válida y con cuota; rotarla si se filtra.
- [ ] `GEMINI_MODEL` confirmado con la cuenta (`gemini-3-flash-preview` verificado el 2026-11-03;
      `gemini-2.5-flash` ya no está disponible para cuentas nuevas).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` solo en el backend; bucket `catalog` público para lectura.
- [ ] `AI_TIMEOUT_MS=45000` o el valor acordado; el host debe permitir respuestas de esa duración.
- [ ] `AI_PROVIDER=mock` sigue pasando `npm run verify` (red de seguridad para tests/demo).
- [ ] Probar un plan de 3 días y verificar que todos los `catalogItemId` existen y que el total sale de
      la base de datos.
- [ ] Probar una key inválida: el job debe quedar `FAILED` con `AI_UNAVAILABLE`, sin filtrar el error
      del proveedor.
- [ ] Probar un prompt con instrucciones maliciosas: el plan debe seguir validando y los precios deben
      salir del catálogo.

Detalle del prompt, grounding y reparación: [`AI.md`](AI.md).

---

## 7. Checklist de seguridad antes de publicar

- [ ] `NODE_ENV=production` y HTTPS en SPA y API.
- [ ] `JWT_ACCESS_SECRET` aleatorio de ≥ 32 bytes; distinto del de desarrollo.
- [ ] `CORS_ORIGINS` con la URL exacta del SPA, sin comodines.
- [ ] `RATE_LIMIT_ENABLED=true`; límites de `/auth/*` y `/generate` activos.
- [ ] `DATABASE_URL` por el pooler y `DIRECT_URL` solo para migraciones.
- [ ] `.env` fuera de git; secretos en el gestor del host.
- [ ] Contraseña del admin cambiada; sin usuarios de prueba activos.
- [ ] Backups/PITR de Supabase activos según el plan contratado.
- [ ] `npm audit` y `npm audit --omit=dev` sin vulnerabilidades high/critical (hoy: 0 en ambos).
- [ ] Logs sin PII ni prompts completos.
- [ ] `npm run verify` en verde en el commit desplegado.

### 7.1 Overrides de seguridad

El `package.json` raíz fija dos overrides para dependencias transitivas que todavía no publican una
versión corregida dentro de la rama que usa el proyecto:

| Override | Advisory | Motivo |
|---|---|---|
| `@prisma/config > deepmerge-ts@8.0.2` | GHSA-ggr8-5vv4-36mx | Prisma 6.19.3 fija `deepmerge-ts@7.1.5`; se fuerza la versión corregida sin migrar a Prisma 7 |
| `minimatch@^11.0.1` | GHSA-g3hv-75wg-m249 | ESLint 10 y TypeScript-ESLint usan `minimatch` 10.x; se fuerza la rama corregida |

Se verificó con `prisma validate`, `prisma generate`, `npm run verify`, `npm audit` y
`npm audit --omit=dev`. Revisar estos overrides al actualizar Prisma, ESLint o TypeScript-ESLint: si
sus dependencias ya aceptan las versiones corregidas, se pueden retirar.

---

## 8. Smoke test de producción

Sustituye `$API` por la URL pública (o por `https://trazo.vercel.app/api/v1` si usas el rewrite).

```bash
# 1. Salud
curl -sS "$API/health"
curl -sS "$API/health/ready"

# 2. Login del admin (guarda la cookie de refresh)
curl -sS -c cookies.txt -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@trazo.co","password":"<password>"}'

# 3. Crear una solicitud completa
curl -sS -b cookies.txt -X POST "$API/trip-requests" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer <accessToken>" \
  -d '{"prompt":"Viaje a Cartagena para 2 adultos, 5 días, presupuesto de 3 millones, con playa"}'

# 4. Generar (202) y consultar el estado
curl -sS -b cookies.txt -X POST "$API/trip-requests/<id>/generate" \
  -H "Authorization: Bearer <accessToken>"
curl -sS -b cookies.txt "$API/trip-requests/<id>" \
  -H "Authorization: Bearer <accessToken>"

# 5. Leer el plan, el reporte y el PDF
curl -sS -b cookies.txt "$API/plans/<planId>" -H "Authorization: Bearer <accessToken>"
curl -sS -b cookies.txt "$API/plans/<planId>/report?format=csv" -H "Authorization: Bearer <accessToken>"
curl -sS -b cookies.txt "$API/plans/<planId>/pdf" -H "Authorization: Bearer <accessToken>" -o plan.pdf
```

Resultado esperado: `/health/ready` → `{"status":"ready"}`; la solicitud pasa de `READY` a
`GENERATING` y luego a `GENERATED` con `planId`; el plan trae días, ítems y presupuesto; el PDF abre.

Si el job queda `FAILED`, revisa `errorCode`:

| Código | Causa probable |
|---|---|
| `AI_UNAVAILABLE` | Key/cuota/timeout de Gemini, o red del host |
| `AI_INVALID_OUTPUT` | El modelo no devolvió JSON válido tras una reparación |
| `VALIDATION_ERROR` | Catálogo insuficiente para el destino/fechas/moneda |
| `INTERNAL_ERROR` | Error inesperado; revisar logs del backend |

---

## 9. Operación y rollback

- **Migraciones forward-only:** no uses `prisma migrate reset` en producción. Si una migración falla,
  corrige con una nueva migración.
- **Backup antes de migrar:** usa el backup/PITR de Supabase o `pg_dump` con `DIRECT_URL`.
- **Rollback de aplicación:** vuelve a desplegar el commit anterior en el host; si la migración ya se
  aplicó, confirma que sea compatible hacia atrás.
- **Jobs atascados:** si el proceso muere a mitad de una generación, el `AiJob` puede quedar `RUNNING` y
  la solicitud `GENERATING`. Revisa `ai_jobs` y, si es seguro, marca el job `FAILED` y la solicitud
  `FAILED` para permitir reintento. No hay recuperación automática en el MVP.
- **Rate limits en memoria:** se reinician al reiniciar el proceso y no se comparten entre instancias.
  Para multi-instancia hace falta un store compartido (Redis) y una cola real.
- **Escalado:** el runner in-process es suficiente para una instancia. Antes de escalar horizontalmente,
  mueve la generación a un worker/cola y saca los rate limits a un store compartido.

---

## 10. Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| `prepared statement already exists` | `DATABASE_URL` apunta a `:5432` o falta `?pgbouncer=true` |
| `shadow database` al migrar | Usaste `db:migrate`; usa `db:deploy` con `DIRECT_URL` |
| `P1001` / timeout | Supabase pausado, IP restringida o cadena mal codificada |
| Login OK pero refresh falla | SPA y API en dominios distintos sin rewrite; usa el proxy de Vercel o un dominio padre |
| Cookie no se guarda | `NODE_ENV` no es `production` en HTTPS, o el navegador bloquea terceros |
| `429` en `/generate` | Límite de 10/h/usuario; espera o ajusta el límite con criterio |
| Generación atascada en `GENERATING` | Host serverless o proceso reiniciado; revisa `ai_jobs` |
| PDF/CSV vacío | Falta el header `Authorization`; el endpoint no es público |
| CORS bloqueado | `CORS_ORIGINS` no incluye el origen exacto del SPA |

---

## 11. Referencias

- Contrato REST: [`API.md`](API.md)
- Mapa del backend y conexión del frontend: [`BACKEND.md`](BACKEND.md)
- Modelo y reglas: [`DOMAIN.md`](DOMAIN.md)
- Gemini y grounding: [`AI.md`](AI.md)
- Variables de entorno: [`../.env.example`](../.env.example)
