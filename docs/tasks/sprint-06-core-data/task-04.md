---
id: sprint-06-task-04
titulo: API keys y dispositivos
area: core
estado: pendiente
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: `/api-keys` con secreto mostrado **una vez** (hash en BD), `role_cap` solo en service, revocación inmediata; `POST/GET/DELETE /devices` con `push_token` único y `last_seen_at`.

**TDD**: casos de contrato de puerta (scopes/403, representación) + caso de uso (invariantes), y los casos negativos de la checklist de seguridad aplicables.

**DoD**: DoD de Código (TDD, lint/tsc/test/build, CI), ADRs declarados, QA con ojos nuevos y **auditoría OWASP** (checklist `security-checklist.md`).
