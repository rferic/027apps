# Spec — Core: shell del admin (sprint 04, task 12)

**Fecha:** 2026-10-26
**Estado:** Borrador para aprobación del usuario
**Base:** [ADR 0005](../../adr/0005-estado-y-fetching-del-admin.md) (dato inicial servidor + SWR, mutaciones por `/api/v1`, `revalidateTag`) · [ADR 0004 §8](../../adr/0004-bordes-y-capa-de-aplicacion.md) (el admin muta vía API routes) · [spec de realtime](2026-10-26-realtime-notificaciones.md) (canal `admins` como señal de invalidación) · [auth §6](2026-10-25-auth.md) (sesión SSR por cookies, roles) · [Design System v1](2026-10-25-design-system.md) (admin denso estilo OpenRouter, tokens identidad D) · [config](2026-10-26-instance-config.md) (wizard `/setup`, settings por categoría) · [i18n](2026-10-26-i18n-operativa.md) (inglés como clave) · [observabilidad](2026-10-26-observabilidad.md) (`X-Request-Id`, salud)
**Decide el usuario:** mapa de navegación, dashboard mínimo, páginas de módulo en el panel, roles por vista (2026-10-26)
**Mockup:** `docs/mockups/admin-shell.html` (Dashboard, Usuarios, Módulo, Operaciones)

## 1. Objetivo

Definir la **estructura del panel web**: navegación, páginas, roles por vista, cómo consume datos (ADR 0005) y cómo los **módulos aportan sus propias páginas y settings** al panel. Es el contrato que implementa el sprint-web sin redecir nada.

## 2. Mapa de navegación (sidebar agrupada)

| Grupo | Página (ruta) | Contenido | Rol mínimo |
|---|---|---|---|
| — | `/login` | Supabase Auth (email + contraseña) | — |
| — | `/setup` | Wizard de instalación (5 pasos, task-06); desaparece con el primer admin | — |
| **General** | `/` (Dashboard) | Salud, KPIs, banners, actividad reciente | admin |
| **Personas** | `/users` | Tabla de usuarios (filtros `q`/`module`/`categoría`), rol, desactivar | admin |
| **Personas** | `/categories` | Categorías de usuarios + miembros + módulos asignados | admin |
| **Personas** | `/invitations` | Invitaciones (crear, listar, revocar) | admin |
| **Plataforma** | `/modules` | Catálogo: estado, `is_public`, `mcp_exposed`, docs | admin |
| **Plataforma** | `/modules/[key]` | Detalle: docs, settings del módulo, ciclo de vida, páginas del módulo | admin |
| **Plataforma** | `/api-keys` | Claves service/delegadas: crear, revocar, uso | service→**super_admin**; delegadas→propietario |
| **Plataforma** | `/devices` | Dispositivos propios y del panel; revocar | propietario / admin |
| **Configuración** | `/settings/[category]` | Settings por categoría con validación en línea | admin; `security.*`/`public_url`/CORS: **super_admin** |
| **Configuración** | `/translations` | Cobertura por locale, editar/faltantes | admin |
| **Operaciones** | `/operations` | Outbox, última ejecución por job, salud detallada, `admin_actions` | **super_admin** |

**Reglas de navegación:**
- **Sidebar fija** (estilo OpenRouter, DS v1) con los grupos arriba; colapsable.
- Las **páginas de módulo** aparecen dentro de `/modules/[key]` (§5) y, si el módulo lo declara, también como **entradas propias en la sidebar** bajo el grupo "Módulos".
- **Nada de rutas no declaradas**: toda página del panel corresponde a un recurso de `/api/v1`.

## 3. Roles por vista (guard)

- El **layout** resuelve la sesión **server-side** (helper SSR de Supabase, cookies `HttpOnly`/`Secure`/`SameSite` — checklist A07) y resuelve `role`.
- Cada página declara su **rol mínimo** (tabla §2) y **el guard la aplica en servidor**: `admin` sin permiso → página 403 **sin enumerar** (misma para "no existe" y "no puedes").
- **Acciones**: usan el guard del Core (scopes); el panel **no** tiene permisos propios. Si la API devuelve `insufficient_scope`, la acción se oculta/deshabilita con el motivo.
- **Roles especiales en UI**: `super_admin` ve además Operaciones, desinstalar módulos, revocar claves de instancia y `security.*`. Un `admin` no ve esas entradas.
- **Banners de estado** (visibles en el dashboard y en la sidebar): `setup` incompleto, push sin configurar, instancia `degraded`.

## 4. Datos (ADR 0005, sin reabrir)

1. **Lectura inicial** en Server Component vía la propia API (`/api/v1`), entregada a SWR como dato inicial (`<SWRConfig fallback>`).
2. **Vivo en cliente**: SWR revalida al foco y tras mutaciones.
3. **Mutaciones** → `/api/v1` con `Bearer`; al terminar, **actualización de la caché** + `revalidateTag` de la lectura de servidor.
4. **Realtime**: suscripción al canal **`admins`** (task-04) como **señal de invalidación** — cuando llega un evento (`invitation.created`, `module.*`, `user.deactivated`, `settings.updated`), SWR revalida la sección afectada. El panel **no** trata el realtime como fuente de datos.
5. **Estados**: `loading` (skeletons DS), `empty` (empty states DS), `error` (mensaje con `code` traducido + **`request_id`** visible para soporte; botón reintentar).
6. **i18n**: la UI usa el mismo catálogo (task-09): texto inglés como clave, locale del admin; el selector de idioma respeta `enabled_locales`.

