---
id: sprint-05-task-03
titulo: Esqueleto de la API v1 (puertas, errores, request_id, rate limiting)
area: core
estado: pendiente
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: estructura `app/api/v1/**`; envelope de error del ADR 0007 con `request_id`; cabecera `X-Request-Id` en **todas** las respuestas; validación zod `.strict()` en el borde; **rate limiting en capas** sobre `rate_limit_counters` (global, por endpoint, escritura) con 429 + `Retry-After`; CORS por allowlist.

**TDD**: contract tests de puerta (errores, sin fuga de internos, cabecera, 429, CORS rechaza origen no listado).

**DoD**: TDD, checks, ADRs 0004/0007, QA + auditoría; checklist A03/A04/A05.
