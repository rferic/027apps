# Sprint 17 · Tarea 05 — Panel: estado de notificaciones en la ficha

**Goal:** que la ficha de un miembro en el panel diga si recibe notificaciones.

**Architecture:** una consulta de lectura a `public.devices` con el pool de servicio (la API de
usuarios no expone dispositivos) y una insignia en la cabecera de la ficha. Sin API nueva.

**Tech Stack:** Next.js (panel), `pg`, Vitest.

**Spec:** [`docs/tasks/sprint-17-panel-y-notificaciones/task-05.md`](../tasks/sprint-17-panel-y-notificaciones/task-05.md)

## Pasos

- [x] `loadMemberNotifications(id)` responde `active` / `off` / `none`, y `unknown` si la lectura
  falla (la ficha no muestra una mentira ni rompe la página).
- [x] `MemberHeader` pinta «Notificaciones: activas / desactivadas / ninguna» con las claves que ya
  existen en el catálogo (`Enabled`, `Disabled`, `None`).
- [x] Test de la ficha para los cuatro estados.
