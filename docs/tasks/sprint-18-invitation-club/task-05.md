---
id: sprint-18-task-05
titulo: Solicitudes, concesiones y push
area: core + API
estado: finalizada
plan: docs/superpowers/plans/2026-11-18-invitation-club.md
fuente: docs/superpowers/specs/2026-11-18-invitation-club-design.md
adrs: [0004, 0007, 0009]
---

**Tarea**: cerrar el circuito de «no me quedan plazas» con solicitud, aprobación y aviso.

**Alcance**

- `requests.ts`: pedir (una pendiente, solo sin plazas), cancelar, listar, aprobar con cantidad,
  rechazar con motivo, conceder y retirar.
- Aprobación condicional (`state = 'pending'`): dos administradores no crean dos concesiones.
- Eventos `invitation.requested` (admins) y `invitation.request_resolved` (user), con push
  `{ key, state }` y sin `amount`.
- Rutas de solicitudes y concesiones; `GET/POST/DELETE` de grants por usuario.

**Aceptación**

- Una solicitud pendiente bloquea otra hasta resolverse o cancelarse.
- Aprobar crea una concesión permanente y revocable; retirarla no borra la historia.
- `pnpm --filter @027apps/core test -- src/invitations/requests.test.ts src/realtime/service.test.ts`
  y `pnpm --filter db-tests test -- src/api/invitation-club.test.ts` en verde; OpenAPI regenerado.

**Plan**: Task 5.
