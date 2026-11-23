---
id: sprint-18-task-03
titulo: Invitación de miembro, QR e intercambio
area: core + API
estado: finalizada
plan: docs/superpowers/plans/2026-11-18-invitation-club.md
fuente: docs/superpowers/specs/2026-11-18-invitation-club-design.md
adrs: [0004, 0007, 0009]
---

**Tarea**: que un miembro emita invitaciones y códigos QR sin poder saltarse la cuota.

**Alcance**

- `shared.ts` (token, hash y transacción), `member.ts` (enlace de 48 h por defecto, ajustable en
  Ajustes, herencia, revocación) y
  `join-codes.ts` (código de 90 s, invitación de 15 min, intercambio de un solo uso).
- Handlers y rutas: `GET/POST /me/invitations`, `DELETE /me/invitations/{id}`,
  `POST /me/join-codes`, `GET /join-codes/{code}/preview`, `POST /join-codes/{code}/exchange`.
- Comprobación de cuota y escritura bajo `pg_advisory_xact_lock`; `join_code_used` en el segundo
  canje; nunca se guarda el token en claro.

**Aceptación**

- Dos invitaciones simultáneas con una plaza dan un 201 y un 409.
- Reabrir o pulsar dos veces el QR no crea una segunda invitación ni reproduce el token.
- El paquete heredado es públicos + privados `delegable` + todas las categorías.
- `pnpm --filter @027apps/core test -- src/invitations` y
  `pnpm --filter db-tests test -- src/api/invitation-club.test.ts` en verde; OpenAPI regenerado.

**Plan**: Task 3.
