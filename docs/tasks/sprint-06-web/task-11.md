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
(arquitectura de información Inicio/Personas/Plataforma/Ajustes/Documentación, cabecera con logo + nombre de
instancia + idioma + menú de usuario, patrones de lista/detalle/formulario, confirmaciones destructivas y
estados vacío/carga/error). Recorrer la checklist de aceptación UX de 10 puntos contra el panel en marcha, a
375 px y 1280 px, y corregir los hallazgos.

**TDD**: tests de estructura y accesibilidad donde aplique (ítem activo con `aria-current`, sin
`href="#"` en la navegación, cabecera con sesión e idioma, tablas que pasan a tarjetas en móvil) y
regresión por cada hallazgo corregido.

**DoD**: `pnpm lint && pnpm tsc && pnpm test && pnpm i18n:check && pnpm --filter admin build` en verde,
checklist de 10 puntos verificada con evidencia, revisión y auditoría OWASP (A01, A05, A07).

## Iteraciones

| # | Alcance | Estado |
|---|---|---|
| 1 | Inventario de la arquitectura de información y la navegación frente a la spec | hecho |
| 2 | Cabecera, identidad de instancia, idioma y menú de usuario | hecho |
| 3 | Patrones de lista, detalle y formulario | hecho |
| 4 | Estados vacío/carga/error y comportamiento móvil (375 px) | hecho |
| 5 | Settings como padre con una página por categoría y guard por sección | hecho |
| 6 | Monedas como selector múltiple con búsqueda, nombre y símbolo derivados | hecho |
| 7 | Checklist UX de 10 puntos a 375 y 1280 px, revisión y auditoría | pendiente |
| 8 | Fechas de presentación con la zona de la instancia (deuda M2d, ADR 0008 §2) | hecho |
| 9 | Idiomas habilitados con el mismo selector múltiple que las monedas | hecho |
| 10 | Arquitectura de información final: Ajustes plano y grupo Documentación | hecho |
| 11 | Copiado del token de invitación y del secreto de API key en móvil (contexto no seguro por HTTP): fallback sin `navigator.clipboard` y aviso de copia manual | hecho |

### Iteración 10 — Arquitectura de información final (hecho)

- La navegación queda en cinco grupos: **Inicio** (`/`), **Personas** (`/members`, `/categories`,
  `/invitations`), **Plataforma** (`/modules`, `/keys`), **Ajustes** (las cinco secciones) y
  **Documentación** (`/docs/api` y la guía externa de Firebase).
- **Ajustes ya no tiene ítem padre**: cada sección (`/settings/instance`, `/settings/localization`,
  `/settings/security`, `/settings/notifications`, `/settings/rate-limits`) es un destino normal del
  grupo, con icono propio, sin `aria-expanded` ni indentación. El activo es la sección; en `/settings`
  (redirección) se marca la primera sección visible del rol. `security` sigue oculto para `admin`.
- **Documentación** separa el contrato interno (**API**, mismo patrón que el resto) de la **Guía de
  Firebase** (`/help/firebase`), que es un enlace externo con `target="_blank"`,
  `rel="noopener noreferrer"`, el mismo estilo de ítem, `aria-label` que avisa de la nueva pestaña y
  nunca `aria-current`. Rutas sin cambios.
- Etiquetas traducidas (`Ajustes`, `Documentación`, `API`, `Guía de Firebase`) con URLs en inglés;
  claves nuevas en las 8 locales vía `i18n:scan` + `i18n:check`.
- Tests: cinco grupos en orden, destinos por grupo, ausencia del padre Settings y de
  `aria-expanded`/`pl-6`, `security` oculto para `admin` en sidebar y drawer, sección activa y
  `/settings` marcando la primera visible, y el enlace de Firebase con `target`/`rel`/`aria-label`
  sin `aria-current`.

### Iteración 5 — Settings padre/hijos (hecho; navegación sustituida en la iteración 10)

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

- Sin cambios de BD: el nombre y el símbolo se derivan en cliente con
  `Intl.DisplayNames` y `Intl.NumberFormat.formatToParts`, con el `code` como fallback.
- Combobox con chips (`ui/multi-select.tsx`), sin dependencias nuevas: el trigger muestra una chip por
  moneda `enabled` (`símbolo · Nombre`) y el desplegable lleva buscador que filtra por nombre, código o
  símbolo, insensible a mayúsculas y diacríticos (`normalize("NFD")` + `\p{Diacritic}`).
- La moneda por defecto es una chip fija sin botón de quitar y el toggle de su opción se ignora.
- **Cambios en lote**: `PATCH /api/v1/currencies` acepta `{ updates: [{ code, enabled }] }` (1…200, sin
  duplicados) y los aplica en una sola transacción con un único slot de escritura. La moneda por
  defecto sigue protegida (`currency_is_default`) y cualquier fallo revierte todo el lote.
- Pie con contador "{selected} of {total} selected" y "Clear all except the default": pide confirmación
  inline y luego envía **una sola** petición con todas las monedas que se desactivan. Cada toggle
  individual reutiliza el mismo lote con una entrada. Hay un estado `saving` global, un único error con
  su `request_id` y un `router.refresh()` al terminar.
