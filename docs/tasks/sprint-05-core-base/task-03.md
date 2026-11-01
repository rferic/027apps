---
id: sprint-05-task-03
titulo: Esqueleto de la API v1 (puertas, errores, request_id, rate limiting)
area: core
estado: test
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-31-sprint-05-core-base.md
---

**Alcance**: estructura `app/api/v1/**`; envelope de error del ADR 0007 con `request_id`; cabecera `X-Request-Id` en **todas** las respuestas; validación zod `.strict()` en el borde; **rate limiting en capas** sobre `rate_limit_counters` (global, por endpoint, escritura) con 429 + `Retry-After`; CORS por allowlist.

**TDD**: contract tests de puerta (errores, sin fuga de internos, cabecera, 429, CORS rechaza origen no listado).

**DoD**: TDD, checks, ADRs 0004/0007, QA + auditoría; checklist A03/A04/A05.

## Bitácora (2026-11-01)

- **Paquete `@027apps/core`**: creado con `errors.ts` (modelo de errores, `DEFAULT_MESSAGES`, `HTTP_STATUS`, `DomainError`, `toEnvelope`), `rate-limit.ts` (ventana fija) y `door.ts` (puerta). **33 tests** verdes (TDD: rojo primero). Inglés en código y comentarios (§12).
- **Invariantes verificados**: envelope con `request_id` + `X-Request-Id` en toda respuesta; sin stack/SQL/rutas internas ni siquiera en dev; 429 con `Retry-After`; CORS estricto por allowlist (preflight rechazado con 403 si el origen no está listado); zod `.strict()` en el borde con detalles de validación.
- **Falta**: integración de las rutas `app/api/v1/**` (task-04) y el guard de autorización por scopes (task-02).