## 5. Dashboard mínimo (v1)

| Bloque | Contenido | Fuente |
|---|---|---|
| **Salud** | `ok`/`degraded` con motivo si aplica (Supabase, outbox, job atrasado) | `/health` + `/maintenance/status` |
| **KPIs** | Miembros (usuarios/activos), categorías, módulos activos, invitaciones pendientes | endpoints de lectura |
| **Banners** | setup incompleto · push sin configurar · degradado | `/instance` + `/maintenance/status` |
| **Actividad reciente** | Últimas 5 `admin_actions` (quién, qué, cuándo) | `/admin-actions` |
| **Módulos** | Tarjetas: estado, versión, docs y settings enlazados | `/modules` |

El dashboard **no** incluye gráficos ni métricas históricas en v1 (fuera de alcance; sin APM).

## 6. Páginas de módulo en el panel (nueva decisión)

**Cada módulo puede aportar páginas propias al panel** (p. ej. el **importador de Splitwise**, su dashboard de gastos, su página de liquidaciones), además de su página de **settings** (que el panel genera del catálogo).

**Contrato (manifest, delta a task-03):**

```jsonc
"admin_pages": [
  { "route": "import", "label": "Import from Splitwise", "icon": "upload",
    "group": "module", "role": "admin" },
  { "route": "overview", "label": "Expenses overview", "icon": "chart", "role": "admin" }
]
```

- `route` es **relativa al módulo**: la página se sirve en `/modules/[key]/[route]` (p. ej. `/modules/split-expenses/import`).
- **Componente**: cada página vive en el paquete con la convención `packages/<key>/admin/<route>/page.tsx` (ruteo por convención, renderizado por un catch-all del admin que resuelve módulo+ruta). El mecanismo exacto se fija en el sprint de implementación; el contrato es: **página declarada en el manifest ↔ fichero que existe**.
- **CI**: por cada `admin_pages[].route` debe existir `packages/<key>/admin/<route>/page.tsx` (check mecánico, job `admin`); `role` ∈ `admin|super_admin`; `icon` ∈ DS.
- **Settings del módulo**: el panel **genera la página** de settings a partir del catálogo (`settings_categories` con `source: module:<key>`) — el módulo **no** escribe su página de settings.
- **Datos de la página**: la página del módulo consume `/api/v1` como cualquier otra (ADR 0005), con los scopes del módulo; **nunca** accede directo a la BD.
- **Docs**: el detalle del módulo enlaza su `docs.readme` (task-11).

## 7. Decisiones tomadas (2026-10-26)

| # | Decisión |
|---|---|
| A | **Sidebar agrupada** (General/Personas/Plataforma/Configuración/Operaciones) + páginas de módulo bajo `/modules/[key]` y entradas propias en la sidebar |
| B | **Dashboard mínimo**: salud, KPIs, banners, actividad reciente, tarjetas de módulos; **sin** gráficos históricos |
| C | **Módulos aportan páginas** (`admin_pages` con `route`/`label`/`icon`/`role`, servidas en `/modules/[key]/[route]`, componente por convención en el paquete) **+ settings generadas** del catálogo |
| D | **Guard por rol en servidor** por página y acción; el panel no tiene permisos propios; 403 sin enumerar |
| E | **Realtime `admins`** como señal de invalidación (no fuente de datos); ADR 0005 para datos y mutaciones |
| F | **i18n del panel** con el catálogo (inglés como clave, locale del admin) |
| G | **`/setup`** y banners de estado integrados en el shell (task-06/task-04) |

## 8. Fuera de alcance

- **Implementación** (rutas Next, componentes, SWR wiring) → sprint-web.
- **Gráficos/métricas históricas, paginación infinita en tablas grandes** → evaluación posterior.
- **Páginas de módulo fuera del panel** (p. ej. web pública de un módulo) → spec del módulo.
- **Mockups de cada página** (solo dashboard en v1; el resto se implementa con el DS) → sprint-web con Storybook.

## 9. Criterios de aceptación

- Mapa de navegación completo con **rol mínimo por página**, sin páginas sin recurso ni recursos sin página.
- Dashboard mínimo definido (salud, KPIs, banners, actividad, módulos) **sin** métricas históricas.
- Contrato de **páginas de módulo** (`admin_pages`) con CI verificable y settings **generadas** del catálogo.
- Guard de rol en servidor, 403 sin enumerar, acciones vía `/api/v1` (ADR 0004/0005).
- Realtime como invalidación, i18n con el catálogo, estados con el DS y `request_id` visible.
- Mockup del dashboard aprobado por el usuario (DoD de Diseño).
- Revisado por segundo agente y **auditoría OWASP** (XSS/CSP, roles).

## 10. Referencias

- ADRs 0004/0005 · realtime (canal `admins`) · config (wizard/settings) · i18n · observabilidad
- Design System v1: `docs/superpowers/specs/2026-10-25-design-system.md` · Mockup: `docs/mockups/admin-shell.html`
- Sprint-web (implementación): `docs/tasks/sprint-web/task-01.md`
- Plan: `docs/superpowers/plans/2026-10-26-sprint-core-design.md` · Task: `docs/tasks/sprint-core-design/task-12.md`