---
id: sprint-19-task-06
titulo: Dominio: power, temporadas y job
area: core + sql
estado: pendiente
plan: docs/superpowers/plans/2026-11-27-todo.md
spec: docs/superpowers/specs/2026-11-27-todo.md
fuente: docs/tasks/sprint-19-todo/README.md
---

**Objetivo:** Contador por temporada, cierre con ranking y archivo, y el job horario que cierra periodos, marca vencimientos y caduca solicitudes.

**Ficheros:** `src/domain/power.ts` (+ test) · `sql/002-widgets.sql` y `003-jobs.sql` (+ down) · ampliación del manifest (widgets, demo, jobs)

**Hecho cuando:** El ranking coincide con el contador; cerrar archiva y resetea; el job es idempotente y respeta la zona del grupo.
