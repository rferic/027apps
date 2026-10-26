# Spec — Core: observabilidad (sprint 04, task 08)

**Fecha:** 2026-10-26
**Estado:** Borrador para aprobación del usuario
**Base:** [ADR 0007 §6](../../adr/0007-manejo-de-errores.md) (logging estructurado con `request_id`, sin secrets) · [API v1 §3.5/§4](2026-10-25-api-v1.md) (envelope de error, `/health`) · [jobs y mantenimiento](2026-10-26-jobs-mantenimiento.md) (salud, `/maintenance/status`) · [configuración](2026-10-26-instance-config.md) · [datos del Core](2026-10-26-core-data-model.md) (`admin_actions.request_id`) · [diseño §7](../2026-10-24-027apps-design.md) (Sentry free) · [DoD](../../conventions/definition-of-done.md)
**Decide el usuario:** Sentry solo errores · logs JSON sin cuerpos · `X-Request-Id` en todas las respuestas · guía propia (2026-10-26)

## 1. Objetivo

Que cualquier fallo se diagnostique en minutos con lo mínimo: **correlación** (`request_id`), **logs estructurados** sin datos sensibles, **errores agregados** (Sentry free) y **estado operativo** (`/health`, `/maintenance/status`), más una **guía** para el operador.

**Principio**: observabilidad **con minimización de datos**. Si el email no hace falta, no va; si el cuerpo no hace falta, no va.

## 2. `request_id` (correlación)

- **Generación**: en la **puerta**, lo primero: **UUIDv4** por petición. Nunca reutilizado.
- **Propagación**:
  - **header `X-Request-Id` en todas las respuestas** (éxito y error);
  - **envelope de error** (ADR 0007): `error.request_id`;
  - **`admin_actions.request_id`** en las mutaciones sensibles;
  - **línea de log** (§3) y **tag de Sentry** (§4).
- **No se acepta `request_id` del cliente** en v1 (evita colisiones y spoofing). Solo se genera en servidor.
- No contiene datos: es un UUID aleatorio.

## 3. Logs estructurados

- **Formato**: **JSON, una línea por evento**, a **stdout** (el hosting los captura; sin agente ni fichero).
- **Campos**:

| Campo | Tipo | Cuándo |
|---|---|---|
| `ts` | ISO 8601 UTC | siempre |
| `level` | `error`\|`warn`\|`info`\|`debug` | siempre (`debug` solo fuera de producción) |
| `msg` | string | siempre; texto corto **técnico**, en inglés |
| `request_id` | uuid | siempre |
| `route` | string | patrón (`POST /api/v1/invitations`), **nunca** la URL con ids |
| `status` | int | en peticiones HTTP |
| `duration_ms` | int | en peticiones HTTP |
| `code` | string | código del ADR 0007 cuando hay error |
| `actor` | `session`\|`service`\|`anon` | en peticiones autenticadas |
| `user_id` / `api_key_id` | uuid | **solo** en `error`/`warn`, nunca el token |
| `error_name` | string | clase del error (sin mensaje interno con datos) |
| `stack` | string | **solo** `error` server-side |

- **Prohibido** (revisión + `guard-secrets` + tests): cuerpos de petición/respuesta, `Authorization`/`Cookie`, tokens, contraseñas, emails, `value_encrypted`, SQL, IPs, `details` de validación con datos personales.
- **Niveles**: `error` (5xx/inesperado → también Sentry) · `warn` (`degraded`, límites, purga fallida, outbox `failed`) · `info` (mutaciones relevantes, ciclo de vida de módulos, `setup` completado) · `debug` (solo desarrollo).
- **Retención**: la del hosting (corta en free). Los logs **no** son el archivo histórico: para historia están Sentry (30 días en free) y `audit`/`admin_actions` en BD.

## 4. Sentry (free) — solo errores

- **Qué se envía**: **5xx inesperados** y **excepciones no controladas**. **No** se envían 4xx esperados (`validation_failed`, `unauthorized`, `insufficient_scope`, `not_found`, `conflict`, `rate_limited`).
- **Qué no se usa**: performance tracing, session replay, profiling, cron monitors (de pago o innecesarios).
- **Scrub obligatorio** (`beforeSend`): emails, tokens, cookies, `Authorization`, `value_encrypted`, cuerpos. Si no se puede scrubear con seguridad, **se descarta el evento**.
- **Contexto**: `release` = SHA del commit; `environment` (`production`/`preview`/`development`); tags `code`, `route`, `request_id`, y `user_id`/`api_key_id` **solo** como UUID.
- **Alerta**: email al admin en **issue nuevo**.
- **Cuota** (~5 000 eventos/mes): si se agota, se pierde la agregación, **no** la operación (logs y `/health` siguen).

## 5. Estado operativo

| Superficie | Quién | Contenido |
|---|---|---|
| `GET /api/v1/health` | público | `{status}`; **503** si degrada; cacheado (task-07 §5) |
| `GET /api/v1/maintenance/status` | sesión `super_admin` | cola del outbox por estado, fallos, última ejecución por job y antigüedad de las purgas |
| Panel de admin | admin | los dos anteriores + banners (`setup` incompleto, push sin configurar) — contrato en task-12, UI en sprint-web |

- **`/health` no expone detalle** (nada de contadores ni motivos): solo `status`, para no dar un oráculo público.