- Teclado: flechas mueven el activo, Enter/Espacio alternan, Escape cierra y devuelve el foco al trigger;
  cierre por clic fuera. `aria-expanded`, `aria-selected`, `aria-multiselectable` y vacío
  "No currencies match".
- Tests: chips y placeholder, filtro por nombre/símbolo/código y diacríticos, chip fija sin botón de
  quitar, `onClear` sin la default, `aria-selected`, contador; el clear-all emite una petición con N
  entradas y nunca una por moneda. En Core: tres cambios en una petición, un solo slot consumido,
  default protegida y atomicidad ante un código inexistente o duplicado.

### Iteración 8 — Fechas con la zona de la instancia (hecho)

- Deuda M2d (ADR 0008 §2): las cuatro llamadas a `Intl.DateTimeFormat` del panel (miembros, detalle de
  miembro, invitaciones y claves) no pasaban `timeZone`, así que el servidor formateaba en UTC y el
  navegador en su zona local: días distintos y error de hidratación.
- `lib/format-date.ts` centraliza `formatDate(value, { locale, timeZone })` y `resolveTimeZone`; un
  valor vacío o inválido cae a `UTC` en vez de heredar la zona del servidor.
- `loadPanelTimeZone()` (cacheado junto a `loadPanelSettings`) lee
  `readPublicSettings(settingsDeps)["localization.timezone"]` y lo pasan las cuatro páginas.
- Tests: `2026-11-06T23:30:00Z` es día 7 en `Europe/Madrid` y día 6 en `UTC`; espía sobre
  `Intl.DateTimeFormat` que exige `timeZone` en la llamada de formato; fallback a `UTC` y `—` para
  valores inválidos.

### Iteración 9 — Idiomas habilitados con MultiSelect (hecho)

- `localization.enabled_locales` deja de ser una lista de checkboxes y usa `ui/multi-select.tsx`.
  Opciones: las 9 locales con su **nombre nativo** (`English, Español, Català, Italiano, Français,
  Deutsch, Português, Galego, Euskara`) y el código (`en`, `es`…) como `hint`, de modo que el buscador
  filtra por nombre o por código.
- `en` es fija: no se puede quitar, porque el Core exige que esté siempre presente.
- Al guardar la sección, el borrador se convierte en array y viaja en el lote de settings
  (`updates` con `localization.enabled_locales`).
- Si el usuario quita el idioma que es `default_locale`, la API responde `validation_failed` con
  `formErrors` de coherencia: el alert muestra el mensaje y el `request_id`, y la selección revierte al
  valor guardado (el resto de ediciones sin guardar se conserva).
- Tests: render con chips y `en` fija, filtro por nombre/código, guardado con el array y alert de
  coherencia con `request_id`; el helper de reversión deja la selección guardada.

### Iteración 3 — Formularios en página (hecho)

- Los formularios de creación dejan el `<dialog>` y pasan a ruta propia:
  `/categories/new`, `/invitations/new` y `/keys/new`. Cada página exige `admin`, fija `instant = false`,
  muestra breadcrumb (`Categorías / Nueva`, etc.), `h1`, enlace "Back" y reutiliza el cuerpo del
  formulario.
- El listado usa un `Link` primario (`/…/new`); ya no hay triggers modales ni el código muerto de los
  diálogos de creación. Las confirmaciones destructivas (borrar categoría, desactivar miembro, revocar
  clave/invitación, quitar miembro) y el drawer móvil conservan su `<Dialog>`.
- El token de invitación y el secreto de la clave se muestran **una sola vez** en la propia página, con
  copiar y "Done" al listado. Mientras se ve el secreto no se puede crear otro sin salir.
- Los `<select>` ad-hoc restantes (3 del wizard, alta de miembro, invitación, clave y selector de
  idioma) pasan a `ui/select.tsx`.
- Tests: render y 403 de las tres páginas, campos y token/secreto en página, enlace `/…/new` en cada
  listado y ausencia del diálogo de creación.

### Iteración 4 — Un solo componente de error (hecho)

- `PanelError` es el único componente de error de carga (código traducido + `request_id` + reintento).
  `MemberError` desaparece y sus usos en `/members` y `/members/[id]` pasan a `PanelError`.
- `panel-errors.ts` unifica el mapa de códigos antes repartido entre `panel-errors.ts` y
  `member-errors.ts`: un import, un mapa, con `slugConflictError` y `panelErrorCodeLabel`.
- `instance.logo_url` desaparece del catálogo y de `CATALOG_DEFAULTS`: deja de publicarse en
  `GET /api/v1/instance` y de poder editarse. `BrandLogo` solo acepta `variant` y `name`. **La fila
  `instance.logo_url` queda huérfana en la tabla `settings` a propósito (no hay migración que borre
  datos); `readSettingViews` ignora las filas sin metadata del catálogo y el sync check de db-tests las
  excluye.**
