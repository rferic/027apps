---
id: sprint-06-task-02
titulo: Categorías de usuarios
area: core
estado: test
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: `/user-categories` completo; asignar módulo a categoría **materializa** `user_modules` a los miembros actuales (idempotente) y **no** resucita revocados sin decidirlo; unassign **no** revoca.

**TDD**: casos de contrato de puerta (scopes/403, representación) + caso de uso (invariantes), y los casos negativos de la checklist de seguridad aplicables.

**DoD**: DoD de Código (TDD, lint/tsc/test/build, CI), ADRs declarados, QA con ojos nuevos y **auditoría OWASP** (checklist `security-checklist.md`).

## Bitácora (2026-11-05)

- **Migración** `0007_user_categories.sql`: `user_categories`, `user_category_members`, `user_modules`, `user_category_modules` con RLS (miembro lee su etiqueta; gestión solo admin; concesiones propias + admin) y CHECK de actor único. Las FK a `module_registry`/`api_keys` se añaden en tasks 04/05 (esas tablas aún no existen); documentado en la migración.
- **Core** (`packages/core/src/user-categories/{service,api}.ts`): CRUD de categorías, miembros y plantilla de módulos. Semántica A2: asignar un módulo **materializa** `user_modules` para los miembros actuales en una transacción, es idempotente y **no resucita** concesiones revocadas (`on conflict do nothing`); desasignar o expulsar **no revoca** concesiones; borrar una categoría con módulos → `conflict`. Slug único generado del nombre (o explícito).
- **Guard**: scopes `user_categories:read/write`, `modules:read`, `modules:grant` (admin y super_admin); las rutas de gestión exigen `is_admin`.
- **Rutas admin**: `/api/v1/user-categories`, `/{id}`, `/{id}/members/{userId}`, `/{id}/modules`, `/{id}/modules/{key}`, finas sobre `withDoor` (zod estricto, 401/403, 201/204).
- **Tests**: 5 de servicio + 3 de API (materialización a miembros actuales, no herencia de nuevos, no resurrección, desasignar no revoca, borrado bloqueado).
- **Verde**: lint ✓, tsc ✓, core 112, admin 77, db-tests 115, build ✓.
- **Diferido**: `/me/modules` y la lectura de la etiqueta por el miembro vía API (sprint-web/task-05), y las FK de módulo.
- **Pendiente para `finalizada`**: QA + auditoría OWASP.
