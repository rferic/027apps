---
id: sprint-19-task-07
titulo: API `/api/v1/todo`
area: web
estado: test
plan: docs/superpowers/plans/2026-11-27-todo.md
spec: docs/superpowers/specs/2026-11-27-todo.md
fuente: docs/tasks/sprint-19-todo/README.md
---

**Objetivo:** Los 25 endpoints con zod, scopes, idempotencia y rate limits, y su documentación.

**Ficheros:** `apps/admin/src/app/api/v1/todo/**` (18 ficheros de ruta) · `apps/admin/src/lib/todo.ts` · `packages/todo/docs/api.md`

**Hecho cuando:** Cada endpoint valida, respeta scopes y no deja salir de los grupos del llamante; `check:openapi` en verde.
