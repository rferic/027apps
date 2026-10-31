# Spec — Core: observabilidad (sprint 04, task 08)

**Fecha:** 2026-10-26 · **Revisión:** 2 (revisión de docs + auditoría OWASP)
**Estado:** Borrador para aprobación del usuario
**Base:** [ADR 0007 §6](../../adr/0007-manejo-de-errores.md) · [API v1 §3.5/§4](2026-10-25-api-v1.md) · [jobs y mantenimiento](2026-10-26-jobs-mantenimiento.md) · [configuración](2026-10-26-instance-config.md) · [datos del Core](2026-10-26-core-data-model.md) · [MCP](2026-10-26-mcp.md) · [diseño §7](2026-10-24-027apps-design.md) · [DoD](../../conventions/definition-of-done.md)
**Decide el usuario:** Sentry solo errores · logs JSON sin cuerpos · `X-Request-Id` en todas las respuestas · guía propia (2026-10-26)

## 1. Objetivo

Que cualquier fallo se diagnostique en minutos con lo mínimo: **correlación** (`request_id`), **logs estructurados** sin datos sensibles, **errores agregados** (Sentry free) y **estado operativo** (`/health`, `/maintenance/status`), más una **guía** para el operador.

**Principio**: minimización de datos. Si el email no hace falta, no va; si el cuerpo no hace falta, no va.

## 2. `request_id` (correlación)

- **Generación**: en la **puerta**, UUIDv4 por petición. Nunca reutilizado.
- **Propagación**: header **`X-Request-Id` en todas las respuestas** (éxito y error) · envelope de error (`error.request_id`) · `admin_actions.request_id` · **`event_outbox.request_id`** (para correlacionar fallos de entrega diferidos) · línea de log · tag de Sentry.
- **No se acepta del cliente** (evita colisiones y spoofing): el header se **sobrescribe** siempre.
- **CORS**: `X-Request-Id` se añade a **`Access-Control-Expose-Headers`** para que un origen permitido pueda leerlo (delta a api-v1 §3.4).
- No contiene datos: es un UUID aleatorio.

## 3. Logs estructurados

- **Formato**: **JSON, una línea por evento**, a **stdout**, con **serialización estructural** (`JSON.stringify` del objeto; **nunca** concatenación de plantillas). Un `\n` en cualquier valor queda **escapado**: no hay *log forging*.
- **Campos**:

| Campo | Tipo | Cuándo |
|---|---|---|
| `ts` | ISO 8601 UTC | siempre |
| `level` | `error`\|`warn`\|`info`\|`debug` | siempre |
| `msg` | string | siempre; **estático o parametrizado**, en inglés |
| `request_id` | uuid | siempre |
| `route` | string | patrón REST (`POST /api/v1/invitations`) o **`mcp:<endpoint>#<tool>`**; **nunca** la URL con ids |
| `status` | int | peticiones HTTP |
| `duration_ms` | int | peticiones HTTP |
| `code` | string | código del ADR 0007 (REST) o `jsonrpc_code` (MCP) |
| `is_error` | bool | MCP: error de ejecución de tool (`isError`) |
| `actor` | `session`\|`service`\|`delegated`\|`anon` | peticiones autenticadas |
| `user_id` / `api_key_id` | uuid | **solo** `error`/`warn`; nunca el token |
| `event_id` | uuid | despacho/reintento del outbox |
| `error_name` | string | clase del error |
| `stack` | string | **solo** `error` server-side (frames limitados al enviar a Sentry) |

- **Prohibido** (revisión + `guard-secrets` + tests): cuerpos de petición/respuesta, `Authorization`/`Cookie`, tokens, contraseñas, emails, `value_encrypted`, SQL, **IPs**, `details` de validación con datos personales.
- **Niveles**: `error` (5xx/inesperado → Sentry) · `warn` (`degraded`, límites, purga fallida, outbox `failed`, transición a `degraded`) · `info` (ciclo de vida: mutaciones relevantes, módulos, `setup` completado) · `debug` (**solo** `NODE_ENV !== 'production'`, fijado en build; **nunca** un setting editable).
- **Atribución** (aclaración): `info` es **señal de ciclo de vida**, no pista de auditoría. Las mutaciones **sensibles** se atribuyen en `admin_actions` (actor + `request_id`) y las **no sensibles** en la propia fila de negocio; el log no duplica esa atribución.
- **Límite conocido**: los logs no son archivo histórico (retención del hosting, corta en free). Para historia: Sentry (30 d) y `audit`/`admin_actions` en BD.

