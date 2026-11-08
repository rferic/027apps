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
| 7 | Checklist UX de 10 puntos de la spec §9 (a 375 y 1280 px), revisión y auditoría | pendiente |
| 8 | Fechas de presentación con la zona de la instancia (deuda M2d, ADR 0008 §2) | hecho |
| 9 | Idiomas habilitados con el mismo selector múltiple que las monedas | hecho |
| 10 | Arquitectura de información final: Ajustes plano y grupo Documentación | hecho |
| 11 | Copiado del token de invitación y del secreto de API key en móvil (contexto no seguro por HTTP): fallback sin `navigator.clipboard` y aviso de copia manual | hecho |
| 12 | Paginación en servidor de todas las listas del panel, componente compartido, filtros de cliente y regla escrita | hecho |
| 13 | Reactivación de miembros desactivados y filtros de rol/estado en `/members` | hecho |
| 14 | Borrado definitivo de un miembro desactivado (`DELETE /users/{id}/purge`) | hecho |
| 15 | Filtro por defecto `active` en `/users` y `/members`; `all` explícito | hecho |
| 16 | Categorías por usuario visibles y filtro por categoría en `/members` | hecho |
| 17 | Invitaciones: reglas al crear, errores por campo, «Create another» y filtro por defecto pendiente | hecho |
| 18 | Formularios de creación sin estado residual (secreto/token de la visita anterior) | hecho |
| 19 | Claves: scopes derivados de `kind` + `role_cap`, poda de selecciones inválidas | hecho |
| 20 | Filtro por defecto vivo (`active`) en `/keys` y `/modules`; `all` explícito | hecho |
| 21 | Filtros de tipo y propietario en `/keys` (API `kind`/`user`) | hecho |
| 22 | Claves: permisos y revocación movidos de la lista a una ficha de detalle `/keys/{id}` | hecho |
| 23 | Claves: edición de nombre, permisos y caducidad; los permisos de módulo del propietario se ofrecen en alta y edición | hecho |
| 24 | Claves: el formulario se refresca tras guardar (revalidatePath + remontaje por huella de datos) | hecho |
| 25 | Claves: caducidad relativa (horas/días/meses/años) en alta y edición, y state=expired filtrado en servidor | hecho |
| 26 | Filas de lista clicables en claves, miembros y categorías (patrón compartido, border-separate para que el relative del tr sea fiable) | hecho |
| 27 | Revisión de estilo de la tarea 13 y extracción de las primitivas compartidas de los formularios de clave | hecho |
| 28 | Guardia de CORS al guardar la lista de orígenes y limpieza de la fila `instance.logo_url` | hecho |

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

### Iteración 12 — Paginación en servidor de todas las listas (hecho)

- Core: `GET /api/v1/user-categories`, `/invitations`, `/api-keys` y `/modules` aceptan `limit`
  (1..100, default 20) y `offset` (>=0, default 0), y devuelven `{ <recurso>, total, limit, offset }`.
  `total` sale de un `count(*)` en la misma consulta (CTE `total` + `page`) y el orden es estable:
  `created_at desc, id desc` (módulos: `installed_at desc, key desc`).
- Los valores de query se capan con zod (`.coerce.number()`), no devuelven 400: `limit` fuera de rango
  se recorta y el texto inválido cae al default. `packages/core/src/api/pagination.ts` centraliza la regla.
- OpenAPI documenta `limit`/`offset` (y `q` en `/users`) mediante `query` en el registro, y los schemas
  de lista publican `total`/`limit`/`offset`.
- Admin: `components/ui/pagination.tsx` sustituye la paginación local de miembros y se usa en
  `/members`, `/categories`, `/invitations`, `/keys` y `/modules`; siempre visible (deshabilitada si
  hay una sola página), con `aria-current="page"`. Cada listado envía `page` por query y `limit=20`.
- Filtros de cliente sobre la página ya paginada: categorías por nombre/slug, invitaciones por estado,
  claves por estado (ya existía) y módulos por estado/público. Nunca se descargan todos los registros.
