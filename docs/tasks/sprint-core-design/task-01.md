---
id: sprint-core-design-task-01
titulo: Modelo de datos del Core y RLS — spec de datos (definición)
area: core
estado: finalizada
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 1 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega spec aprobada y aprobación del usuario, sin código.

**Entregable**: spec `docs/superpowers/specs/2026-10-26-core-data-model.md` — el modelo de datos del Core tras el **reframe Categoría ≠ Grupo de módulo** (decisión del usuario, 2026-10-26).

**Reframe rector**: en el Core, "grupo" es una **categoría/etiqueta de usuarios** (para clasificar y asignar acceso a módulos por lote); los **grupos reales de datos** (p. ej. los grupos de gastos de Split Expenses) son **tablas propias de cada módulo** y NO pertenecen al Core. Consecuencia: `participants` y `group_members` **no son del Core**; el acceso a módulos vive en `user_modules` (por usuario, "el permiso va con el usuario").

**Alcance**:
- Identidad y categorización: `profiles` (id = auth.users.id, `is_super_admin`, locale/timezone — ADR 0008), `categories`, `category_members` (un usuario en varias categorías).
- Acceso a módulos: `user_modules` (concesión real, viaja con el usuario), `category_modules` (plantilla de asignación masiva que **materializa** concesiones a los miembros actuales — decisión A2).
- Módulos como plugins: `module_registry` (key, versión, **ciclo de vida** instalar/activar/desactivar/desinstalar) + `module_migrations` (DDL con rollback, hash, orden) para instalar/desinstalar/actualizar de forma reversible (decisión K).
- Configuración: `settings_categories` + `settings` (categorías con icono/orden/source, key con `UNIQUE(category_key, key)`, texto en inglés, `value`/`value_encrypted` con `is_secret` y CHECK) — **sustituye al `instance_settings` plano de la spec §8/ADR 0008**; `currencies` (listado ISO 4217 desactivable) + `default_currency` por defecto; `translations` (texto en inglés como clave, fallback locale→en, gestión de import/faltantes/cobertura — decisiones G/J).
- Invitaciones: `invitations` (email, nombre, categoría, módulos a conceder al aceptar — decisión B).
- Otros: `api_keys` (service/delegated, sin `group_id`), `devices` (v1), `audit` (uso agregado de tokens), `admin_actions` (log de mutaciones sensibles).
- **Modelo de permisos** (rol → scopes derivados, sin tabla RBAC): `super_admin` (instancia), usuarios con acceso a los módulos de sus `user_modules`; scopes por acción expuesta (ADR 0004 §2).
- **RLS por tabla**: security definer functions canónicas (`is_super_admin()`, `has_module_access(module_key)`, …); **claves de instancia** (`027_svc_`) con definer de servicio — el guard es la barrera efectiva (decisión I); **sin auto-escalado ni auto-concesión** (decisión L: `is_super_admin` no es editable por el propietario; write de `user_modules`/`category_members` solo admin).
- **Contrato de la suite de aislamiento** (testing D2) adaptado al reframe: dos categorías/usuarios con accesos distintos; un miembro expulsado pierde acceso al instante.

**Delta sobre la spec de API v1 (2026-10-26)**: con este reframe, la spec `2026-10-25-api-v1.md` queda corregida — `groups` → `categories`, `GET /api/v1/groups/{id}/modules` → `GET /api/v1/me/modules`, la config específica de módulo deja de ser transversal, y MCP lee "categorías/usuarios" (ver §4 y decisiones E/G de la spec).

**Decisiones pendientes de redactar en la spec** (de la conversación de diseño, 2026-10-26): semántica de materialización de `category_modules` (A2), lista+default de monedas (C), contrato de módulos/plugins (F/K), invitación con email/nombre/categoría/módulos (B), traducciones (J), RLS sin auto-escalado (L).

**Estado (2026-10-26):** spec `docs/superpowers/specs/2026-10-26-core-data-model.md` **finalizada** — revisada por segundo agente (DoD de Docs) con 11 hallazgos resueltos (1 Alta, 2 Media, 3 Media, 4 Media, 5 Media + 6 editoriales) e incorporadas las decisiones del usuario (reframe categorías, settings categorizados, traducciones, ciclo de vida de módulos, RLS sin auto-escalado); aprobada por el usuario (2026-10-26). Commiteada en `sprint/04-core-design` (`f642151` → `2deda67`).

**Criterios de aceptación**: el modelo no contiene tablas de "grupos de datos de módulo" (eso vive en cada módulo); el acceso a módulos es por usuario y viaja con él; RLS por tabla con definers canónicos y contrato de aislamiento definido; coherente con api-v1 (tras el delta), tokens, ADR 0004/0007/0008 y testing D2; aprobada por el usuario y revisada por segundo agente (DoD de Docs).

**Referencias**: spec diseño §4/§8 (`2026-10-24-027apps-design.md`), spec API v1 (`2026-10-25-api-v1.md`, con delta 2026-10-26), spec tokens §5/§7 (`2026-10-25-token-model.md`), ADR 0004/0007/0008, testing D2, `docs/tasks/sprint-web/task-01.md` (registro del sprint-web).