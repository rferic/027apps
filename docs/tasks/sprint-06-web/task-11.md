---
id: sprint-06-task-11
titulo: Revisión de diseño y UX
area: web
estado: en curso
adrs: [0004, 0005]
plan: docs/superpowers/plans/2026-11-06-web-admin.md
spec: docs/superpowers/specs/2026-11-06-web-admin-ux-review.md
---

**Alcance**: aplicar todas las decisiones de `docs/superpowers/specs/2026-11-06-web-admin-ux-review.md`
(arquitectura de información Inicio/Personas/Plataforma/Sistema, cabecera con logo + nombre de instancia +
idioma + menú de usuario, patrones de lista/detalle/formulario, confirmaciones destructivas y estados
vacío/carga/error). Recorrer la checklist de aceptación UX de 10 puntos contra el panel en marcha, a
375 px y 1280 px, y corregir los hallazgos.

**TDD**: tests de estructura y accesibilidad donde aplique (ítem activo con `aria-current`, sin
`href="#"` en la navegación, cabecera con sesión e idioma, tablas que pasan a tarjetas en móvil) y
regresión por cada hallazgo corregido.

**DoD**: `pnpm lint && pnpm tsc && pnpm test && pnpm i18n:check && pnpm --filter admin build` en verde,
checklist de 10 puntos verificada con evidencia, revisión y auditoría OWASP (A01, A05, A07).

## Iteraciones

| # | Alcance | Estado |
|---|---|---|
| 1 | Inventario de la arquitectura de información y la navegación frente a la spec | pendiente |
| 2 | Cabecera, identidad de instancia, idioma y menú de usuario | pendiente |
| 3 | Patrones de lista, detalle y formulario | pendiente |
| 4 | Estados vacío/carga/error y comportamiento móvil (375 px) | pendiente |
| 5 | Settings como padre con una página por categoría y guard por sección | hecho |
| 6 | Monedas como selector múltiple con búsqueda, nombre y símbolo derivados | hecho |
| 7 | Checklist UX de 10 puntos a 375 y 1280 px, revisión y auditoría | pendiente |

### Iteración 5 — Settings padre/hijos (hecho)

- `/settings` redirige a la primera categoría visible del rol (la del API; orden canónico como
  fallback). Rutas: `/settings/instance`, `/settings/localization`, `/settings/security`,
  `/settings/notifications`, `/settings/rate-limits`.
- `security` exige `super_admin`: un `admin` recibe el 403 genérico y ni siquiera se lee la API.
  Una sección que no es categoría real llama a `notFound()`.
- Cada página carga `loadSettingsCategories()` y se queda con su categoría; el formulario recibe solo
  esa categoría, así que el lote de guardado envía solo sus claves. Breadcrumb `Settings / <Sección>`
  y `h1` de la sección.
- `PanelNav` (sidebar y drawer) muestra Settings como padre con hijos indentados, `aria-expanded`
  abierto solo si el path empieza por `/settings` y `aria-current` en el hijo activo. Security se omite
  para `admin`.
- Tests: redirección por rol, render aislado de cada categoría, 403 de `security`, `notFound()` de
  sección inválida, solo las claves de la sección en el formulario y árbol padre/hijo en la nav.

### Iteración 6 — Monedas multi-select (hecho)

- Sin cambios de BD ni de API: el nombre y el símbolo se derivan en cliente con
  `Intl.DisplayNames` y `Intl.NumberFormat.formatToParts`, con el `code` como fallback.
- Buscador `type="search"` que filtra por nombre, código o símbolo, insensible a mayúsculas y
  diacríticos (`normalize("NFD")` + `\p{Diacritic}`).
- Lista `fieldset`/`legend` con una fila por moneda (`símbolo · Nombre (CODE)`); las marcadas son
  `enabled`. La moneda por defecto está marcada, no se puede desmarcar y se explica con
  "Default currency".
- "Deselect all except the default" pide confirmación inline y luego aplica un `PATCH` por moneda
  no-default. Cada toggle individual también es un `PATCH`; hay `saving` por fila, error inline con
  `request_id` y un `router.refresh()` al terminar el lote.
- Contador "{enabled} of {total} enabled" y vacío "No currencies match".
- Tests: filtro por nombre/símbolo/código y diacríticos, default no desmarcable, "deselect all" que no
  toca la default, un `PATCH` por cambio, contador y vacío.