## 4. Sentry (free) — solo errores, **controles de SDK obligatorios**

- **Qué se envía**: **5xx inesperados** y **excepciones no controladas**. **No** se envían 4xx esperados (`validation_failed`, `unauthorized`, `insufficient_scope`, `not_found`, `conflict`, `rate_limited`) **ni el `503` de `/health` degradado** (es estado esperado y se sondea con frecuencia): iría a Sentry justo durante una caída y consumiría la cuota. La transición a `degraded` se registra como **`warn`**, no como error.
- **Controles de privacidad del SDK (fail-closed)** — obligatorios, porque los *defaults* son fail-open:
  - **`sendDefaultPii: false`**.
  - **Sin `user.email`/`user.username`**; `user` = `{ id }` (UUID) y **`ip_address: null`**.
  - **Eliminar `event.request`** completo (headers, cookies, `query_string`, `url`) y los **breadcrumbs** con datos de petición.
  - **`beforeSend` fail-closed**: si queda cualquier duda o el scrub lanza, **`return null`** (se descarta el evento).
  - **Frames limitados** del `stack` antes de enviar (evita revelar el layout interno completo).
  - **DSN solo en servidor** (variable sin `NEXT_PUBLIC_`): el navegador no puede inyectar eventos falsos. Además, *allowed domains* / inbound filters en el proyecto.
- **Qué no se usa**: performance tracing, session replay, profiling, cron monitors.
- **Contexto**: `release` = SHA del commit; `environment` (`production`/`preview`/`development`); tags `code`, `route`, `request_id`.
- **Alerta**: email al admin en **issue nuevo**.
- **Cuota** (~5 000 eventos/mes): si se agota, se pierde la agregación, **no** la operación.

## 5. Estado operativo

| Superficie | Quién | Contenido |
|---|---|---|
| `GET /api/v1/health` | público | solo `{status}`; **503** si degrada; cacheado 30 s |
| `GET /api/v1/maintenance/status` | **sesión `super_admin`** | cola del outbox por estado, fallos, última ejecución por job, antigüedad de las purgas, último `pg_cron` visto y salud |
| Panel de admin | **admin** (banners) / **super_admin** (status) | banners de `setup` incompleto y push sin configurar; etiquetas de navegación **orientativas** hasta task-12 |

- `/health` no expone detalle (sin oráculo público).

## 6. Guía de depuración (entregable documental)

Se entrega **`docs/guia-debugging.md`** con **6 contenidos obligatorios** + 2 secciones de apoyo (estado dev/preview/prod; `/setup`):

1. **Correlacionar** un aviso por `request_id` (REST, y en MCP en `structuredContent.error.request_id`/`data`).
2. **Orden de mirada**: `/health` → `/maintenance/status` → Sentry (por tag) → logs del despliegue (avisando de la retención corta).
3. **Tabla síntoma → causa → acción** (incluye migraciones sin aplicar, outbox, push, SMTP, 429, módulo invisible, caché de 30 s del health).
4. **Qué no hacer** (tokens/emails/bodies, tocar `auth.users` a mano).
5. **Cuándo restaurar** desde backup (remite al runbook del sprint de infraestructura).
6. **Verificar la observabilidad** (errores de prueba y `X-Request-Id`).

## 7. Privacidad y minimización

- **Sin PII en logs ni en Sentry** (§3/§4): identificadores opacos (UUID).
- **Sin IPs**: ni en logs de aplicación ni en Sentry (`ip_address: null`).
- **Sin cuerpos** de petición/respuesta en ninguna superficie.
- **Datos personales**: viven en la BD, no en logs; el derecho de supresión se resuelve con operaciones de datos.
- **Acceso a logs/Sentry**: lo determina la organización de Vercel/Sentry (operador). No hay auditoría de lecturas en v1: RLS las restringe y `admin_actions` audita **solo mutaciones sensibles**.

## 8. Decisiones tomadas (2026-10-26)