- Página fuera de rango: redirige a la última solo si `page > pages`; la última página vacía se muestra
  como vacío real, sin bucles. El dashboard usa `total` para categorías/módulos y pide `limit=100` a las
  listas que alimentan sus KPIs.
- Regla escrita en `docs/conventions/code-style.md` (§ Listas y paginación) y en la spec UX §6.
- Tests: paginación por recurso en Core (página 1 con `limit=2`, página 2 con `offset=2`, `total`,
  clamp de `limit`, 401 sin sesión), helper de query, componente `Pagination`, helpers de página y
  página/filtros de cada listado del panel.

### Iteración 13 — Reactivación y filtros de miembros (hecho)

- **Endpoint elegido: `POST /api/v1/users/{id}/restore`**, no `PATCH { active: true }`. La
  desactivación ya es `DELETE /users/{id}` y `PATCH /users/{id}` acepta solo campos de perfil/rol
  (`UserPatch` es `.strict()`); añadir `active` a ese cuerpo mezclaría dos operaciones con permisos
  distintos (`users:write` frente a `users:deactivate`) y rompería el contrato del PATCH. `POST` sobre
  un subrecurso `restore` deja el permiso, el rate limit de escritura y el 200 idempotente en un único
  sitio, y se documenta como operación propia en OpenAPI.
- Core: `restoreUser` exige sesión `super_admin` (mismo scope `users:deactivate` que desactivar).
  Perfil inexistente → 404; ya activo → 200 sin escritura (idempotente); si estaba desactivado,
  `deactivated_at = null, updated_at = now()` y devuelve el `UserView`. No hay regla especial para el
  root ni para el último `super_admin`: reactivar siempre es seguro, así que no hay lock de rol. No se
  resucitan las API keys ni los dispositivos revocados al desactivar (la revocación es definitiva).
  No se emite un evento nuevo: el catálogo de realtime es cerrado y `user.restored` requeriría spec.
- `GET /users` acepta `role` (`super_admin|admin|user`) y `state` (`active|deactivated`), validados con
  zod en el borde (valor desconocido → `validation_failed` 400). Se combinan con `q` y la paginación.
  `total` cuenta todos los filtros; `active_total` cuenta activos con `q` + `role` e ignora `state`.
- Admin: en `/members/[id]`, un miembro desactivado muestra **Reactivate member** (acción primaria,
  diálogo breve) en lugar de la zona de peligro, solo para `super_admin`; tras reactivar hace
  `router.refresh()`. La zona de peligro explica que la desactivación es reversible.
- `/members` añade dos `Select` (rol y estado) al formulario GET, combinados con `q`; los filtros se
  conservan en la paginación y en el enlace de reintento. Sin resultados hay vacío propio con
  "Clear filters".
- **Borrado físico:** se implementa en la iteración 14 como operación propia y separada de la
  desactivación; nunca reutiliza el `DELETE` soft.
- Tests: Core (restore ok, 404, idempotente, 403 no super_admin; filtro por rol, por estado, combinado
  con `q` + paginación y `total`), Admin (botón solo con desactivado + `super_admin`, `restoreMember`
  llama a `POST /users/{id}/restore`, envío y conservación de `role`/`state`, vacío de filtro) y
  OpenAPI (parámetros `role`/`state` y operación `restore`).

### Iteración 14 — Borrado definitivo de un miembro (hecho)

- **Operación propia**: `DELETE /api/v1/users/{id}/purge`, no el `DELETE /users/{id}` existente, que
  sigue siendo soft. Scope `users:deactivate` (solo sesión `super_admin`), rate limit de escritura,
  `204` sin cuerpo y `404` si el perfil no existe.
