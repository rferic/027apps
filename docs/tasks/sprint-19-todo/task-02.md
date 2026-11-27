---
id: sprint-19-task-02
titulo: Dominio: grupos, miembros y carpeta personal
area: core
estado: pendiente
plan: docs/superpowers/plans/2026-11-27-todo.md
spec: docs/superpowers/specs/2026-11-27-todo.md
fuente: docs/tasks/sprint-19-todo/README.md
---

**Objetivo:** Grupos con dueño y miembros, más la carpeta personal idempotente de cada usuario, con la matriz de permisos cerrada.

**Ficheros:** `src/domain/groups.ts` (+ test), `src/domain/permissions.ts` (+ test)

**Hecho cuando:** La matriz de grupos pasa entera, incluidos los negativos; echar libera tareas y caduca solicitudes; la carpeta personal no admite miembros ni power.
