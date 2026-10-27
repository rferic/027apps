---
id: sprint-06-task-01
titulo: Usuarios y roles
area: core
estado: pendiente
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: `GET/PATCH /users`, `DELETE /users/{id}` (soft), `users:assign_role`; los invariantes de root y ≥1 super_admin se prueban (no se puede demotar/desactivar el root ni dejar la instancia sin super_admin).

**TDD**: casos de contrato de puerta (scopes/403, representación) + caso de uso (invariantes), y los casos negativos de la checklist de seguridad aplicables.

**DoD**: DoD de Código (TDD, lint/tsc/test/build, CI), ADRs declarados, QA con ojos nuevos y **auditoría OWASP** (checklist `security-checklist.md`).
