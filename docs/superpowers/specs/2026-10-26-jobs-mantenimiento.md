# Spec — Core: trabajos programados y mantenimiento (sprint 04, task 07)

**Fecha:** 2026-10-26
**Estado:** Borrador para aprobación del usuario
**Base:** [spec de realtime](2026-10-26-realtime-notificaciones.md) (task-04: `event_outbox`, entrega at-least-once y hooks) · [spec de MCP](2026-10-26-mcp.md) (task-05: `idempotency_keys`, TTL) · [spec de datos](2026-10-26-core-data-model.md) (task-01: `audit`, `invitations`, `api_keys`, `devices`) · [spec de API del Core](2026-10-26-core-api.md) (task-02: rate limiting, `/health`) · [spec de tokens §6](2026-10-25-token-model.md) (contadores agregados) · [spec de config](2026-10-26-instance-config.md) (task-06: `settings`) · [ADR 0004](../../adr/0004-bordes-y-capa-de-aplicacion.md) · [ADR 0007](../../adr/0007-manejo-de-errores.md)
**Decide el usuario:** modelo híbrido de ejecución, auth del endpoint, retenciones y estado en el panel (2026-10-26)

## 1. Objetivo

Definir **qué mantenimiento necesita la instancia**, **dónde y con qué frecuencia se ejecuta en free tier**, cómo se autentica, cómo se evita que dos ejecuciones se pisen, y cómo se detecta que algo se ha atascado.

**Principio rector**: el mantenimiento **no es crítico para el camino de escritura**. Lo importante (publicar un evento, enviar un push) ocurre **tras el commit** en la petición; los jobs son **la red de seguridad**.

**Fuera de alcance**: backups de la base de datos y keep-alive del proyecto Supabase (son de infraestructura, con sus propias tareas); aquí solo el mantenimiento **del propio Core**.

## 2. Inventario de jobs

| Job | Qué hace | Mecanismo | Frecuencia | Retención |
|---|---|---|---|---|
| `outbox.retry` | Reintenta `event_outbox` en `pending` con `next_attempt_at <= now()` (backoff exponencial) y re-despacha hooks/push no aplicados | **App** (endpoint) | inline tras commit + **lazy** + horario | — |
| `outbox.purge` | Borra `published` > 7 días y `failed` > 30 días | `pg_cron` (SQL) | diaria 03:17 UTC | 7 / 30 días |
| `idempotency.purge` | Borra `idempotency_keys` con `expires_at < now()` | `pg_cron` | horaria | 24 h (TTL) |
| `audit.roll` | Cierra ventanas abiertas de `audit` (`window_end`), agrega y borra ventanas > 90 días | `pg_cron` | horaria | 90 días |
| `invitations.purge` | Borra invitaciones caducadas o usadas hace > 30 días | `pg_cron` | diaria 03:27 UTC | 30 días |
| `api_keys.purge` | Borra claves revocadas/caducadas hace > 90 días (con su `audit` asociado) | `pg_cron` | diaria 03:37 UTC | 90 días |
| `rate_limit.purge` | Borra contadores de rate limit expirados (solo si el almacén es tabla) | `pg_cron` | diaria 03:47 UTC | ventana |
| `maintenance.purge` | Borra `maintenance_runs` > 90 días | `pg_cron` | diaria 03:57 UTC | 90 días |
| `health.evaluate` | Calcula el estado (`ok`/`degraded`) para `/health` | App (en la petición) | por petición | — |

**Idempotencia**: todos los jobs son **idempotentes por diseño** (reintentar un `outbox.retry` no duplica un evento ni un hook: task-04 §5bis; un `purge` repetido no cambia el resultado).

## 3. Modelo de ejecución (híbrido, free tier)

### 3.1 Primario: inline
El despacho del outbox ocurre **tras el commit** de cada caso de uso (task-04). No depende de ningún cron.

### 3.2 Red de seguridad en tres capas

