---
id: sprint-18-task-07
titulo: "Panel: solicitudes, listado y árbol"
area: web
estado: finalizada
plan: docs/superpowers/plans/2026-11-18-invitation-club.md
fuente: docs/superpowers/specs/2026-11-18-invitation-club-design.md
adrs: [0004, 0007]
---

**Tarea**: que el administrador vea y resuelva las solicitudes, y entienda el origen de cada
invitación.

**Alcance**

- Página **Solicitudes**: pendientes primero, solicitante, cantidad, motivo y cuota viva; aprobar
  con cantidad o rechazar con motivo.
- Badge con polling (60 s visible y al recuperar el foco), sin cliente realtime nuevo.
- Listado de invitaciones con `source`, `anonymous`, `created_by` y `redeemed_by`; renovar, rotar y
  reenviar solo en `source = 'admin'`.
- Árbol de descendientes en la ficha del miembro.

**Aceptación**

- Aprobar dos veces la misma solicitud devuelve `request_resolved` y no duplica la concesión.
- Una invitación anónima no ofrece reenviar email ni renovar; solo revocar.
- `pnpm --filter admin test -- src/app/(panel)/panel/requests
  src/components/pending-requests-badge.test.tsx
  src/components/invitation-request-actions.test.tsx` en verde.

**Plan**: Task 7.
