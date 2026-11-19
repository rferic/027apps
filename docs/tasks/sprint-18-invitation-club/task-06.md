---
id: sprint-18-task-06
titulo: "Panel: niveles, delegable y ficha del miembro"
area: web
estado: pendiente
plan: docs/superpowers/plans/2026-11-18-invitation-club.md
fuente: docs/superpowers/specs/2026-11-18-invitation-club-design.md
adrs: [0004, 0007]
---

**Tarea**: que el administrador configure los niveles y gestione la cuota de una persona sin tocar
la base de datos.

**Alcance**

- `InvitationLevelsEditor`: añadir/quitar niveles contiguos, validar 0..100 y guardar en el ajuste
  `invitations.levels`.
- `MemberInvitationPanel`: nivel, «base + concedidas», «usadas/reservadas», lista de concesiones con
  retirar, y asignar nivel.
- Interruptor `delegable` en la ficha del módulo.
- Integración en `settings-form.ts` (`encodeSettingValue`/`parseSettingValue` para la clave).

**Aceptación**

- Un hueco en los niveles se rechaza antes de enviar; el array guardado es contiguo desde 1.
- Un `user` sin nivel muestra el aviso y el botón de asignar; un admin no tiene selector.
- `pnpm --filter admin test -- src/components/invitation-levels-editor.test.tsx
  src/components/member-invitation-panel.test.tsx src/lib/invitation-grants.test.ts` en verde.

**Plan**: Task 6.
