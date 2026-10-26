# Spec — Core: trabajos programados y mantenimiento (sprint 04, task 07)

**Fecha:** 2026-10-26 · **Revisión:** 2 (correcciones de revisión de docs + auditoría OWASP)
**Estado:** Borrador para aprobación del usuario
**Base:** [spec de realtime](2026-10-26-realtime-notificaciones.md) (task-04: `event_outbox`) · [spec de MCP](2026-10-26-mcp.md) (task-05: `idempotency_keys`) · [spec de datos](2026-10-26-core-data-model.md) (task-01) · [spec de API del Core](2026-10-26-core-api.md) (task-02) · [spec de tokens §6](2026-10-25-token-model.md) · [spec de config](2026-10-26-instance-config.md) (task-06) · [ADR 0004](../../adr/0004-bordes-y-capa-de-aplicacion.md) · [ADR 0007](../../adr/0007-manejo-de-errores.md) · [cicd.md](../flows/cicd.md)
**Decide el usuario:** modelo híbrido, auth del endpoint, retenciones, estado en el panel (2026-10-26)

## 1. Objetivo

Definir **qué mantenimiento necesita la instancia**, **dónde y con qué frecuencia corre en free tier**, cómo se **excluye mutuamente** sin locks frágiles, cómo se **purga sin destruir atribución**, y cómo se detecta que algo se ha atascado.

**Principio**: el mantenimiento **no está en el camino crítico**. Publicar un evento, un hook o un push ocurre **tras el commit**, en la propia petición; los jobs son la **red de seguridad**.

**Fuera de alcance**: backups de la BD y keep-alive del proyecto Supabase (infraestructura, tareas propias).

## 2. Correcciones de esta revisión (por qué cambia el diseño)

| Hallazgo (severidad) | Problema real | Corrección |
|---|---|---|
| **Locks (Alta)** | `pg_try_advisory_lock` de **sesión** no es sostenible con el access a BD decidido (`@supabase/supabase-js` sobre PostgREST/Supavisor: cada llamada es su propia transacción; un lock de sesión queda colgado en el pool) y `_xact_` muere antes del trabajo HTTP | **Lease en BD** (§3.4), con TTL y recuperación por timeout. Sin locks de sesión |
| **Purga de claves (Alta)** | `DELETE` de `api_keys` rompe la **atribución** (`audit.api_key_id` NOT NULL y seis `*_by_key`) o se lleva por delante auditoría aún en retención | **Anonimizar, no borrar** si está referenciada; borrar solo huérfanas (§2bis) |
| **`pg_cron` sin rol (Alta)** | Las purgas correrían como `postgres`/`supabase_admin` (bypass de RLS y acceso a `auth.*`) | **Rol dedicado + `SECURITY DEFINER`** con grants mínimos (§3.3) |
| **`failed` congelado (Media)** | task-04 decía que el job reintenta `failed`; esta spec solo `pending` | Se fija: `failed` es **terminal** con **re-encolado explícito** (`outbox.requeue`) |
| **Sin marca de fallo (Media)** | `event_outbox` solo tenía `created_at`: la salud y la purga no eran calculables | `failed_at` (delta task-01) |
| **`run_id` (Media)** | Una fila por job no representaba una ejecución | PK `(run_id, job)` |
| **`pg_cron` sin fallback (Media)** | Proyecto pausado o extensión deshabilitada → purgas muertas y sin señal | Los purges son **también ejecutables por el endpoint**; `pg_cron` es optimización; `/maintenance/status` delata jobs atrasados |
| **`cron.job_run_details` (Media)** | El histórico de `pg_cron` no se limpia solo y ocupa disco | Job `cron.history.purge` |
| **`audit.roll` indefinido (Media)** | "Cerrar ventanas" mutable chocaba con peticiones en vuelo | `window_end` **generado** (`window_start + 1 h`); el job pasa a ser solo purga |
| **Retención de `admin_actions` (Media)** | Append-only sin retención | **365 días** + job |
| **Almacén de rate limit (Media)** | "Puente a task-07" sin decidir | **Tabla `rate_limit_counters`** (delta task-01) + purga |
| **`guard-secrets` (Media)** | No conoce los prefijos `027_svc_`/`027_usr_` | Delta a `cicd.md` en el PR del workflow (patrones de prefijo propio) |
| **`/health` (Media)** | Ruta real `/api/health`, `curl --fail` con 503, y api-v1 §4 sin delta | §5 fija el mapeo y el delta |
| **`last_used_at` (Media)** | Prometido en el alcance, sin dueño | **Inline** en el guard con throttle 1/min por clave |