| Capa | Qué cubre | Coste |
|---|---|---|
| **Lazy sweep** | Si hay tráfico, los reintentos ocurren solos: en una petición autenticada, si han pasado > 5 min desde el último barrido **de ese proceso** y hay `pending` vencidos, se lanza un barrido **en segundo plano** (no bloquea la respuesta) | 1 consulta barata cada ≥5 min |
| **`pg_cron`** | Todo lo que es **SQL puro** (purgas, cierre de ventanas) | gratis, dentro de Supabase |
| **GitHub Actions horario** | `outbox.retry` cuando nadie usa la app (necesita HTTP: Realtime + FCM) | gratis en repo público |

- **`pg_cron` no puede** publicar realtime ni enviar push (eso es HTTP): por eso los jobs de app van por el endpoint.
- **Vercel Cron** se descarta para reintentos (Hobby = 1/día).
- **Lazy sweep**: el "último barrido" se guarda **en memoria del proceso** (no una escritura por petición); el barrido real escribe en `maintenance_runs`.

### 3.3 Endpoint de mantenimiento

`POST /api/v1/maintenance/run` (delta a task-02 §3.10):

- **Auth**: **clave de instancia** (`027_svc_`) con scope **`maintenance:run`**. Una clave delegada → `403`.
- **Solo jobs de app**: `outbox.retry` (y los que se añadan al catálogo). **No** ejecuta acciones de negocio ni DDL.
- **Exclusión mutua**: `pg_try_advisory_lock(hashtext('core_maintenance'))`; si no se obtiene → **`409 conflict`** con `retry_after` (otra ejecución en curso).
- **Cuerpo opcional**: `{ "jobs": ["outbox.retry"] }`; por defecto ejecuta **todos** los jobs de app.
- **Respuesta**: `{ run_id, jobs: [{ name, status, processed, failed, duration_ms }], started_at, finished_at }`.
- **Registro**: `maintenance_runs` (delta a task-01) con `run_id`, `job`, `status`, `summary`, `started_at`, `finished_at`.
- **Rate limiting**: excluido del cupo del usuario (es máquina-a-máquina), protegido por clave + lock.

`GET /api/v1/maintenance/status` (`maintenance:read`, `is_super_admin()`): última ejecución por job, contadores de outbox por estado, ventanas de auditoría abiertas y **estado de salud**.

### 3.4 GitHub Actions (cuando se implemente)

- Workflow `maintenance.yml`, **horario**, que hace `POST /maintenance/run` con la URL y la clave (`MAINTENANCE_URL` + `MAINTENANCE_API_KEY` en **GitHub Secrets**; nunca en el repo).
- La clave usada debe tener **solo** scopes `maintenance:run` (mínimo privilegio) y ser revocable.
- `docs/flows/cicd.md` se actualiza **en el PR que implemente el workflow** (añadir el job a la tabla y a la degradación elegante en forks sin secrets).

## 4. Salud (`/health`)

`GET /api/v1/health` (api-v1 §4) devuelve `ok` | `degraded`:

| Condición | Estado |
|---|---|
| Supabase inaccesible o migraciones no aplicadas | `degraded` |
| `event_outbox` con `pending` **más antiguo de 1 h** | `degraded` |
| `event_outbox.failed` con `created_at` en las últimas 24 h | `degraded` |
| Último `outbox.retry` hace > 6 h **y** hay pendientes | `degraded` |
| Resto | `ok` |

- El **keep-alive** de infraestructura (`PROD_URL`) ya usa `/health`: con esto, un outbox atascado también dispara la señal.
- El estado **no** incluye detalles internos en la respuesta pública: solo `status` (los contadores van en `GET /maintenance/status`, autenticado).

## 5. Retenciones (resumen)

| Dato | Retención | Motivo |
|---|---|---|
| `event_outbox` publicado | **7 días** | permite diagnosticar un evento reciente |
| `event_outbox` fallido | **30 días** | investigar fallos persistentes |
| `idempotency_keys` | **24 h** (TTL) | cubre reintentos de agentes; evita relleno |
| `audit` (ventanas) | **90 días** | traza de uso sin crecer sin límite |
| `invitations` caducadas/usadas | **30 días** | trazabilidad breve |
| `api_keys` revocadas/caducadas | **90 días** | auditoría de claves |
| `maintenance_runs` | **90 días** | historial operativo |
| contadores de rate limit | ventana | efímeros |

