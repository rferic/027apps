---
id: sprint-19-task-05
titulo: Dominio: solicitudes, completar y deshacer
area: core
estado: test
plan: docs/superpowers/plans/2026-11-27-todo.md
spec: docs/superpowers/specs/2026-11-27-todo.md
fuente: docs/tasks/sprint-19-todo/README.md
---

**Objetivo:** Solicitud de una tarea ajena con caducidad de 24 h, aceptar/denegar, y deshacer con resta de puntos solo en la temporada abierta.

**Ficheros:** `src/domain/requests.ts` (+ test), ampliación de `tasks.ts`

**Hecho cuando:** El ciclo pedir → aceptar/denegar/caducar está cubierto con reloj inyectado; deshacer en temporada cerrada da `season_closed`.