## 2bis. Purga que respeta la atribución (regla firme)

Las tablas de atribución (`audit`, `admin_actions`, `idempotency_keys`, `invitations`, `settings`, `user_modules`, `user_category_modules`, `user_categories`, `event_outbox`) referencian `api_keys.id` **y esa referencia es la prueba de quién hizo qué**. Por tanto:

1. **Se purga primero la evidencia por su propia retención** (p. ej. `audit` 90 d, `admin_actions` 365 d); después se evalúa la clave.
2. Una clave **con referencias vivas** (dentro de retención) **no se borra**: se **anonimiza** (`name` → `[deleted]`, `key_hash` → sentinel aleatorio, `revoked_at` fijado, `scopes` → `{}`). Conserva su `id` como actor inmutable.
3. Una clave **huérfana** (`NOT EXISTS` en todas las tablas de atribución) se **borra**.
4. **Nunca** `ON DELETE CASCADE` desde `api_keys`; las FK de atribución son `RESTRICT` y el job hace el paso 1 antes del 2.
5. Las purgas sensibles emiten `admin_actions` (`maintenance.apikeys.anonymize`, `maintenance.invitations.purge`…) con actor de sistema y **conteo** en `details` (nunca contenido).

## 3. Modelo de ejecución

### 3.1 Primario: inline
Tras el commit, el caso de uso despacha su evento (task-04). No depende de cron.

### 3.2 Red de seguridad
| Capa | Cubre | Coste |
|---|---|---|
| **Lazy sweep** | reintentos cuando hay tráfico | 1 claim barato cada ≥5 min por proceso |
| **`pg_cron`** | SQL puro (purgas, anonimización) | gratis en Supabase |
| **GitHub Actions horario** | `outbox.retry` y purgas cuando nadie usa la app | gratis en repo público |

`pg_cron` **no** puede publicar realtime ni enviar push (HTTP) → los jobs de app van por el endpoint. **Los purges SQL son también ejecutables por el endpoint**, de modo que si `pg_cron` no está (pausa de free tier, extensión deshabilitada) el Action horario los cubre. Vercel Cron se descarta (Hobby = 1/día).

### 3.3 Rol de `pg_cron` (A2 de auditoría)

- Los jobs SQL se definen como **funciones `SECURITY DEFINER`** con `SET search_path = ''`, `REVOKE EXECUTE FROM PUBLIC` y `GRANT EXECUTE` **solo al rol `core_cron`**.
- `core_cron` tiene **solo** `USAGE` en el schema de funciones y `SELECT`/`DELETE` sobre **las tablas concretas** que purga. **Nunca** `auth.*`, ni `ALL`, ni superusuario.
- Cada retención se **testea en el borde** (fila justo dentro y justo fuera del límite: no se borra la de dentro).
- Si el rol no existe (instancia sin `pg_cron`), el wizard/`/maintenance/status` lo reporta y el endpoint cubre los purges.

### 3.4 Exclusión mutua por **lease** (Alta de revisión)

- Tabla `maintenance_runs` (delta task-01): `run_id` (uuid), `job`, `status` (`running`|`ok`|`failed`|`skipped`|`timeout`), `lease_until`, `summary`, `started_at`, `finished_at`; PK `(run_id, job)`; **índice único parcial** `(job) WHERE status = 'running'`.
- **Reclamo atómico** en **una sola RPC** `claim_maintenance_runs(jobs text[], ttl_seconds int)`: inserta con `ON CONFLICT DO NOTHING` sobre el índice parcial y devuelve las filas reclamadas. Un job ya en `running` **no** se reclama.
- **TTL**: si `lease_until` vence (proceso muerto), el siguiente reclamo marca `timeout` la anterior y toma el relevo. Nunca queda un job bloqueado para siempre.
- **Heartbeat**: el job extiende `lease_until` mientras trabaja (cada 30 s si dura más).
- **Un solo camino**: el **lazy sweep** y el **endpoint** usan la misma RPC. Ninguno usa locks de sesión ni `hashtext`.
- **Lotes acotados**: el despacho del outbox reclama como máximo **K eventos** por barrido (K=50) con `claimed_until`, para que un backlog grande no haga un barrido infinito.

