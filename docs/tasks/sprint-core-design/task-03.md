---
id: sprint-core-design-task-03
titulo: Sistema de módulos + instalador en runtime — spec (definición)
area: core
estado: test
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 3 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega una spec aprobada, sin código.

**Entregable**: spec `docs/superpowers/specs/2026-10-26-modulo-system.md` — cómo se empaqueta, instala, activa, desactiva y desinstala un módulo en runtime (filosofía plugin).

**Alcance** (refleja el contenido real de la spec):
- **Contrato del `manifest.json`** en `packages/<key>/manifest.json` (cada módulo es un paquete del monorepo): key, name, version, `is_public`, `migraciones` (`up`+`down` obligatorios, digest), `settings` (siembra de `settings_categories`/`settings` con `is_public`), `i18n` (locales), `scopes` (acciones expuestas ADR 0004), `mcp_tools`, `eventos`, `hooks` (reacción a eventos del Core, p. ej. `user.deactivated`). Invariantes validados por esquema zod.
- **Instalador en runtime** (mecánica, se implementará en el backlog de implementación del Core): validar manifest → verificar digest → aplicar migraciones `up` en orden (transaccional) → sembrar settings/i18n/scopes → registry `installed`; `activate`/`deactivate` (estado sin tocar DDL); `uninstall` (revertir `down` + **limpiar `settings_categories`/`settings`/`translations` con `source: module:<key>`** + borrar registry).
- **Seguridad del DDL**: **A+C+D** — esquema zod estricto + `digest` verificado (`module_migrations.ddl_digest`), permisos mínimos de BD (rol acotado a `module_<key>.*`, nunca `auth.*`/tablas del Core), confirmación explícita del super_admin del diff del DDL antes de install/uninstall. Firma criptográfica (Ed25519) **diferida** (decisión B).
- **CI del módulo**: validación mecánica del manifest contra su esquema (check), recálculo del digest, e integración con el check de locales (task-09).

**Decisiones tomadas** (conversación de diseño, 2026-10-26): manifest en `packages/<key>/manifest.json`, seguridad A+C+D (firma B diferida), uninstall limpia settings/translations y delega la semántica de datos al `down` del módulo (el dinero no se borra, spec §12), secuencia de implementación (esta spec es definición; el instalador va al sprint de implementación del Core).

**Criterios de aceptación**: un módulo se especifica, instala y desactiva sin tocar la mecánica del contrato (mecanismo de extensión de api-v1 §5); el DDL es reversible y verificado (digest); el uninstall limpia settings/translations; el CI valida el manifest; coherente con ADR 0004/0007/0008.

**Referencias**: spec datos (`2026-10-26-core-data-model.md` decisiones K/N/O), spec API (`2026-10-26-core-api.md` endpoints de módulos), spec diseño §4, api-v1 §5 (extensión), flujo `docs/flows/new-module.md` (a completar).