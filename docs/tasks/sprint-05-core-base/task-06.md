---
id: sprint-05-task-06
titulo: Observabilidad (logs JSON, Sentry, verificación de la guía)
area: core
estado: pendiente
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: logger JSON de una línea (serialización estructural, sin cuerpos/PII/IPs), `request_id` en log/envelope/cabecera/admin_actions; Sentry **solo 5xx** con `sendDefaultPii:false`, sin `event.request`, IP nula, breadcrumbs fuera, `beforeSend` fail-closed, DSN solo servidor; verificación de la guía (`docs/guia-debugging.md`).

**TDD**: test del logger (datos marcados no aparecen; `\n` escapado) y del evento saliente (sin `request.*`/IP); 4xx no generan evento; el 503 de `/health` tampoco.

**DoD**: TDD, checks, ADRs 0004/0007, QA + auditoría; checklist A02/A09.