### 3.5 Claim del outbox (sin doble envío)

- `event_outbox.claimed_until` (delta task-01). El despachador reclama un lote con una RPC atómica (`UPDATE … WHERE state='pending' AND next_attempt_at <= now() AND (claimed_until IS NULL OR claimed_until < now()) ... RETURNING`, límite K) — patrón *claim/expire*, robusto ante procesos muertos y multi-instancia.
- Inline, lazy y endpoint comparten **el mismo claim**: un evento solo lo despacha un proceso.

### 3.5bis Endpoint

`POST /api/v1/maintenance/run` (delta task-02 §3.10):

- **Auth**: clave de instancia (`027_svc_`) con scope **`maintenance:run`** y **`role_cap = super_admin`**; delegada → `403`.
- **Jobs permitidos**: **allowlist cerrada** en código (map nombre → función). Nombre desconocido → `validation_failed` (no dispatch reflejado).
- **Cuerpo**: `{ "jobs": ["outbox.retry"] }` opcional; por defecto, todos los de app.
- **Cooldown + tope**: ≥ **1 min** entre ejecuciones por clave y consumo del cupo `rate_limit.api_key_per_min` (30/min). El lock/lease **serializa**, el rate limit **limita frecuencia**.
- **Concurrencia**: si los jobs están reclamados → **`409 conflict`** con `Retry-After` (segundos).
- **Respuesta**: `{ run_id, jobs: [{ job, status, processed, failed, duration_ms }] }`.

`GET /api/v1/maintenance/status`: **sesión de `is_super_admin()`** (sin scope de máquina: `maintenance:read` **se elimina**, era un scope muerto para claves). Devuelve última ejecución por job, contadores de outbox por estado, jobs atrasados, salud y último `pg_cron` visto.

### 3.6 GitHub Actions

- Workflow `maintenance.yml`, **horario con minuto desplazado** (`:23`), `workflow_dispatch`, `permissions: {}`, `concurrency` para no solapar.
- Secretos **por `env` en el paso** (`MAINTENANCE_URL`, `MAINTENANCE_API_KEY`); **nunca** echo; acciones de terceros fijadas por SHA.
- **409 → `exit 0` + notice** (otra ejecución en curso no es un fallo).
- La clave usada tiene **solo** `maintenance:run`, **`role_cap=super_admin`** y **`expires_at`** con rotación planificada (sprint-infra).
- **Prerrequisitos de repo**: protección de rama / CODEOWNERS sobre `.github/workflows/` para que un colaborador no edite el workflow y exfiltre la clave.
- `docs/flows/cicd.md` se actualiza en el PR que implemente el workflow: job nuevo, degradación en forks sin secrets, y **patrones `027_svc_`/`027_usr_` en `guard-secrets`**.

## 4. Inventario de jobs

