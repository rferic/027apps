---
id: sprint-19-task-04
titulo: Dominio: recurrencia y ocurrencias
area: core
estado: test
plan: docs/superpowers/plans/2026-11-27-todo.md
spec: docs/superpowers/specs/2026-11-27-todo.md
fuente: docs/tasks/sprint-19-todo/README.md
---

**Objetivo:** Periodos semanal/mensual/anual en la zona del grupo, historial por ocurrencia y cierre de periodo con `keep_assignee`.

**Ficheros:** `src/domain/recurrence.ts` (+ test)

**Hecho cuando:** El mismo instante da el mismo periodo en dos zonas; nunca se duplica ni se pierde una ocurrencia; 29 de febrero y cambio de hora cubiertos.