## 6. Decisiones tomadas (conversación de diseño, 2026-10-26)

| # | Decisión |
|---|---|
| A | **Modelo híbrido**: despacho inline tras el commit (primario) + **lazy sweep** al recibir tráfico + **`pg_cron`** para SQL puro + **GitHub Actions horario** para lo que necesita HTTP. Sin depender de una sola pieza y sin coste |
| B | **Punto de entrada único**: `POST /api/v1/maintenance/run` (jobs de app) y `GET /api/v1/maintenance/status` (estado); ni acciones de negocio ni DDL |
| C | **Auth de mantenimiento**: clave de instancia `027_svc_` con scope **`maintenance:run`**; clave delegada → 403; estado solo `is_super_admin()` + `maintenance:read` |
| D | **Exclusión mutua**: `pg_try_advisory_lock`; si concurre → 409 con `retry_after` |
| E | **Retenciones**: outbox publicado 7 d · fallido 30 d · `idempotency_keys` 24 h · `audit` 90 d · invitaciones 30 d · claves 90 d · `maintenance_runs` 90 d |
| F | **`/health` observa el outbox**: `degraded` si hay pendientes > 1 h, fallos recientes o barrido atrasado con pendientes; sin detalles públicos |
| G | **El panel mostrará el estado** de los jobs (task-12) a partir de `GET /maintenance/status` |
| H | **`cicd.md` se actualiza en el PR que implemente** `maintenance.yml` (tabla de jobs + degradación en forks sin secrets) |

## 7. Fuera de alcance

- **Backups de la base de datos** y su retención → operación de infraestructura (runbook + tarea propia).
- **Keep-alive del proyecto Supabase** → `docs/flows/cicd.md` + `sprint-infra` task-07 (`PROD_URL`).
- **Rotación de la clave maestra de secretos** → `sprint-infra` task-09.
- **UI del panel de mantenimiento** → sprint-web (task-12); aquí solo el contrato del endpoint de estado.
- **Purga de datos de negocio de los módulos** → la decide cada módulo (el dinero no se borra).

## 8. Criterios de aceptación

- El inventario de jobs tiene mecanismo, frecuencia, idempotencia y retención definidos; `pg_cron` se usa solo para SQL puro y el endpoint para lo que necesita HTTP.
- `POST /maintenance/run` exige clave de instancia con `maintenance:run`, rechaza claves delegadas (403) y usa advisory lock (409 si concurre).
- `outbox.retry` reintenta con backoff y **no duplica** eventos ni hooks; el lazy sweep no bloquea la petición del usuario.
- `/health` pasa a `degraded` con outbox atascado o fallido reciente, sin exponer detalles públicos.
- Retenciones definidas y con job de purga para cada dato.
- Coherente con task-01..06, api-v1 §4, ADR 0004/0007.
- Aprobada por el usuario, revisada por segundo agente y **auditoría OWASP**.

## 9. Referencias

- Spec de datos: `docs/superpowers/specs/2026-10-26-core-data-model.md` (`event_outbox`, `audit`, `idempotency_keys`, `maintenance_runs`)
- Spec de realtime: `docs/superpowers/specs/2026-10-26-realtime-notificaciones.md` §5/§5bis
- Spec de MCP: `docs/superpowers/specs/2026-10-26-mcp.md` §5
- Spec de API del Core: `docs/superpowers/specs/2026-10-26-core-api.md` §3.10/§4
- Spec de config: `docs/superpowers/specs/2026-10-26-instance-config.md`
- Spec de tokens: `docs/superpowers/specs/2026-10-25-token-model.md` §6
- Flujo CI/CD: `docs/flows/cicd.md` (keep-alive; `maintenance.yml` al implementar)
- Plan del sprint: `docs/superpowers/plans/2026-10-26-sprint-core-design.md`
- Task: `docs/tasks/sprint-core-design/task-07.md`