| Job | Qué hace | Ejecuta | Frecuencia | Retención |
|---|---|---|---|---|
| `outbox.retry` | Reintenta `pending` vencidos (backoff exponencial; **máx. 8 intentos**, constante del Core) y despacha hooks/push pendientes | App | inline + lazy + horario | — |
| `outbox.requeue` | Re-encola **manualmente** eventos `failed` (`attempts=0`, `state=pending`) | App (endpoint / panel) | bajo demanda | — |
| `outbox.purge` | Borra `published` > 7 d y `failed` > 30 días (desde `failed_at`) | SQL | diaria | 7 / 30 d |
| `idempotency.purge` | Borra `expires_at < now()` | SQL | horaria | 24 h |
| `audit.purge` | Borra ventanas con `window_start` > 90 días | SQL | diaria | 90 d |
| `invitations.purge` | Borra caducadas/usadas hace > 30 d (`invitation_modules` en cascada) | SQL | diaria | 30 d |
| **`api_keys.anonymize`** | **Anonimiza** claves con referencias (§2bis) y **borra huérfanas** | SQL | diaria | 90 d |
| `devices.purge` | Borra dispositivos revocados hace > 90 d | SQL | diaria | 90 d |
| `rate_limit.purge` | Borra contadores expirados de `rate_limit_counters` | SQL | diaria | ventana |
| `maintenance.purge` | Borra `maintenance_runs` > 90 d | SQL | diaria | 90 d |
| `admin_actions.purge` | Borra acciones > **365 d** (log de seguridad) | SQL | diaria | 365 d |
| `cron.history.purge` | Borra `cron.job_run_details` > 14 d (si `pg_cron` presente) | SQL | diaria | 14 d |
| `health.evaluate` | Calcula `ok`/`degraded` (cacheado 30 s) | App | por petición | — |

**No se purgan** (y por qué): `translations` (se siembran/borran con su módulo), `settings`/`settings_categories` (configuración; se borran con el módulo), `profiles` (historial), `user_modules`/`user_category_modules` (concesiones; se revocan, no se borran), `currencies` (se deshabilitan).

`last_used_at` de `api_keys`: **inline** en el guard, con throttle de **1 escritura/min por clave** (no hay job).

## 5. Salud (`/health`)

`GET /api/v1/health` → `{ status: "ok" | "degraded" }`; **`degraded` responde HTTP 503** (mantiene el comportamiento del código actual y el `curl --fail` del keep-alive).

| Condición | Estado |
|---|---|
| Supabase inaccesible o migraciones sin aplicar | `degraded` |
| `event_outbox` con `pending` más antiguo de **1 h** | `degraded` |
| `event_outbox.failed` con `failed_at` en las últimas **24 h** | `degraded` |
| Job SQL con última ejecución > **2 periodos** | `degraded` (visible en `/maintenance/status`) |
| Resto | `ok` |

- **Sin detalles públicos**: solo `status`. Los contadores van en `GET /maintenance/status`.
- **Coste**: el estado se **cachea 30 s** y las consultas usan índices (`(state, created_at)`, `(state, next_attempt_at)`); `/health` es público y no puede convertirse en un amplificador.
- **Delta a api-v1 §4**: la condición de `degraded` deja de ser solo "Supabase caído" y añade el outbox atascado.
- **Ruta**: canónica **`/api/v1/health`**; el alias actual `/api/health` se mantiene hasta que `keep-alive.yml` y `cicd.md` se actualicen (se hace en el mismo PR del workflow).

## 6. Decisiones tomadas (task-07)

| # | Decisión |
|---|---|
| A | **Modelo híbrido**: inline tras el commit (primario) + **lazy sweep** + **`pg_cron`** (SQL) + **GitHub Actions horario** (app). Los purges son **también ejecutables por el endpoint** como fallback si `pg_cron` no está |
| B | **Exclusión mutua por lease en BD** (`maintenance_runs` con `running`/`timeout`, `lease_until` e índice único parcial `(job) WHERE status='running'`) reclamada por **una RPC atómica**; **sin locks de sesión ni `hashtext`** |
| C | **Claim del outbox** con `claimed_until` y lote acotado (K=50), compartido por inline, lazy y endpoint (sin doble envío) |
| D | **Purga que respeta la atribución**: evidencia primero; **anonimizar** claves referenciadas; borrar solo huérfanas; **nunca `CASCADE` desde `api_keys`** |
| E | **`pg_cron` con rol dedicado `core_cron`** y funciones `SECURITY DEFINER` (`search_path=''`, `REVOKE EXECUTE FROM PUBLIC`, grants mínimos, **nunca `auth.*`**) |
| F | **`failed` es terminal**; se re-encola explícitamente con `outbox.requeue` (panel/endpoint) |
| G | **`audit.window_end` generado** (`window_start + 1 h`); el job es `audit.purge` (sin "cierre de ventanas") |
| H | **Almacén de rate limit = tabla `rate_limit_counters`** (delta task-01) con purga diaria |
| I | **Retenciones**: outbox 7 d (publicado) / 30 d (fallido, desde `failed_at`) · idempotencia 24 h · `audit` 90 d · invitaciones 30 d · claves 90 d (anonimizadas) · `devices` 90 d · `maintenance_runs` 90 d · **`admin_actions` 365 d** · `cron.job_run_details` 14 d |
| J | **Auth**: `POST /maintenance/run` con clave `027_svc_` + scope `maintenance:run` + `role_cap=super_admin`, allowlist cerrada de jobs, cooldown ≥1 min y cupo del rate limit; **`maintenance:read` eliminado** (el estado lo lee un `super_admin` con sesión) |
| K | **`/health`** degrada también con outbox atascado o job SQL atrasado; responde **503**; cachea 30 s; solo `status` en público; delta a api-v1 §4 |
| L | **`last_used_at` inline** en el guard con throttle de 1 escritura/min por clave (sin job) |
| M | **Workflow**: horario con minuto desplazado, `workflow_dispatch`, `permissions: {}`, `concurrency`, secretos por `env`, acciones por SHA, 409 → `exit 0`; `cicd.md` y `guard-secrets` (prefijos `027_svc_`/`027_usr_`) en el PR que lo implemente |

