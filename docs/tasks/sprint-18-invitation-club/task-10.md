---
id: sprint-18-task-10
titulo: Documentación, i18n, OpenAPI y auditoría
area: docs
estado: pendiente
plan: docs/superpowers/plans/2026-11-18-invitation-club.md
fuente: docs/superpowers/specs/2026-11-18-invitation-club-design.md
adrs: [0004, 0007, 0009]
---

**Tarea**: cerrar el sprint con la documentación y la verificación completas.

**Alcance**

- `docs/flows/invitations.md` reescrito (niveles, QR, enlace, solicitud, expulsión, purga).
- Catálogo de eventos de realtime con `invitation.requested` e `invitation.request_resolved`.
- `docs/ai/landing.md`: fila de Miembros si la app deja de estar «prevista» para invitaciones.
- i18n: catálogo y 8 locales; `pnpm i18n:scan` y `pnpm i18n:check`.
- OpenAPI regenerado y `pnpm check:openapi`.
- Auditoría de seguridad por un agente distinto del autor, con los hallazgos críticos/altos
  corregidos.

**Aceptación**

- `pnpm lint && pnpm tsc && pnpm test`, `pnpm --filter admin build`,
  `pnpm --filter db-tests test`, `pnpm check:openapi`, `pnpm i18n:check` y
  `cd apps/android && ./gradlew :app:testDebugUnitTest` en verde, con la salida pegada.
- El flujo documentado se puede seguir sin leer el código.
- La auditoría no deja críticos ni altos abiertos.

**Plan**: Task 10.
