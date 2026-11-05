---
id: sprint-05-task-06
titulo: Observabilidad (logs JSON, Sentry, verificación de la guía)
area: core
estado: finalizada
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-31-sprint-05-core-base.md
---

**Alcance**: logger JSON de una línea (serialización estructural, sin cuerpos/PII/IPs), `request_id` en log/envelope/cabecera/admin_actions; Sentry **solo 5xx** con `sendDefaultPii:false`, sin `event.request`, IP nula, breadcrumbs fuera, `beforeSend` fail-closed, DSN solo servidor; verificación de la guía (`docs/guia-debugging.md`).

**TDD**: test del logger (datos marcados no aparecen; `\n` escapado) y del evento saliente (sin `request.*`/IP); 4xx no generan evento; el 503 de `/health` tampoco.

**DoD**: TDD, checks, ADRs 0004/0007, QA + auditoría; checklist A02/A09.

## Bitácora (2026-11-05)

- **Logger** (`packages/core/src/logger.ts` + test): `serializeLog` de una línea, claves ordenadas, `\n` escapado y descarte de campos desconocidos (email/IP/body/token). 4 tests.
- **Door**: cada petición emite `request completed` con `request_id`, `route`, `status`, `duration_ms` y `actor` (`session:<id>`/`service:<id>`/`anon`), además del log de error existente. El logger de `apps/admin` usa `serializeLog`.
- **Sentry** (`packages/core/src/observability/scrub.ts`, `packages/core/src/sentry.ts` + tests): `scrubEvent` quita `request`, `breadcrumbs`, `extra`, `user.ip` y `user.email`; descarta 4xx y el 503 de `/health`; fail-closed si el scrub lanza. `initSentry` inyecta el SDK, `sendDefaultPii: false` y `beforeSend`. 7 tests.
- **Admin**: `@sentry/nextjs` instalado; `apps/admin/instrumentation.ts` inicializa solo con `SENTRY_DSN` (servidor) y `sentry.server.config.ts` aplica la misma configuración. El SDK de cliente queda desactivado a propósito (el DSN no es público y así ningún evento de navegador lleva datos de request).
- **Docs**: `docs/guia-debugging.md` (logs, correlación por `request_id`, Sentry, `/health`, fallos comunes y comandos).
- **Verde**: `pnpm lint` ✓, `pnpm tsc` ✓, `pnpm test` ✓ (i18n 16, core 106, admin 77, db-tests 91), `pnpm i18n:check` ✓, `pnpm --filter admin build` ✓.
- **Desviación v1**: no se crea `sentry.client.config.ts`; el DSN es solo de servidor (decisión de privacidad). Se documenta aquí.
- **Pendiente para `finalizada`**: QA + auditoría OWASP.
- **QA + auditoría OWASP** (`ingeniero`): RECHAZADA inicialmente por un hallazgo **alto** real (los 5xx del door no llegaban a Sentry: el door devuelve `Response`, no lanza, y el wrapper del SDK solo captura excepciones). Corregido:
  - `DoorDeps.captureError` opcional: el door reporta los 5xx con `{ request_id, route, code }`; el admin lo conecta a `Sentry.captureException` con esos tags. Nunca se llama para 4xx.
  - Scrub: el estado se lee de `contexts.response.status_code` (forma real de `@sentry/nextjs`), `user` pasa a allowlist `{ id }`, se recortan los frames del stack (últimos 20, sin `context_line`/`pre_context`/`post_context`) y se eliminan `contexts`.
  - C1: la ruta del log es `MÉTODO /ruta` con UUIDs y tokens largos redactados (`:id`, `:token`).
  - C2: un 500 loguea `Internal server error`, no el mensaje crudo.
  - C4: `environment` usa `VERCEL_ENV ?? NODE_ENV` (preview diferenciado).
  - Tests nuevos: `captureError` en 500 y no en 400; status desde `contexts.response`; allowlist de `user`; recorte de frames.
- **Revisión de estilo** (`cocinero`): APROBADA CON CAMBIOS; renombrado `LogEntry` → `JsonLogEntry` en `logger.ts` para no colisionar con el contrato del door.
- **Verde final**: lint ✓, tsc ✓, i18n 16, core 111, admin 77, db-tests 91; `i18n:check` ✓; build ✓. `estado: finalizada`.
