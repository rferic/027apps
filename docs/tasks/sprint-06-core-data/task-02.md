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
- **Tests**: 5 de servicio + 3 de API (materialización a miembros actuales, no herencia de nuevos, no resurrección, desasignar no revoca, borrado bloqueado) + 5 de aislamiento RLS (miembro solo lee su etiqueta y sus concesiones; usuario no crea/renombra/borra/entra; admin gestiona; `anon` sin privilegios) + 2 de puerta para POST sin cuerpo.
- **Verde**: lint ✓, tsc ✓, core 114, admin 77, db-tests 120, build ✓.
- **Diferido**: `/me/modules` y la lectura de la etiqueta por el miembro vía API (sprint-web/task-05), y las FK de módulo.
- **Correcciones tras auditoría**: POST sin cuerpo aceptado por la puerta (`undefined` → schema opcional) para `POST .../members/{userId}` y `.../modules/{key}`; `getCategory` consulta solo los módulos de su categoría; la carrera categoría/perfil borrados al añadir miembro se mapea a `not_found` (23503); suite RLS de aislamiento añadida.
- **Auditorías**: QA/OWASP y estilo ejecutadas con agente distinto; sin hallazgos críticos ni altos. Pendiente veredicto final sobre el diff corregido.
