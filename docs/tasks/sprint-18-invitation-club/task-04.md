---
id: sprint-18-task-04
titulo: Canje anónimo y herencia
area: core + web
estado: pendiente
plan: docs/superpowers/plans/2026-11-18-invitation-club.md
fuente: docs/superpowers/specs/2026-11-18-invitation-club-design.md
adrs: [0004, 0007]
---

**Tarea**: que una invitación sin email ni nombre se complete al registrarse, conservando la regla
de las invitaciones con email.

**Alcance**

- `previewInvitation` devuelve `requires_identity`; `assertRedeemable` acepta cualquier email solo
  si la invitación es anónima.
- `redeemInvitation` escribe nombre/email del formulario, `invited_by`, `invite_level` (NULL si el
  rol es `admin`) y materializa categorías y módulos.
- La web muestra nombre y email editables solo cuando `requires_identity`; el resto sigue bloqueado.
- Un invitador desactivado no puede ser canjeado (`invitation_inviter_inactive`).

**Aceptación**

- Una cuenta existente conserva nombre, rol, nivel e `invited_by`.
- Una invitación con email sigue rechazando un email distinto.
- `pnpm --filter @027apps/core test -- src/invitations/service.test.ts` y
  `pnpm --filter admin test -- src/app/invite` en verde.

**Plan**: Task 4.
