---
id: sprint-06-task-03
titulo: Invitaciones y canjeo
area: core
estado: pendiente
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: `POST/GET/DELETE /invitations`; `POST /invitations/{token}/redeem` público con rate limit: crea/verifica perfil, miembro de categoría y materializa `user_modules`; `invitation_expired`/`invitation_used`; el token **nunca** se devuelve por MCP.

**TDD**: casos de contrato de puerta (scopes/403, representación) + caso de uso (invariantes), y los casos negativos de la checklist de seguridad aplicables.

**DoD**: DoD de Código (TDD, lint/tsc/test/build, CI), ADRs declarados, QA con ojos nuevos y **auditoría OWASP** (checklist `security-checklist.md`).