- **La desactivación es requisito**: un perfil activo responde `409` ("Deactivate the member before
  deleting it"). Así el borrado físico nunca es un clic accidental y la regla coincide con la UI, que
  solo lo ofrece junto a "Reactivate". También responden `409` el propio actor, el root (aunque esté
  desactivado: se comprueba el `super_admin` más antiguo, no solo los activos) y el último
  `super_admin` activo.
- **Atomicidad**: una transacción con el advisory lock de roles. Antes de borrar se anulan las
  referencias de autoría que bloquearían el `delete from auth.users`: `settings.updated_by` +
  `updated_by_key`, `api_keys.created_by`, `invitations.created_by`, `translations.updated_by`,
  `user_categories.created_by`, y también `user_modules.granted_by` /
  `user_category_modules.assigned_by` (el listado inicial no las incluía y también bloquean), más las
  referencias `*_by_key` a sus propias claves delegadas (esas claves caen por cascada). El perfil y
  sus dispositivos y claves delegadas caen por cascada.
- **Historial que se pierde**: esas filas sobreviven, pero sin actor (la atribución de auditoría se
  anula); las claves de servicio que creó quedan sin creador. La migración `0014_user_purge.sql`
  relaja los `CHECK num_nonnulls(...) = 1` a `<= 1` y quita el `NOT NULL` de `api_keys.created_by`
  para que una fila pueda sobrevivir a su actor.
- **UI**: en `/members/[id]`, junto a **Reactivate** y solo con perfil desactivado + `super_admin`,
  aparece **Delete permanently** en su propia tarjeta destructiva. El `<dialog>` exige escribir el
  nombre del miembro para habilitar el botón, avisa de que no se puede deshacer y de que se pierde su
  historial de auditoría; al borrar vuelve a `/members`.
- Tests: Core (purge ok + referencias anuladas, activo/root/propio/último super_admin → 409, 404, 403
  no super_admin, 204), Admin (botón solo si desactivado + super_admin, confirmación deshabilitada
  hasta escribir el nombre, `purgeMember` llama a `DELETE /users/{id}/purge` y navegación a
  `/members`) y OpenAPI (operación `purge` 204 bajo `users:deactivate`).

### Iteración 15 — Filtro por defecto: activos (hecho)

- **Core**: `GET /users` acepta `state = active | deactivated | all`; sin `state` filtra por
  `active` (antes no filtraba). `all` es el opt-out explícito. El zod del borde, el `total` y la
  documentación se alinean; `active_total` sigue ignorando `state`.
- **Admin**: `/members` arranca en **activos** aunque la URL no traiga `state`; el selector no tiene
  opción vacía y **All** se envía como `state=all` (no se omite). Búsqueda, filtro de rol,
  paginación y reintento conservan `state`; el enlace "Clear filters" vuelve al valor por defecto.
- **Dashboard**: el KPI de miembros pide `state=all&limit=100` porque cuenta todos los perfiles;
  cualquier lectura de `/users` que necesite todos los estados debe hacerlo explícito.
- Tests: Core (default activo, `all` incluye desactivados, valor desconocido → 400), Admin (select por
  defecto activo sin parámetro, `All` viaja como `state=all` y se conserva en paginación) y
  `panel-members` (URL `state=all`).

### Iteración 16 — Categorías por usuario y filtro por categoría (hecho)

- **Core `UserView`**: añade `categories: Array<{ id, name }>` **ordenado por nombre**. Tanto la lista
  como el detalle (`getUser`) las agregan en la **misma consulta** con
  `left join user_category_members + user_categories` y `json_agg(... order by c.name) filter (where
  c.id is not null)` + `coalesce(..., '[]')`: sin N+1 y sin lecturas extra por usuario.
- **Filtro `category`**: `GET /users` acepta `category` (uuid) y devuelve solo los miembros de esa
  categoría. Se valida con zod en el borde (`z.uuid()`); un valor que no es uuid → `validation_failed`
  (400). Se combina con `q`, `role`, `state` y la paginación; **`total` y `active_total` reflejan el
  filtro** (el conteo usa el mismo `exists` de pertenencia).
- **OpenAPI**: `User.categories` (componente `UserCategoryRef`) y el parámetro `category` de
  `GET /users`; documento regenerado y paridad verificada.
- **Admin `panel-members`**: `MemberRow` incorpora `categories` (una entrada malformada invalida la
  fila) y `loadMembers` reenvía `category`.
- **`/members`**: columna **Categorías** con chips del nombre, **máximo 3** y chip `+N` si hay más;
  sin categorías → `—`. En móvil, la misma fila dentro de la tarjeta. Nuevo `FilterSelect`
  **Categoría** alimentado por `GET /user-categories?limit=100`, combinable con rol, estado y `q`, y
  conservado en paginación, búsqueda y reintento.
- **Sentinela elegida**: "All categories" es el valor vacío del select; `filterHref` **elimina** la
  clave `category` de la URL. No existe `category=all` (a diferencia de `state=all`) porque para
  categorías la ausencia del parámetro ya significa "sin filtro" y el API solo acepta uuid.
- **`/members/[id]`**: bloque **Categorías** con enlaces a `/categories/{id}` o, si no tiene, texto
  vacío con enlace a Categorías.
- **Naming**: la entidad se llama **Categorías** en toda la interfaz; no se introduce "grupos" como
  sinónimo. Un eventual renombrado a "Grupos" requeriría su propia tarea de producto y no se hace aquí.
- Tests: Core (usuario con 2 categorías y orden, sin categorías → `[]`, filtro por categoría con
  `total`/`active_total`, combinado con `q`/`role`/`state`, detalle); Admin (chips y `+N`, `—`,
  `category` enviado y conservado en paginación y búsqueda, opciones del select, uuid inválido
  ignorado, detalle con enlaces y vacío); i18n (`All categories`, `No categories assigned.` en las 8
  locales).

### Iteración 17 — Invitaciones: reglas, errores por campo, «Create another» y filtro por defecto (hecho)

- **Core, reglas al crear** (`packages/core/src/invitations/service.ts`): el email se normaliza
  (trim + minúsculas) antes de compararlo y de guardarlo. `createInvitation` rechaza ahora:
  - un email que ya es de una cuenta (`auth.findUserByEmail`) → `conflict` con
    `details.code = "email_registered"`;
  - un email con otra invitación **pendiente** (no usada, no revocada y `expires_at > now`) →
    `conflict` con `details.code = "pending_invitation"`.

  Una invitación usada o caducada no bloquea: ese email se puede volver a invitar. La comprobación
  de pendientes y el `insert` van en la **misma transacción**, serializados por
  `pg_advisory_xact_lock(hashtext('invitation:<email>'))`: dos creates concurrentes del mismo email
  dejan exactamente una invitación (verificado con dos conexiones reales, no con un fake).
- **Contrato de error**: el envelope de ADR 0007 no publica el mensaje propio de un `DomainError`
  (`toEnvelope` siempre renderiza el canónico del código), así que el caso concreto viaja en
  `error.details.code`. El panel mapea **por ese código**, nunca por el texto: `conflict` sin un
  código conocido sigue mostrando la etiqueta genérica.
- **Core, filtro `status`** en `GET /api/v1/invitations`: `pending | used | expired | revoked | all`.
  `all` (y la ausencia del parámetro) es «sin filtro»; el valor se valida con zod en el borde y uno
  desconocido es `400 validation_failed` (no se recorta como `limit`/`offset`, porque aquí sí cambia
  el resultado). El `total` se cuenta sobre el CTE ya filtrado, así que lista y paginador coinciden.
  `invitationsQuerySchema` documenta el parámetro y `docs/api/openapi.json` se regenera.
- **Admin, errores por caso**: `MutationErrorDetails` publica `details.code`;
  `panel-errors.invitationConflictError()` traduce `email_registered` y `pending_invitation`.
  En `/invitations/new` se pintan como `fieldErrors.email`, junto al campo
  (`aria-invalid` + `aria-describedby`), y **no** como alerta genérica.
- **Admin, «Create another»**: tras crear, el panel del token ofrece **Create another** junto a
  **Done**. Si el token no se ha copiado, pide confirmación inline («The token won't be shown again.»);
  si ya se copió, resetea sin preguntar. El reset deja `phase: "form"`, limpia
  `token`/`copied`/`copyFailed`/`error`/`fieldErrors`, vacía el formulario con `formKey + 1`
  (remonta los campos no controlados) y **no sale de la página**. El `useEffect` de montaje limpia
  el estado de una instancia cacheada al volver a entrar.
- **Admin, filtro por defecto pendiente**: `/invitations` arranca en **pending** aunque la URL no
  traiga `status`; la opción **All** es un valor real (`status=all`), no la opción vacía. `pending`
  se omite de la URL canónica (misma regla que `state=active` en `/members`), y paginación, reintento
  y redirección conservan el filtro. El estado se filtra en el Core, no sobre la página ya paginada
  (antes una página podía quedarse vacía aunque hubiera pendientes en la siguiente).
- **i18n**: cuatro claves nuevas (`Create another`, los dos conflictos y el aviso de token) en
  `catalog.en.json` y en las 8 locales, con `i18n:scan` + `i18n:check`.
- Tests: Core (pendiente duplicado → 409 con `details.code`, email de miembro → 409, usada/caducada
  permitidas, normalización, dos creates concurrentes dejan una, `status` enviado al servicio y valor
  desconocido → 400, documento OpenAPI con el parámetro); db-tests (mismas reglas contra Postgres,
  filtro por estado con `total` coherente y carrera real con dos conexiones); Admin (mensajes por
  `details.code` en `panel-errors` y en el resultado de la mutación, «Create another» con y sin
  confirmación en el reducer, panel en estado de confirmación, filtro por defecto pendiente, `all`
  explícito y conservado en paginación).

### Iteración 18 — Formularios de creación sin estado residual (hecho)

- **Causa**: con Cache Components, Next.js conserva las rutas con React `<Activity>` en vez de
  desmontarlas. Al salir de `/keys/new` o `/invitations/new` y volver, el `useState`/`useReducer`, los
  valores del DOM y el resultado de la creación sobreviven; solo `/invitations/new` tenía un reset
  (el `useEffect` de la iteración 17) y `/keys/new`/`/categories/new`, ninguno, así que una visita
  nueva podía reabrir el secreto o el token anterior. El patrón común lo resuelve para los tres.
- **Un patrón para los tres formularios**: `apps/admin/src/lib/use-create-form.ts` exporta el reducer
  común (`phase`, `result` —secreto o token—, `copied`, `copyFailed`, `confirmingAnother`,
  `submitting`, `error`, `fieldErrors`, `formKey`) y el hook `useCreateForm()`. El hook limpia en el
  cleanup (mientras la ruta está oculta), vuelve a limpiar al mostrarse y expone `reset()` y
  `formKey`; `formKey` remonta el subárbol para vaciar también los campos no controlados y el estado
  del propio navegador.
- `/categories/new`, `/keys/new` y `/invitations/new` lo usan. "Done" navega al listado; "Create
  another" de invitaciones llama a `reset()` (con confirmación inline si el token no se copió).
- Tests: reducer compartido (un reset desde `created` borra secreto/token, error, `fieldErrors` y
  flags; confirmación y copia), paneles del secreto/token, y formularios que renderizan vacíos.

### Iteración 19 — Scopes de claves derivados de tipo y cap (hecho)

- `role_cap` ya no arranca en `admin`: empieza vacío y el selector de `service` lo exige. Sin cap solo
  se ofrecen los scopes comunes a ambos caps; `maintenance:run` y `users:deactivate` aparecen al
  elegir `super_admin`. Un cambio de `kind` limpia el cap.
- `apiKeyFormReducer` es la única fuente de `kind`/`roleCap`/scopes: al cambiar tipo o cap **poda** los
  scopes seleccionados que dejen de estar permitidos y no los restaura al volver atrás. Los scopes
  ofrecidos se derivan siempre en render con `allowedApiKeyScopes(kind, roleCap)`; los checkboxes son
  controlados y un scope fuera del par actual se ignora.
- Cambiar tipo o cap despacha `clear-field-error` para borrar el error de `role_cap`; el submit valida
  el cap y lo muestra junto al campo (`Choose a role cap.`, nueva clave i18n en las 9 locales).
- Tests: `service` + `admin` sin `maintenance:run`/`users:deactivate`, `service` + `super_admin` con
  ambos, `delegated` nunca, poda al bajar el cap y al cambiar de tipo, no restauración y scope no
  permitido ignorado.

### Iteración 20 — Filtro por defecto vivo en claves y módulos (hecho)

- `/keys` arranca en **active** (no revocadas) y `/modules` en **active**; **All** es un valor real
  (`state=all`), no la opción vacía. El valor por defecto se omite de la URL canónica
  (`stateParam`), y paginación, reintento y redirección lo conservan. "Clear filter" vuelve al valor
  por defecto.
- Tests: default sin parámetro (solo filas vivas y URL sin `state`), `state=all` explícito con las
  revocadas/no activas, conservación del filtro en la paginación y en la redirección.
- **Revertido en `/modules` por decisión del usuario**: `/modules` pasa a arrancar en **All**
  (`DEFAULT_STATE = "all"`). Motivo: un módulo instalado pero desactivado sigue siendo parte del
  catálogo y el usuario quiere verlo por defecto. `All` se muestra primero en el select y, al ser el
  defecto, se omite de la URL canónica; `state=active` y `state=disabled` siguen en la URL. `/keys`
  mantiene `active`. Excepción documentada en `docs/conventions/code-style.md`.

### Iteración 21 — Filtros de tipo y propietario en `/keys` (hecho)

- La lista añade dos `FilterSelect`: **Tipo** (`All types`, `Service`, `Delegated`) y
  **Propietario** (`All owners` + usuarios activos de `/users?state=active&limit=100`, valor = id).
  Ambos se aplican en el Core y afectan a `total`, así que la paginación cuenta el conjunto filtrado
  y no la página visible.
- El selector de propietario solo aparece con tipo `delegated` o `all`; con `service` se oculta y la
  página redirige a la URL canónica sin `user` (el Core rechazaría `kind=service&user` con un 400).
  Un propietario filtrado que ya no está activo sigue apareciendo como opción con su id para no
  disfrazar el filtro de «All owners».
- `state`, `kind` y `user` se conservan al paginar y en el reintento del error; «Clear filters» limpia
  los tres. Los valores por defecto (`state=active`, `kind=all`) se omiten de la URL canónica.
- Tests: `panel-keys` reenvía `kind`/`user` (y omite `kind=all`), la página envía ambos al Core, los
  conserva en paginación/reintento, oculta y limpia el propietario con `service`, y el vacío con
  filtros de servidor es «No API keys match this filter.».

### Iteración 22 — Permisos y revocación en la ficha de detalle de la clave (hecho)

- **Lista `/keys` más corta**: se retiran las columnas de **prefijo**, **scopes**, **creada** y
  **acciones** (también sus celdas en la tarjeta móvil). Quedan nombre, tipo, propietario (con el
  `role_cap` solo en `service`), caducidad, último uso y estado. El nombre de cada fila y de cada
  tarjeta enlaza a `/keys/{id}`.
- **Ficha `/keys/[id]`** (`requirePanel("super_admin")`, `instant = false`, `notFound()` real para una
  clave inexistente): breadcrumb `API keys / <nombre>`, `h1`, badges de tipo y estado, y una sección
  de datos con propietario («Instance» o el nombre), `role_cap` solo en `service`, prefijo, creada,
  caduca y último uso.
- **Permisos** en chips con el estilo de las categorías del miembro. `api-key-scopes.ts` añade
  `API_KEY_SCOPE_LABELS`/`apiKeyScopeLabel`: los scopes del núcleo muestran un nombre legible
  traducido; los scopes de módulo (`<módulo>:read|read_write`) caen al identificador tal cual.
- **Revocar** reutiliza `ApiKeyRevokeButton` con la confirmación y el dueño de siempre. El botón
  acepta `redirectTo`; desde la ficha usa `/keys`, así que tras revocar se vuelve al listado. Una
  clave ya revocada no ofrece la acción.
- Tests: la lista no muestra scopes/prefijo ni confirmación de revocado y enlaza cada fila y tarjeta a
  `/keys/{id}`; la ficha pinta metadatos, permisos con nombre o identificador, 404, 403 y el botón
  solo si está viva; `loadKey` llama en proceso a `GET /api/v1/api-keys/{id}` con Bearer y propaga
  `not_found`/`internal` con `request_id`; `completeRevoke` vuelve a `/keys` solo cuando se le pide.
- i18n: 26 claves nuevas (etiquetas de scope, «Details», «Permissions» y el error de carga de la
  ficha) en las 9 locales vía `i18n:scan` + edición de catálogos.

### Iteración 28 — Guardia de CORS al guardar y limpieza de `instance.logo_url` (hecho)

- `security.cors_allowlist` se guarda como **array JSON de orígenes exactos** (el textarea del panel acepta
  uno por línea o separados por coma; el door compara el header `Origin` por igualdad estricta, con
  puerto y sin barra final). Quitar el origen desde el que se sirve el panel dejaba al navegador sin
  API, así que el guardado de Ajustes ahora comprueba el lote antes de enviarlo
  (`corsChangeLocksOut`/`corsUpdateLocksOut` en `lib/settings-form.ts`).
- Si el origen actual estaba permitido y el nuevo valor lo deja fuera, no se llama al API: se abre el
  `<dialog>` de confirmación y explica la consecuencia (el panel deja de funcionar desde esa dirección y
  solo se recupera editando la lista desde otro origen permitido). «Save anyway» envía el lote; «Cancel»
  no guarda nada. Un origen que nunca estuvo en la lista no dispara el aviso (no hay acceso que perder),
  y sin cambios en CORS el guardado es directo.
- Texto de ayuda nuevo en el propio campo: el origen del panel tiene que estar en la lista o pierde el
  acceso a la API. Todas las cadenas nuevas, en las 9 locales.
- `0017_drop_instance_logo_setting.sql` borra la fila huérfana `instance.logo_url` que sembró
  `0005_instance_logo.sql`: la clave salió del catálogo en este sprint y no debe sobrevivir a un restore
  como si fuera configurable. El test de catálogo sigue tolerando la clave en bases restauradas con
  migraciones pendientes y ahora ignora los ajustes de módulos instalados (categorías y filas con
  `source = 'module:<key>'`), que no forman parte del seed de `0002`.
- Tests: el guardia no abre confirmación sin cambios de CORS, la abre al quitar el origen actual y no
  envía el lote, no la abre si el nuevo valor conserva el origen ni si el origen nunca estuvo permitido;
  el diálogo se renderiza cerrado y el campo CORS muestra su aviso. `db-tests`: catálogo verde tras la
  migración (la fila `instance.logo_url` ya no existe).

## Checklist por páginas (revisión con el usuario)

Recorrido página a página de la checklist de la spec §9, separado del inventario de iteraciones: cada
fila se cierra con el usuario delante, a 375 y 1280 px.

| # | Página | Estado |
|---|---|---|
| 1 | Inicio | hecho |
| 2 | Cabecera y menú | hecho |
| 3 | Login y wizard | hecho |
| 4 | Miembros | hecho |
| 5 | Categorías | hecho |
| 6 | Invitaciones | hecho |
| 7 | Claves | hecho |
| 8 | Ajustes | pendiente |
| 9 | Módulos y documentación de API | pendiente |
| 10 | Transversal (acciones sobre uno mismo, procedencia del dato, coherencia wizard → perfil) | pendiente |

Nota: la 6 y la 9 no tienen ficha de detalle todavía; se resuelve en `task-14`.