## 6. Guía de depuración (entregable documental)

Se entrega **`docs/guia-debugging.md`** con:

1. **Correlacionar un aviso**: pedir el `request_id` (visible en la UI de error), buscarlo en Sentry (tag) y en los logs del despliegue.
2. **Orden de mirada**: `/health` → `/maintenance/status` → Sentry (por `request_id`) → logs del despliegue.
3. **Tabla síntoma → causa probable → acción**: 5xx repetidos, `degraded`, outbox parado, 429, errores de validación, fallo de email (SMTP del proyecto Supabase), fallo de push (FCM), invitación caducada.
4. **Qué no hacer**: pegar tokens/emails en tickets/issues, copiar cuerpos de petición, tocar `auth.users` a mano.
5. **Cuándo restaurar**: remite al **runbook de backups** (fuera de este sprint: el documento de infraestructura (rama `sprint/infra-backups`) y la spec de backup de infraestructura).
6. **Verificar la observabilidad**: un error de prueba aparece en Sentry con `request_id`; una petición correcta devuelve `X-Request-Id`.

## 7. Privacidad y minimización

- **Sin PII** en logs ni Sentry: ni emails, ni nombres, ni contenido. Solo identificadores opacos (UUID).
- **Sin IPs** en logs de aplicación (el rate limit por IP es contabilidad interna, no logging).
- **Derecho de acceso/borrado**: los datos personales viven en la BD, no en logs; se resuelven con operaciones de datos.
- **`request_id`** es el único dato que se comparte con el usuario y no revela información.

## 8. Decisiones tomadas (2026-10-26)

| # | Decisión |
|---|---|
| A | **`request_id`** generado en la puerta, en `X-Request-Id` de **todas** las respuestas, en el envelope de error, en `admin_actions` y como tag de Sentry; **no** se acepta del cliente |
| B | **Logs JSON** de una línea a stdout con los campos de §3; `user_id`/`api_key_id` solo en `error`/`warn`; **nunca** cuerpos, tokens, emails, SQL ni IPs |
| C | **Sentry solo errores** (5xx/inesperados) con scrub de PII, `release`/`environment`/tags y alerta por email; sin APM/replay/profiling; la cuota agotada no afecta al servicio |
| D | **Salud en dos niveles**: `/health` público sin detalle (503 si degrada) y `/maintenance/status` para admin; el panel los muestra |
| E | **Guía entregable** `docs/guia-debugging.md` con correlación, orden de mirada, tabla síntoma→acción, "qué no hacer", restauración y verificación |
| F | **Minimización**: sin PII ni IPs; retención mínima; los logs no son archivo histórico (Sentry 30 d, `audit`/`admin_actions` en BD) |

## 9. Fuera de alcance

- **APM / trazas / métricas** (OpenTelemetry, Prometheus): no en v1.
- **Retención larga de logs / exportación**: se documenta la limitación.
- **Backups y restauración**: sprint de infraestructura (no se olvida: referenciado en la guía y en el README del sprint).
- **Alertas a Slack/PagerDuty**: solo email del propietario.
- **Auditoría de accesos a datos**: la cubren `admin_actions`/RLS, no los logs.

## 10. Testing

- Toda respuesta lleva `X-Request-Id`; el envelope de error lo repite igual.
- Un 5xx genera **un** evento en Sentry con `request_id` y `release`; un 400/401/403/404/409/429 **no** genera evento.
- Test del logger: procesa un flujo con datos "marcados" (email, token, cuerpo) y **falla** si aparecen en la salida.
- `scrub` verificado con casos: email en mensaje, header `Authorization`, campo `value_encrypted`.
- `/health` responde `degraded`/503 con outbox detenido y `ok` en operación normal (contrato de task-07).
- La guía cita rutas y comandos que **existen** en el repo (verificación de rutas).

## 11. Criterios de aceptación

- `X-Request-Id` en todas las respuestas; `request_id` en el envelope, en `admin_actions` y en Sentry.
- Logs JSON con los campos definidos y **sin** cuerpos/secretos/PII (test del logger).
- Sentry recibe solo 5xx/inesperados, con scrub, `release`/`environment` y tags; los 4xx no generan evento.
- `docs/guia-debugging.md` entregada con los 6 apartados y rutas verificadas; enlaza el runbook de backups.
- `/health` (público, sin detalle) y `/maintenance/status` (admin) documentados.
- Revisado por segundo agente y **auditoría OWASP**.

## 12. Referencias

- Errores: `docs/adr/0007-manejo-de-errores.md`
- API v1: `docs/superpowers/specs/2026-10-25-api-v1.md` §3.5/§4
- Mantenimiento: `docs/superpowers/specs/2026-10-26-jobs-mantenimiento.md`
- Configuración: `docs/superpowers/specs/2026-10-26-instance-config.md`
- Datos: `docs/superpowers/specs/2026-10-26-core-data-model.md`
- DoD: `docs/conventions/definition-of-done.md`
- Entregable: `docs/guia-debugging.md`
- Backups (otra tarea, no olvidar): el documento de infraestructura (rama `sprint/infra-backups`) + spec de backup de la rama de infraestructura
- Plan: `docs/superpowers/plans/2026-10-26-sprint-core-design.md`
- Task: `docs/tasks/sprint-core-design/task-08.md`