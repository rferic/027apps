---
id: sprint-core-design-task-12
titulo: Shell del admin — definición de navegación, roles y consumos (definición)
area: core
estado: pendiente
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

**Criterios de aceptación**: la shell queda definida con roles y navegación; cada sección declara cómo obtiene su dato inicial y cómo muta (API routes, ADR 0004/0005); el guard por rol cubre el panel; el sprint-web puede implementarla sin redecidir arquitectura.

**Referencias**: ADR 0005, ADR 0004 §8, spec de auth §6 (roles), spec diseño §11 (Core: shell del admin), DS v1 (sprint-02), task-02/03/05/06/08, `docs/tasks/sprint-web/task-01.md` (backlog).