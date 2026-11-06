---
id: sprint-09-task-01
titulo: Usuarios y roles
area: core
estado: finalizada
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: `GET/PATCH /users`, `DELETE /users/{id}` (soft), `users:assign_role`; los invariantes de root y ≥1 super_admin se prueban (no se puede demotar/desactivar el root ni dejar la instancia sin super_admin).

**TDD**: casos de contrato de puerta (scopes/403, representación) + caso de uso (invariantes), y los casos negativos de la checklist de seguridad aplicables.

**DoD**: DoD de Código (TDD, lint/tsc/test/build, CI), ADRs declarados, QA con ojos nuevos y **auditoría OWASP** (checklist `security-checklist.md`).

## Bitácora (2026-11-05)

- **Core** (`packages/core/src/users/{service,api}.ts`): `listUsers` (filtro `q` sobre nombre/email, paginación 1–100), `getUser` (404), `updateUser` (display_name/locale/timezone/role) y `deactivateUser` (soft). Invariantes en el servicio:
  - **root** = el `super_admin` activo más antiguo (el creado por `/setup`); no se demota ni se desactiva;
  - la instancia no puede quedarse sin ningún `super_admin` activo;
  - un `admin` puede promover a `admin`/`user` pero **nunca** tocar un rol `super_admin`; solo una sesión `super_admin` lo hace.
- **Guard** (`packages/core/src/auth/guard.ts`): scopes `roles:assign` (admin y super_admin) y `users:deactivate` (solo super_admin).
- **Rutas**: `GET/PATCH/DELETE /api/v1/users[/{id}]` en `apps/admin`, finas sobre `withDoor`; zod `.strict()` para el PATCH y rechazo de cuerpos vacíos.
- **Tests**: 8 de servicio + 6 de API en `packages/db-tests` (401/403, listado con filtros, representación, PATCH, promoción admin vs super_admin, root, último super_admin, soft delete).
- **Verde**: lint ✓, tsc ✓, core 112, admin 77, db-tests 105, build ✓.
- **Diferido y documentado**: evento `user.deactivated` y revocación material de `user_modules`/api-keys dependen de task-06/task-04; la sesión queda inutilizada al instante porque `resolveCaller` exige perfil activo (401).
- **Pendiente para `finalizada`**: QA + auditoría OWASP.
- **QA + auditoría OWASP** (`ingeniero`): APROBADA CON CAMBIOS, **sin críticos ni altos**. Fixes aplicados:
  - **Atomicidad**: `updateUser` y `deactivateUser` corren dentro de una transacción con `pg_advisory_xact_lock('core_users_roles')` (la infra inyecta `withTransactionClient`), eliminando la carrera TOCTOU de los dos últimos super_admins.
  - El early-return de `assertRoleChangeAllowed` se movió detrás del chequeo de sesión; comentarios aclaran que un admin puede editar el **perfil** de un super_admin pero nunca su **rol**.
  - `q` escapa `%`, `_` y `\` y la query usa `ILIKE … ESCAPE '\'`.
  - Mensajes de `conflict` documentados como diagnósticos (el envelope emite el mensaje canónico del código).
  - Tests añadidos: desactivación idempotente y clave de máquina que no puede cambiar roles (16 tests en total).
  - **Diferido**: escritura en `admin_actions` (la tabla aún no existe en este sprint), evento `user.deactivated` (task-06) y revocación material de `user_modules`/api-keys (tasks 04/06). La sesión ya queda inutilizada al instante (401 por perfil inactivo).
- **Revisión de estilo** (`cocinero`): APROBADA CON CAMBIOS; ruta de spec explícita en el JSDoc, comentario de `roles:assign` en el PATCH y mensajes internos documentados.
- **Verde final**: i18n 16, core 112, admin 77, db-tests 107; build ✓. `estado: finalizada`.
