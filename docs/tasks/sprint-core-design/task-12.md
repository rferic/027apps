---
id: sprint-core-design-task-12
titulo: Shell del admin — definición de navegación, roles y consumos (definición)
area: core
estado: finalizada
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 12 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega una spec aprobada, sin código.

**Entregable**: spec `docs/superpowers/specs/2026-10-26-admin-shell.md` — la estructura del panel web de administración y cómo consume su API.

**Alcance** (la «shell del admin» de spec §11 Core, definida aquí; su **implementación** la recoge el sprint-web del backlog):
- **Navegación y roles**: estructura del panel (cómo se navega entre secciones del Core), qué ve `super_admin` vs `admin` de grupo (`profiles` + `group_members`, auth §6), guard por rol.
- **Secciones Core**: instance/setup, configuración (task-06), módulos (task-03), grupos y miembros, invitaciones, participantes, API keys/MCP (task-02/05), observabilidad (task-08).
- **Patrón de consumo (ADR 0005)**: Server Components dan el dato inicial (llamando a la API `/api/v1` en el mismo deploy) + librería de fetching en cliente (SWR al arranque; TanStack si un caso lo justifica) con invalidación coordinada (`revalidateTag`); mutaciones solo por API routes (ADR 0004 §8); estados loading/error/empty con el DS.
- **Wizard `/setup`**: dónde vive en el panel (con task-06).

**Decisiones a fijar**: mapa de navegación, nombres y agrupación de secciones, qué acciones exigen `super_admin`, aplicación concreta del ADR 0005 a las secciones del Core, orden de construcción en el sprint-web.

**Estado (2026-10-26):** spec `docs/superpowers/specs/2026-10-26-admin-shell.md` + **mockup `docs/mockups/admin-shell.html`** (Dashboard, Users, detalle de módulo y Operations, claro/oscuro con los tokens de la identidad D).
- **Mapa de navegación** con rol mínimo por página: General (Dashboard), Personas (Users/Categories/Invitations), Plataforma (Modules + detalle/API keys/Devices), Configuración (Settings/Translations), Operaciones (**super_admin**: outbox, jobs, admin_actions), Cuenta. `/login` y `/setup` aparte.
- **Dashboard mínimo**: salud con motivo, 4 KPIs (miembros, categorías, módulos activos, invitaciones), **banners** (setup incompleto, push sin configurar, degradado), actividad reciente (admin_actions) y tarjetas de módulos. Sin métricas históricas.
- **Módulos aportan páginas** (decisión del usuario): `admin_pages` en el manifest (route/label/icon/role), servidas en `/modules/[key]/[route]`, componente por convención en el paquete, **check de CI** (página declarada ↔ fichero), y **settings del módulo generadas** del catálogo (el módulo no las escribe).
- **Guard por rol en servidor** por página y acción; 403 sin enumerar; acciones vía `/api/v1` (ADR 0004/0005); **realtime `admins`** como señal de invalidación.
- **i18n** del panel con el catálogo; estados con el DS; `request_id` visible en errores.
- **Deltas reales aplicados**: task-03 (manifest `admin_pages` con `route` de un segmento validada + check de CI + componente por convención) y task-02 (`PATCH /modules/{key}` acepta `is_public` y `mcp_exposed`).

**Correcciones de revisión + auditoría (2026-10-26)**: 1 Alta (las páginas de módulo corren mismo-origen con la sesión del admin → **modelo de confianza explícito**: código first-party revisado, mismo lint/CSP, módulo `active`, `route` de un segmento; sin iframe en v1, riesgo residual en T4/T13), dashboard **por rol** (un `admin` no lee `/admin-actions` ni `/maintenance/status`), `/setup` desaparece al **completar**, páginas para `currencies`/`audit`/`requeue`/`import`/`/me` + cerrar sesión, contraste **AA** corregido en el mockup (destructivo en outline, `--success-on-tint` en oscuro) y `mcp_exposed` escribible por API.

**Criterios de aceptación**: mapa completo con roles; dashboard mínimo definido; contrato de páginas de módulo con check de CI; guard en servidor sin permisos propios; realtime como invalidación; i18n con el catálogo; **mockup aprobado por el usuario** (DoD de Diseño); revisado por segundo agente y auditoría OWASP.

**Referencias**: `docs/superpowers/specs/2026-10-26-admin-shell.md`, `docs/mockups/admin-shell.html`, ADR 0004/0005, task-03 (manifest), task-04 (canal admins), task-06 (wizard), task-09 (i18n), sprint-web.
