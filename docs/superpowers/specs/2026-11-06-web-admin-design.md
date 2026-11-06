# Spec — Web de administración: panel real sobre la API del Core (sprint 09)

**Fecha:** 2026-11-06
**Estado:** Borrador para aprobación del usuario
**Base:** shell del admin (task-12) · core-api (§ usuarios, categorías, invitaciones, claves, módulos, ajustes) · ADR 0004 (API-first) · ADR 0005 (dato inicial servidor + SWR) · ADR 0007 (envelope, `request_id`) · i18n (panel vía `translations`, cookie `027_locale`)

## 1. Objetivo

Convertir el mockup actual (`KPIs` y `MEMBERS_ROWS` hardcodeados, `NAV_ITEMS` con `href:"#miembros"`) en el panel real: shell con navegación por rutas, dashboard y páginas de gestión que consumen `/api/v1` (API-first), con i18n en los 9 locales y estados vacío/cargando/error reales. No se redecide arquitectura: hereda ADR 0004/0005/0007 y el shell spec. Nada de datos fake en producción.

## 2. Rutas canónicas (inglés; el idioma va en la cookie)

| Ruta | Página | Tarea | Rol mínimo |
|---|---|---|---|
| `/` | Dashboard | 06 | admin |
| `/members` | Usuarios: listado, detalle, rol, desactivar | 07 | admin (rol/desactivar: super_admin) |
| `/categories` | Categorías de usuarios | 08 | admin |
| `/invitations` | Invitaciones | 08 | admin |
| `/keys` | Claves de API | 09 | propietario · super_admin (service) |
| `/modules` | Catálogo de módulos (solo lectura) | 05 | admin |
| `/settings` | Ajustes de instancia | 09 | admin; `security.*`/`public_url`/CORS: super_admin |
| `/docs/api` | Visor OpenAPI | 10 | admin |

**Delta frente al shell spec:** `/members` (antes `/users`), `/keys` (antes `/api-keys`), `/settings` agrupado en una página. **Diferido:** `/modules/[key]`, `/devices`, `/operations`, `/translations`, `/me` (salvo `/me` en task-05 para el guard).

## 3. Shell y navegación

- Layout de panel (`(panel)/layout.tsx`): resuelve sesión y `role` en servidor; marca, navegación agrupada, ítem activo (`aria-current`), cerrar sesión (`signOutAction`) y selector de idioma (`LocaleSwitcher`).
- Guard por rol en servidor: cada página declara su rol mínimo; sin permiso → 403 sin enumerar. Las acciones se ocultan/deshabilitan con motivo si la API responde `insufficient_scope`.
- Responsive: sidebar a iconos <1024 px, drawer en móvil; tablas a tarjetas.
- Banner `setup_incomplete` (vía `/instance`).

## 4. i18n del panel

- Locale desde la cookie `027_locale` (`resolveLocale`); nunca en la URL.
- El panel usa la tabla `translations`: el Server Component pide `GET /api/v1/translations?locale=xx` y pinta con `t("literal", map)`.
- Toda cadena nueva es literal `t("...")`; `pnpm i18n:scan`; los 8 locales los rellena el `traductor`; `pnpm i18n:check` en verde.

## 5. Dashboard (v1, por rol en servidor)

Salud (`/health`), KPIs (`/users`, `/user-categories`, `/modules`, `/invitations`), banners (`/instance`), tarjetas de módulos (`/modules`) y salud detallada para super_admin (`/maintenance/status`). Sin actividad reciente ni gráficos (`/admin-actions` no existe). Un admin nunca recibe bloques de super_admin: se compone en servidor.

## 6. Páginas por recurso

**Miembros**: tabla (nombre, email, rol, estado, fecha), filtro `q`, paginación; detalle con perfil; editar `display_name`/`locale`/`timezone` (`users:write`); cambiar rol (`roles:assign`; solo super_admin toca roles de super_admin; el root no se demota); desactivar (`users:deactivate`, super_admin, con confirmación). Los invariantes viven en `packages/core/src/users/service.ts`.

**Categorías**: nombre, slug, miembros, módulos; CRUD, añadir/quitar miembro, asignar/quitar módulo (materializa `user_modules`).

**Invitaciones**: email, nombre, categoría, módulos, estado, expiración; crear y revocar.

**Claves**: kind, name, prefix, scopes, fechas; secreto mostrado una sola vez al crear; revocar; uso agregado solo super_admin.

**Ajustes**: categorías y valores; `is_secret` solo muestra `configured`; edición por lotes con `PATCH /settings` (task-04); `security.*`, `public_url` y CORS solo super_admin; localización y monedas (la default no se desactiva).

**Módulos**: solo lectura (key, name, version, state, `is_public`).

## 7. Estados reales

Toda lista/detalle muestra vacío, cargando y error (con `code` traducido, `request_id` visible y botón reintentar). Nunca una tabla que parezca llena si no lo está.

## 8. OpenAPI (`/docs/api`)

- **Visor: Scalar** (`@scalar/api-reference-react`), MIT, componente React, autoalojado en el bundle (respeta el CSP `script-src 'self'`), UI densa y dark mode.
- **Generación desde zod**: registro declarativo en `packages/core/src/openapi/` (path, método, schemas de entrada/salida, summary, scopes) con `zod-to-openapi`, reutilizando los schemas compartidos. Script `pnpm --filter @027apps/core openapi:generate` que emite `docs/api/openapi.yaml` (commiteado). En runtime, `GET /api/v1/openapi.json` sin auth.
- **Límite honesto**: el mapeo ruta↔método↔schema no es derivable de los route handlers actuales (imperativos `withDoor`); se declara una vez y el CI verifica (a) yaml al día y (b) paridad entre `apps/admin/src/app/api/v1/**/route.ts` y el registro. No es OpenAPI a mano: los schemas son los zod compartidos.

## 9. Riesgos

- `GET /api/v1/me` no existe: el guard resuelve el rol en servidor (patrón `ProfilesPort`/`resolveCaller`) o se implementa `/me` en task-05.
- Compatibilidad de `zod-to-openapi` con zod 4.6.7: verificar antes de fijar la dependencia.
- El visor debe servirse del bundle, no de un CDN, por el CSP.
- El panel ya es dinámico (`instant = false`), así que el fetch de `translations` en el layout no rompe el shell estático.
- Nombres de ruta distintos del shell spec: registrados como delta.

## 10. Criterios de aceptación

- Las 8 rutas canónicas en inglés resuelven páginas reales, sin enlaces muertos.
- Nada de datos fake: dashboard y listas consumen `/api/v1`; los fixtures viven en tests.
- Shell con marca, ítem activo, cerrar sesión y selector de idioma; responsive en móvil.
- Guard por rol en servidor con 403 sin enumerar.
- Estados vacío/cargando/error con `request_id`.
- i18n con `t("literal")`, 9 locales, `i18n:check` en verde.
- `/docs/api` renderiza el OpenAPI generado; yaml al día y paridad de rutas en verde.
- Revisión de segundo agente y auditoría OWASP (A01, A03, A05, A07).
