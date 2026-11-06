---
id: sprint-06-task-05
titulo: Shell y navegación + `/modules`
area: web
estado: finalizada
adrs: [0004, 0005, 0007]
plan: docs/superpowers/plans/2026-11-06-web-admin.md
spec: docs/superpowers/specs/2026-11-06-web-admin-design.md
---

**Alcance**: route group `(panel)` con guard de rol en servidor (403 sin enumerar), shell con marca/ítem activo/logout/selector de idioma, i18n con los diccionarios del repo y `translations` como overlay, `GET /api/v1/me` para el guard, responsive móvil, y `/modules` read-only que fija el patrón de datos.

**TDD**: guard, nav, i18n, `me`, página con filas/vacío/error.

**DoD**: TDD, lint/tsc/test/i18n:check/build, revisión y OWASP (A01, A07, A05).

## Informe de auditoría (2026-11-06)

**Veredicto**: cambios mayores, sin hallazgos críticos. Se corrigieron los
siguientes:

- **i18n / `translations` vacía**: `public.translations` tenía 0 filas en la
  instancia local y el panel se pintaba en inglés. `loadPanelMessages` parte
  ahora de `getDictionary(locale)` y superpone las filas de la tabla; con la
  tabla vacía, las 9 locales siguen disponibles. Un fallo de la tabla o de
  `getInfra()` degrada a la base y se registra por `deps.logger`, sin datos
  personales.
- **Cabecera a 375 px**: el grupo derecho puede encoger (`min-w-0`), el nombre
  se trunca (`max-w-24 sm:max-w-36`), rol y email se ocultan bajo `sm`, y el
  selector de idioma y "Log out" tienen `min-h-11` (44 px).
- **403 sin salida**: `PanelForbidden` (componente compartido por layout,
  dashboard y `/modules`) muestra el mensaje genérico, el nombre del usuario
  cuando se conoce, el selector de idioma y un formulario de cierre de sesión.
  No enumera rutas ni roles.
- **Dashboard**: el `h1` es el estado real ("Everything is ready." / "Setup is
  incomplete." / "Not installed."), sin repetir el nombre de instancia que ya
  está en la cabecera; con setup incompleto o no instalado enlaza a `/setup`.
  Se eliminaron el `instant = false` y el `DocumentLang` duplicados.
- **`/modules`**: los `code` públicos (`internal`, `insufficient_scope`,
  `rate_limited`, `not_found`) se traducen; un código desconocido se mantiene
  visible; hay enlace "Try again"; una fila que no valida invalida la respuesta
  completa (error, no vacío); se quitó la rama `disabled` muerta del badge.
- **Navegación**: `Link` de `next/link` en lugar de `<a>`, con `aria-current`,
  foco y `min-h-11` intactos; test para `/members-archive` (no debe marcar
  `/members`).
- **Deduplicación**: `loadPanelUser`, `loadPanelMessages` y `loadPanelSettings`
  usan `cache()` de React, de modo que layout y página comparten una sola
  lectura de sesión, traducciones y ajustes públicos por request.
- **Bajos**: claves de `packages/i18n/locales/*.json` y `catalog.en.json`
  ordenadas alfabéticamente; `BrandLogo` usa el nombre de la instancia como
  `alt` cuando hay logo personalizado (el wizard conserva su comportamiento).

**Desviaciones aceptadas con motivo**:

- **ADR 0005 — datos en servidor**: la lista read-only de `/modules` se sirve
  desde un Server Component (llamada en proceso a `/api/v1/modules`); SWR se
  usará en las páginas interactivas (07–09). Queda registrado aquí y en el PR
  del sprint.
- **Destinos aún sin página**: `/members`, `/categories`, `/invitations`,
  `/keys`, `/settings` y `/docs/api` devuelven 404 hasta las tareas 07–10. El PR
  del sprint no se mergea hasta task-11, así que no se publica un menú con
  enlaces muertos.
- **Refresco de token en la llamada en proceso**: el door revalida el token en
  cada request; el caso de token caducado a mitad de render se revisará si
  aparece en uso real.
- **Login de usuario desactivado sin mensaje**: fuera del alcance de esta
  tarea; se tratará en auth/admin.
- **Drawer sin JS y sin avatar**: `<details>` sin mejora progresiva adicional
  ni avatar es la v1 aceptada; el rail de iconos queda para task-11.
- **Estado**: todos los gates (`pnpm --filter admin test`, `pnpm lint`,
  `pnpm tsc`, `pnpm i18n:check`, `pnpm --filter admin build`) en verde.