## 7. Fuera de alcance

- **Backups de la BD** y su retención → infraestructura (runbook + tarea propia).
- **Keep-alive del proyecto Supabase** → `docs/flows/cicd.md` + `sprint-infra` task-07.
- **Rotación de la clave maestra** → `sprint-infra` task-09.
- **UI del panel de mantenimiento** → contract aquí; implementación en sprint-web.
- **Purga de datos de negocio de módulos** → decide cada módulo (el dinero no se borra).

## 8. Criterios de aceptación

- Exclusión mutua **por lease** (con TTL e índice único parcial) y claim del outbox con `claimed_until`; probado con dos ejecuciones concurrentes y con un proceso muerto a mitad.
- Purga de claves que **nunca** rompe la atribución: anonimiza referenciadas, borra huérfanas, sin `CASCADE`, y testea los bordes de retención de `audit`/`admin_actions`.
- Jobs SQL ejecutados con **rol dedicado** y funciones `SECURITY DEFINER` endurecidas; sin acceso a `auth.*`.
- `POST /maintenance/run` con allowlist cerrada, cooldown y rate limit; nombre desconocido → `validation_failed`; concurrencia → 409 con `Retry-After`.
- `outbox.retry` no duplica eventos ni hooks; `failed` es terminal y `outbox.requeue` lo re-encola.
- `/health` degrada con pendientes > 1 h, fallos recientes o job SQL atrasado; devuelve **503**; cacheado 30 s; sin detalles públicos; delta a api-v1 §4 registrado.
- Inventario completo con retención y job (o motivo explícito de no purga), incluidos `admin_actions` (365 d), `devices`, `rate_limit_counters` y `cron.job_run_details`.
- Coherente con task-01..06, api-v1 §4 (delta), ADR 0004/0007.
- Aprobada por el usuario, revisada por segundo agente y **auditoría OWASP** (esta spec **bloqueó** con 2 Alta que quedan resueltas aquí).

## 9. Referencias

- Datos: `docs/superpowers/specs/2026-10-26-core-data-model.md` (`maintenance_runs`, `rate_limit_counters`, `event_outbox`, `audit`, `api_keys`)
- Realtime: `docs/superpowers/specs/2026-10-26-realtime-notificaciones.md` §5/§5bis
- MCP: `docs/superpowers/specs/2026-10-26-mcp.md` §5
- API del Core: `docs/superpowers/specs/2026-10-26-core-api.md` §3.10/§4
- Config: `docs/superpowers/specs/2026-10-26-instance-config.md` §5
- Tokens: `docs/superpowers/specs/2026-10-25-token-model.md` §6
- Flujo: `docs/flows/cicd.md` (`maintenance.yml` + patrones `guard-secrets` al implementar)
- Plan: `docs/superpowers/plans/2026-10-26-sprint-core-design.md` · Task: `docs/tasks/sprint-core-design/task-07.md`