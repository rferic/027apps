---
id: sprint-06-web
titulo: Web de administración — panel real sobre la API del Core
area: web
estado: en curso
---

Sprint **web-admin**: sustituir el mockup de `apps/admin/src/app/page.tsx` (KPIs y `MEMBERS_ROWS` hardcodeados, `NAV_ITEMS` con enlaces muertos) por el panel real, sobre la API del Core ya en `main`.

**Spec:** `docs/superpowers/specs/2026-11-06-web-admin-design.md` · **Plan:** `docs/superpowers/plans/2026-11-06-web-admin.md`

## Alcance

- Rutas canónicas en inglés (el idioma va en la cookie): `/`, `/members`, `/categories`, `/invitations`, `/keys`, `/modules`, `/settings`, `/docs/api`.
- Shell con marca, navegación, ítem activo, cerrar sesión, selector de idioma, guard de rol en servidor y responsive móvil.
- Dashboard y listas que consumen `/api/v1`, con estados vacío/cargando/error y `request_id` en el error.
- `/docs/api`: visor Scalar del OpenAPI generado desde los schemas zod compartidos.

## Tareas

| # | Tarea | Estado |
|---|---|---|
| 01 | README del sprint | en curso |
| 02 | Setup i18n y ayuda Firebase | finalizada |
| 03 | Dominio local de desarrollo | test |
| 04 | Settings batch write | finalizada |
| 05 | Shell y navegación + `/modules` | pendiente |
| 06 | Dashboard con datos reales | pendiente |
| 07 | Miembros | pendiente |
| 08 | Categorías + invitaciones | pendiente |
| 09 | Claves API + ajustes | pendiente |
| 10 | Documentación de la API | pendiente |
| 11 | Revisión de diseño y UX | pendiente |
| 12 | Canje público de invitaciones | pendiente |

## Dependencias

- API del Core en `main` (✅). No existen aún `GET /me` (task-05), `/admin-actions` (el dashboard lo omite) ni `/openapi.json` (task-10).
- task-12 reutiliza `POST /api/v1/invitations/{token}/redeem` y las invitaciones de task-08; no cambia el contrato.
- OpenAPI: no existe generación en el repo; se construye en task-10.

## Cierre

Un solo PR, squash a `main` por orden del usuario, cuando 05–12 estén `finalizada` con DoD completo (TDD, gates, revisión de segundo agente y auditoría OWASP).
