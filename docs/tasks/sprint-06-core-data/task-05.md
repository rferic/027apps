---
id: sprint-06-task-05
titulo: Sistema de módulos e instalador
area: core
estado: test
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-10-27-core-implementation-roadmap.md
---

**Alcance**: Instalador: validar manifest, verificar `digest`/`down_digest`, aplicar `up` en transacción con **rol acotado**, sembrar settings/i18n, registry; `uninstall` revierte `down`, limpia settings/translations y aplica la **regla de atribución**; checks de CI de manifest, `docs` y `admin_pages`.

**TDD**: casos de contrato de puerta (scopes/403, representación) + caso de uso (invariantes), y los casos negativos de la checklist de seguridad aplicables.

**DoD**: DoD de Código (TDD, lint/tsc/test/build, CI), ADRs declarados, QA con ojos nuevos y **auditoría OWASP** (checklist `security-checklist.md`).

## Bitácora (2026-11-05)

- **Migración** `0010_modules.sql`: `module_registry` (estado `installed|active|disabled`, `is_public`, `mcp_exposed`, `manifest_digest`) y `module_migrations`; rol no-superusuario `module_installer` (con `grant` a `postgres` para poder `SET ROLE`); FKs diferidas de `user_modules`/`user_category_modules`/`invitation_modules` → `module_registry` (cascade en uninstall) y de todos los actores `*_by_key` → `api_keys`; `translations.source` admite `module:<key>`; RLS: catálogo legible por autenticados, migraciones solo super_admin.
- **Contrato del manifest** (`packages/core/src/modules/manifest.ts`): esquema zod estricto (key kebab-case y reservadas, semver, migraciones con `up`/`down` y digests, settings con categoría `snake_case(key)`, scopes/tools/events/channels/hooks, `admin_pages`, `docs` por capacidad, branding con slot de color y SVG monocromo), `manifestDigest`, `sha256` y `assertSafeModuleSql` (rechaza `public.`/`auth.`/`storage.`/…, DDL de roles/esquemas, `GRANT/REVOKE`, `SET ROLE/search_path`, `COPY`).
- **Instalador** (`packages/core/src/modules/service.ts`): verifica digests y documentación/icono/páginas antes de tocar la BD; aplica cada `up` en una transacción como `module_installer` con `search_path = module_<key>`; siembra `settings_categories`/`settings`; registra `module_migrations` y el registry `installed`; máquina de estados con `conflict`; `uninstall` exige `super_admin`, bloquea con concesiones activas sin `confirm`, revierte `down` en orden inverso y limpia settings/categoría/translations/registry (cascade). Grant/revoke por usuario y settings de módulo (secretos enmascarados, cifrado si hay clave).
- **Rutas admin**: `GET /modules`, `GET/PATCH /modules/{key}`, `POST /modules/{key}/{install|activate|deactivate|uninstall}`, `GET/PATCH /modules/{key}/settings`, `POST/DELETE /users/{id}/modules/{key}`. El manifest se carga **server-side** desde `packages/<key>/manifest.json` (el cliente nunca envía DDL).
- **Guard**: `modules:read` para cualquier autenticado; `modules:manage`/`modules:grant` para admin/super_admin. `mcp_exposed=read_write` exige super_admin.
- **CI**: el job `admin` valida `packages/*/manifest.json` (contrato, docs por capacidad, páginas, icono y digests) con `vitest src/modules/manifest.test.ts`; `docs/flows/cicd.md` actualizado.
- **Tests**: 8 de instalador/ciclo de vida (DDL en su esquema, settings, digest roto, SQL inseguro, transiciones, acceso privado/público, settings, uninstall con confirmación, permisos), 4 de API, 5 de contrato/CI del manifest; se añadió `createTestModule` y se actualizaron las suites que insertan claves de módulo para satisfacer las FKs nuevas.
- **Diferido y documentado**: servir `icon.svg`/docs por HTTP, branding/docs en list/detail (task-11), `admin_actions` (tabla de task-06), siembra de traducciones (pipeline task-09) y el empaquetado de `packages/` en el deploy serverless (primer módulo real, task-11).
- **Verde**: lint ✓, tsc ✓, core 124, admin 77, db-tests 174, build ✓.
- **Pendiente para `finalizada`**: QA + auditoría OWASP.
