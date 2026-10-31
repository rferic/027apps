---
id: sprint-06-task-02
titulo: Categorías de usuarios
area: core
estado: pendiente
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: `/user-categories` completo; asignar módulo a categoría **materializa** `user_modules` a los miembros actuales (idempotente) y **no** resucita revocados sin decidirlo; unassign **no** revoca.

**TDD**: casos de contrato de puerta (scopes/403, representación) + caso de uso (invariantes), y los casos negativos de la checklist de seguridad aplicables.

**DoD**: DoD de Código (TDD, lint/tsc/test/build, CI), ADRs declarados, QA con ojos nuevos y **auditoría OWASP** (checklist `security-checklist.md`).
