---
id: sprint-core-design-task-02
titulo: Recursos y endpoints transversales del Core — spec de API (definición)
area: core
estado: test
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 2 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega una spec aprobada, sin código.

**Entregable**: spec `docs/superpowers/specs/2026-10-26-core-api.md` — el inventario de la superficie transversal del Core sobre el contrato de API v1.

**Alcance** (refleja el contenido real de la spec):
- **Roles y scopes** (modelo 3 niveles de la task-01, decisiones M/N): gestión bajo `is_admin()`, solo `is_super_admin()` para roles de super_admin/root/`audit`/`admin_actions`/`module_migrations`; `roles:assign` para promocionar; `has_module_access = is_admin() OR is_public OR user_modules`.
- **Inventario por dominio** (todo sobre el contrato v1, representación compartida ADR 0004 §7):
  - Identidad: `GET/PATCH /me`, `GET /me/modules`.
  - Usuarios: `GET /users` (con **filtros** `q`, `module=<key>`, `category=<id>` + paginación), `GET /users/{id}`, `PATCH /users/{id}` (incl. `role`).
  - Categorías: `/user-categories` CRUD + `/members` + `/modules` (materializa `user_modules`, decisión A2).
  - Módulos: `GET /modules` (catálogo con `is_public`), `GET /modules/{key}` (detalle + settings), `GET/PATCH /modules/{key}/settings`, ciclo de vida install/activate/deactivate/uninstall, `PATCH /modules/{key}` (`is_public`), `POST/DELETE /users/{id}/modules/{key}` (grant/revoke).
  - Invitaciones: `POST /invitations`, `GET`, `DELETE`, `POST /invitations/{token}/redeem` (canjeo público, single-use).
  - Tokens: `/api-keys` CRUD (service → super_admin; delegado → propietario; secreto solo una vez al crear).
  - Dispositivos: `GET /devices` (+`?user=`), `DELETE /devices/{id}`.
  - Config: `GET /instance` (público), `GET/PATCH /settings/{category}.{key}`, `GET /settings-categories`, `GET /currencies`, `PATCH /currencies/{code}`.
  - i18n: `GET /translations?locale=` (kernel runtime), `/status`, `/import`, `PUT /translations/{locale}/{hash}`.
  - Admin/salud: `GET /health`, `GET /admin-actions`, `GET /audit`.
- **Rate limiting C1** (decisión delegada por api-v1 §3.3): por **identidad**, **ventana deslizante**, umbrales iniciales móvil 120 / key y MCP 30 req/min, exceso → `429` + envelope `rate_limited`, configurable por settings (`security.rate_limit.*`). Endpoints públicos con límite propio.
- **Representaciones** de cada recurso con las reglas del contrato (errores ADR 0007, paginación D2, fechas/moneda ADR 0008, sin secrets en respuestas).

**Decisiones tomadas** (conversación de diseño, 2026-10-26): inventario con scopes por rol, filtros de `GET /users`, catálogo de módulos con detalle/settings, público/privado, rate limiting con umbrales, canjeo público, renames (`user_categories`, `/modules/{key}/settings`), settings de módulo con `is_public` por manifest y usuario nunca edita (I), sin contraseñas en BD (J), desactivación de usuario con evento `user.deactivated` (M6).

**Criterios de aceptación**: todo endpoint respeta el contrato v1 (errores, paginación, auth, representación); el rate limiting queda con umbrales y mecanismo decididos; los recursos del Core sirven a móvil, admin y MCP con la misma representación (ADR 0004); coherente con la task-01.

**Referencias**: spec API v1 (`2026-10-25-api-v1.md`), spec datos (`2026-10-26-core-data-model.md`), spec tokens §5 (`2026-10-25-token-model.md`), ADR 0004, ADR 0007, ADR 0008, task-01 (esquema).