---
id: sprint-19-task-01
titulo: Contrato, paquete y base de datos
area: sql + core
estado: en curso
plan: docs/superpowers/plans/2026-11-27-todo.md
spec: docs/superpowers/specs/2026-11-27-todo.md
fuente: docs/tasks/sprint-19-todo/README.md
---

**Objetivo:** El módulo existe, valida e instala limpio: manifest con digests, DDL 1.0.0 con las diez tablas, vista y funciones de identidad, y RLS activa. Sin dominio todavía.

**Ficheros:** `packages/todo/{package.json,tsconfig.json,manifest.json,README.md,assets/icon.svg}` · `sql/001-init.sql` y `001-init.down.sql` · `src/domain/errors.ts`, `src/domain/types.ts` · `src/manifest.test.ts` · `packages/db-tests/src/modules/todo.test.ts`

**Hecho cuando:** El manifest valida y sus digests coinciden; instalar y desinstalar en el stack local no deja rastro; las diez tablas existen con RLS; un miembro no escribe directamente por PostgREST.