| # | Decisión |
|---|---|
| A | **`request_id`** en la puerta, `X-Request-Id` en todas las respuestas (expuesto por CORS), envelope, `admin_actions`, `event_outbox` y Sentry; nunca del cliente |
| B | **Logs JSON** estructurales (una línea, sin concatenación) con los campos de §3; `user_id`/`api_key_id` solo en `error`/`warn`; `route` de MCP `mcp:<endpoint>#<tool>` |
| C | **Sentry solo errores**: 4xx esperados **y el 503 de `/health`** no generan evento; `sendDefaultPii:false`, sin IP/email, `request` y breadcrumbs eliminados, `beforeSend` fail-closed, DSN solo servidor |
| D | **Salud en dos niveles**: `/health` público sin detalle (503) y `/maintenance/status` para `super_admin` |
| E | **Guía** `docs/guia-debugging.md` con 6 contenidos + estado de entornos y `/setup` |
| F | **`debug` fijado en build** por `NODE_ENV`, nunca ajustable en runtime; `info` es ciclo de vida, la auditoría va en `admin_actions`/fila de negocio |
| G | **`event_outbox.request_id`** para correlacionar fallos de entrega; los reintentos loguean `request_id` + `event_id` |

## 9. Fuera de alcance

- **APM / trazas / métricas** (OpenTelemetry, Prometheus).
- **Retención larga de logs / exportación**.
- **Backups y restauración**: runbook [`docs/infrastructure.md`](../../infrastructure.md) y [spec de backup](2026-10-26-backups.md).
- **Alertas a Slack/PagerDuty**.
- **Auditoría de lecturas**: no en v1 (RLS restringe; `admin_actions` solo mutaciones sensibles).

## 10. Testing

- Toda respuesta lleva `X-Request-Id`; el envelope lo repite; `admin_actions` lo guarda.
- **5xx inesperado** → **un** evento en Sentry con `request_id` y `release`. **No** generan evento: 400/401/403/404/409/429 **ni el 503 de `/health` degradado**.
- **Test del evento saliente de Sentry**: no contiene `request.headers`, `request.cookies`, `request.query_string`, `user.ip_address`, `user.email`, ni `Authorization`/`Cookie`; con `sendDefaultPii` desactivado y `beforeSend` fail-closed (si el scrub falla, no se envía).
- **Test del logger**: datos marcados (email, token, cuerpo, `value_encrypted`) **no** aparecen; un valor con `\n` sale **escapado en una sola línea**.
- **MCP**: un fallo de tool se loguea con `route: mcp:<endpoint>#<tool>`, `jsonrpc_code`/`is_error` y `request_id`; un error de protocolo también.
- **Outbox**: un reintento fallido loguea el `request_id` original y el `event_id`.
- `/health` responde `degraded`/503 con outbox detenido y `ok` en operación normal (contrato de task-07).
- La guía cita rutas que **coinciden con las specs aprobadas**, marca el alias `/api/health` vigente hasta el PR de `keep-alive.yml`, y los comandos son ejecutables.

## 11. Criterios de aceptación

- `X-Request-Id` en todas las respuestas (expuesto por CORS), `request_id` en envelope, `admin_actions`, `event_outbox` y Sentry.
- Logs JSON de una línea, serialización estructural, sin cuerpos/secretos/PII/IPs; test del logger.
- Sentry solo 5xx/inesperados (nunca 4xx ni el 503 de health), con los **controles de SDK** de §4 y scrub fail-closed; DSN solo servidor.
- `docs/guia-debugging.md` entregada con los 6 contenidos + entorno y `/setup`; rutas y comandos verificados contra las specs (y alias marcado).
- `/health` (público, sin detalle) y `/maintenance/status` (`super_admin`) documentados.
- Revisado por segundo agente y **auditoría OWASP** (esta spec bloqueó con un Alta que queda resuelta en §4).

## 12. Referencias

- Errores: `docs/adr/0007-manejo-de-errores.md`
- API v1: `docs/superpowers/specs/2026-10-25-api-v1.md` §3.4/§3.5/§4
- Mantenimiento: `docs/superpowers/specs/2026-10-26-jobs-mantenimiento.md`
- Configuración: `docs/superpowers/specs/2026-10-26-instance-config.md`
- MCP: `docs/superpowers/specs/2026-10-26-mcp.md`
- Datos: `docs/superpowers/specs/2026-10-26-core-data-model.md`
- DoD: `docs/conventions/definition-of-done.md`
- Entregable: `docs/guia-debugging.md`
- Backups: [`docs/infrastructure.md`](../../infrastructure.md) · [spec de backup](2026-10-26-backups.md)
- Plan: `docs/superpowers/plans/2026-10-26-sprint-core-design.md`
- Task: `docs/tasks/sprint-core-design/task-08.md`