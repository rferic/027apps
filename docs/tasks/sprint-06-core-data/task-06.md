---
id: sprint-06-task-06
titulo: Realtime, outbox, push y mantenimiento
area: core
estado: pendiente
adrs: [0004, 0006, 0007]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: Política **única** `core_can_subscribe(topic)`; `publish()` valida `target` y despacha tras el commit; `event_outbox` con `claimed_until`/`failed_at` y hooks idempotentes; FCM data-only (degradación limpia); `POST /maintenance/run` con lease, allowlist y purgas con rol `core_cron`.

**TDD**: casos de contrato de puerta (scopes/403, representación) + caso de uso (invariantes), y los casos negativos de la checklist de seguridad aplicables.

**DoD**: DoD de Código (TDD, lint/tsc/test/build, CI), ADRs declarados, QA con ojos nuevos y **auditoría OWASP** (checklist `security-checklist.md`).
