---
id: sprint-17-task-05
titulo: Panel — estado de notificaciones en la ficha del usuario
area: web
estado: pendiente
plan: pendiente (se escribe al arrancar)
fuente: docs/tasks/sprint-17-panel-y-notificaciones/README.md
adrs: [0004]
---

**Tarea**: que la ficha de un miembro en el panel diga si recibe notificaciones, para no tener que
adivinarlo por teléfono.

**Punto de partida**

- La ficha vive en `apps/admin/src/app/(panel)/panel/members/[id]/page.tsx` y hoy no dice nada de
  notificaciones: en `(panel)` no hay una sola mención a push o dispositivos.
- El estado existe desde la tarea 02: `devices.push_enabled` y `devices.revoked_at`.
- `listDevices` ya permite a un administrador leer los dispositivos de otro usuario
  (`packages/core/src/devices/service.ts:102`), así que no hace falta API nueva.

**Alcance**

- Una línea en la ficha: «Notificaciones: activas / desactivadas / sin dispositivo».
  - Activas: al menos un dispositivo con `push_enabled` y sin `revoked_at`.
  - Desactivadas: tiene dispositivos pero todos apagados o revocados.
  - Sin dispositivo: nunca registró ninguno.
- Sin botones ni acciones: el panel informa, no cambia la preferencia del móvil.
- Texto en los idiomas del panel, con su test de render.

**Aceptación**

- Los tres estados se ven correctamente con datos de prueba.
- Un usuario sin dispositivos no rompe la ficha.
- `pnpm --filter admin test` y `pnpm --filter admin build` en verde.

**Plan**: pendiente.
