---
id: sprint-18-task-02
titulo: Cuota viva y nivel del miembro
area: core
estado: finalizada
plan: docs/superpowers/plans/2026-11-18-invitation-club.md
fuente: docs/superpowers/specs/2026-11-18-invitation-club-design.md
adrs: [0004, 0007]
---

**Tarea**: calcular la cuota desde hechos vivos y dejar que el administrador asigne el nivel.

**Alcance**

- `packages/core/src/invitations/quota.ts`: `parseInvitationLevels`, `baseQuotaFor`,
  `invitationQuota` y el tipo `InvitationQuota`.
- `PATCH /users/{id}` acepta `invitation_level` 1..20 o `null` con las reglas de rol.
- Tests unitarios de niveles/cuota y de integración con desactivación, purga, caducidad y reserva.

**Aceptación**

- Una cuenta desactivada ocupa; una purgada libera; una invitación caducada o revocada libera.
- Un nivel sin cuota configurada da 0; un administrador es `unlimited`.
- `pnpm --filter @027apps/core test -- src/invitations/quota.test.ts src/users/service.test.ts` y
  `pnpm --filter db-tests test -- src/invitations/quota.test.ts` en verde.

**Plan**: Task 2.
