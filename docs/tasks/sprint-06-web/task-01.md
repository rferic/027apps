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
| 05 | Shell y navegación + `/modules` | finalizada |
| 06 | Dashboard con datos reales | finalizada |
| 07 | Miembros | finalizada |
| 08 | Categorías + invitaciones | finalizada |
| 09 | Claves API + ajustes | finalizada |
| 10 | Documentación de la API | finalizada |
| 11 | Revisión de diseño y UX | en curso |
| 12 | Canje público de invitaciones | pendiente |
| 13 | Scopes de claves API y claves delegadas por propietario | finalizada |
| 14 | Fichas de detalle de invitaciones y módulos | finalizada |
| 15 | Instalar módulos desde el panel | en curso |

## Dependencias

- API del Core en `main` (✅). No existen `GET /me` ni `/admin-actions` (el dashboard los omite, decisión del
  sprint); `/api/v1/openapi.json` llega con task-10 y ya está en el panel.
- task-12 reutiliza `POST /api/v1/invitations/{token}/redeem` y las invitaciones de task-08; no cambia el contrato.
- task-13 endurece el guard de scopes y la gestión de claves (task-02 y task-09); añade `user_id` opcional al alta y un límite de 5 delegadas activas.
- task-14 depende de dos endpoints nuevos del Core (`GET /api/v1/invitations/{id}` y
  `GET /api/v1/modules/{key}/grants`) y reutiliza la confirmación de revocación de task-08 y el aviso de
  concesiones activas de la desinstalación (task-05).
- OpenAPI: el registro vive en `packages/core/src/openapi/registry.ts` y `pnpm check:openapi` verifica el
  documento (`docs/api/openapi.json`) y la paridad con cada `route.ts`; task-14 lo amplía con dos
  operaciones.

## Cierre

Un solo PR, squash a `main` por orden del usuario, cuando 05–15 estén `finalizada` con DoD completo (TDD, gates, revisión de segundo agente y auditoría OWASP).
