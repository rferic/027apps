---
id: sprint-06-task-14
titulo: Fichas de detalle de invitaciones y módulos
area: web
estado: finalizada
adrs: [0004, 0005, 0007, 0008]
plan: docs/superpowers/plans/2026-11-08-detail-pages.md
spec: docs/superpowers/specs/2026-11-08-detail-pages-design.md
---

**Alcance**: `/invitations` y `/modules` son las dos únicas listas del panel sin ficha de detalle, así
que sus acciones viven todavía en la fila y no pueden usar el patrón de fila clicable que ya tienen
miembros, categorías y claves (`904a7f7`, `components/ui/row-link.tsx` + `border-separate` para que el
`relative` del `tr` sea fiable). Se crean `/invitations/{id}` y `/modules/{key}`, se mueven las acciones
de la fila a la ficha y se completa el contrato del Core que falta para pintarla.

## Cambios

### Core

- **`GET /api/v1/modules/{key}/grants`** (nuevo): scope **`modules:manage`** (sesión `admin` /
  `super_admin` y service key con ese cap; **no** `modules:read`, que lo tienen las claves delegadas de
  los miembros en `DELEGATED_SCOPES` y filtraría quién tiene qué). Respuesta
  `{ users: [{ id, display_name }], categories: [{ id, name }] }`:
  - `users` = `public.user_modules` con `revoked_at is null` para ese `module_key`, con join a
    `public.profiles`;
  - `categories` = `public.user_category_modules` para ese `module_key`, con join a
    `public.user_categories`.
  - **Una sola consulta** con dos subconsultas `json_agg(...)` + `coalesce(…, '[]')`, sin N+1.
  - 404 si el módulo no existe; key inválida → 400 `validation_failed`; sin concesiones → arrays vacíos
    (nunca `null`).
- **Core — `manifest_digest`**: se añade de forma aditiva a `ModuleView`. Hoy la columna existe en
  `public.module_registry` (la escribe `installModule`) pero `MODULE_COLUMNS` no la selecciona, así que
  no viaja en `GET /modules` ni en `GET /modules/{key}`.
- **`GET /api/v1/invitations/{id}`** (nuevo): scope `invitations:read`; devuelve la vista de invitación
  (`InvitationView`) más `created_by: { id, display_name } | null`. **Nunca** el token ni `token_hash`:
  la tabla solo guarda `token_hash` y el token en claro se devuelve una única vez al crear.

### Panel

- **`/invitations/{id}`**: `requirePanel("admin")`, `instant = false`, `notFound()` real. Breadcrumb
  `Invitations / <email>`, `h1`, badge de estado (`pending|used|expired|revoked`), email, nombre,
  categoría (enlace a `/categories/{id}` si existe), módulos con nombre legible, caduca,
  usada/revocada si aplica, creada y quién la creó («Instance» si la creó una clave).
  Acción **Revocar** con `InvitationRevokeButton` (`redirectTo="/invitations"`, la prop se añade
  igual que en `ApiKeyRevokeButton`), solo si está `pending`.
- **`/modules/{key}`**: `requirePanel("admin")`, `instant = false`, `notFound()` real. Badges de estado
  y de `is_public`, clave, nombre, versión, `manifest_digest`, instalada, `mcp_exposed`, ajustes en solo
  lectura (`getModuleSettings`) y concesiones del endpoint nuevo. Acciones: Activar/Desactivar,
  Desinstalar (solo `super_admin`, confirmación y el 409 de concesiones activas) y enlace a ajustes
  (pregunta abierta, hoy no existe la página de edición).
- **Listas clicables**: cada fila y tarjeta de `/invitations` enlaza a `/invitations/{id}`; cada
  fila/tarjeta de `/modules` a `/modules/{key}` (patrón `border-separate` + `relative` del `tr`). Se
  retira de la fila de invitaciones la acción de revocar.

## Fuera de alcance

- Runtime de módulos y app Android.
- Página de **edición** de settings de módulo: la ficha los muestra en solo lectura.
- Mostrar el token de la invitación en la ficha.
- Cambios de modelo más allá de `manifest_digest` y `created_by`.

## TDD

- `listModuleGrants`: concesiones activas y revocadas, sin concesiones, orden, 404, key inválida, 403
  sin `modules:manage`, y **una sola consulta** (espía sobre `db.query`).
- `packages/db-tests/src/modules/grants.test.ts`: mismo contrato contra Postgres real (grants activos,
  revocados excluidos, categorías y arrays vacíos).
- Detalle de invitación: 200 con `created_by`, `null` si la creó una clave, 404, 400, 403 y **ausencia
  de token** en la respuesta.
- `lib/panel-modules.ts` y `lib/panel-invitations.ts`: parseo defensivo y `request_id`.
- Páginas: estructura, 404, 403, revocar solo en `pending`, desinstalar solo `super_admin`, chips de
  concesiones.
- Listas: enlaces y ausencia de la acción en fila.
- OpenAPI: las dos operaciones nuevas y `manifest_digest` en el schema del módulo.

## DoD

- DoD de Código completo (TDD, `pnpm lint && pnpm tsc && pnpm test`,
  `pnpm --filter admin build`, `pnpm i18n:check`, CI en verde).
- ADR 0004 (puertas delgadas, zod en el borde, representación compartida), 0005 (dato inicial del
  servidor + fetching en cliente), 0007 (envelope y `request_id`) y 0008 (fechas con la zona de la
  instancia) respetados.
- Contrato documentado en `docs/superpowers/specs/2026-10-26-core-api.md` §3.4/§3.5 y OpenAPI
  regenerado (`docs/api/openapi.json` + `pnpm check:openapi`).
- QA de segundo agente.
- **Auditoría OWASP obligatoria**, centrada en:
  - **A01**: las concesiones no son visibles sin `modules:manage`; `requirePanel` coincide con el guard
    de la API (misma condición de rol).
  - **A02/A05**: el token nunca aparece en la ficha ni en logs.
  - **A03**: zod en el borde (key y UUID) antes de tocar la BD.
  - **A07**: desinstalar con concesiones activas exige confirmación.
- Los tres interrogantes de la §10 de `docs/superpowers/specs/2026-11-06-web-admin-ux-review.md`
  respondidos por escrito con `archivo:línea` para cada ficha.

## Criterios de aceptación

- Filas y tarjetas de `/invitations` y `/modules` navegan a su ficha.
- 404 y 403 correctos en ambas fichas.
- Acciones destructivas confirmadas y solo cuando aplican (revocar en `pending`; desinstalar con
  `super_admin`).
- Breadcrumb y badges presentes y legibles sin depender del color.
- Ningún dato que el contrato no devuelva.
- El token no se muestra salvo decisión explícita del usuario.

## Dependencias y decisiones tomadas

Se apoya en task-11 iteración 26 (filas clicables y patrón compartido) y en la ficha de clave de
task-13 (estructura de detalle, `redirectTo` en el botón de revocar).

**Decisiones aprobadas por el usuario el 2026-11-08:**

1. **Enlace de canje: no se muestra.** El token solo se guarda como hash y mostrarlo exigiría
   guardarlo en claro. No se toca el modelo de tokens y `GET /invitations/{id}` **nunca** devuelve
   `token` ni `token_hash`.
2. **Ajustes del módulo en solo lectura en la ficha.** No se crea página de edición ni se enlaza a
   una ruta inexistente.
3. **Etiqueta «Instance»** para invitaciones creadas por una clave: el contrato devuelve
   `created_by: null` y el panel decide la etiqueta (reutiliza el criterio de la ficha de clave,
   `kind === "service" → "Instance"`).
4. **Scope `modules:manage`** para concesiones: cierra la fuga hacia miembros, aunque deja fuera a
   una futura clave de solo lectura de administración. Se acepta para esta tarea.

## Reservas aceptadas de la auditoría

1. **`created_by: null` se etiqueta «Instance» también cuando el creador era un miembro ya purgado.**
   La vista de invitación solo distingue «clave» (`created_by: null`) de «cuenta», y el `join` a
   `public.profiles` devuelve `null` también si la cuenta se purgó. Es un caso de borde: ningún flujo
   actual crea invitaciones desde una cuenta purgada (el purgado exige perfil desactivado y revoca sus
   sesiones antes). Se acepta sin tocar el contrato; si aparece un flujo que lo permita, la vista
   necesitará un discriminante explícito (`created_by_kind`) en lugar de inferirlo de `null`.
2. **La regex de `moduleKey` no es la misma en el borde y en el servicio.** `modules/api.ts:39` usa
   `^[a-z0-9]+(-[a-z0-9]+)*$` (solo minúsculas, dígitos y guiones, coherente con el manifest) y
   `modules/service.ts:80` usa `^[a-z0-9][a-z0-9_-]{0,63}$` (admite `_` y hasta 64 caracteres). La
   divergencia es inofensiva —el borde es más estricto y la API siempre valida antes—, pero un
   módulo con `_` en la clave sería rechazado en HTTP y aceptado por el servicio. Se unifican cuando
   se toque ese módulo; hoy no hay ninguna clave así.

## Cierre (2026-11-08)

- **Implementado**: `/invitations/{id}` y `/modules/{key}` con filas y tarjetas clicables en ambas
  listas y la acción de revocar movida de la fila a la ficha; `GET /api/v1/invitations/{id}`
  (`created_by` resuelto, sin token) y `GET /api/v1/modules/{key}/grants` (`modules:manage`, una sola
  consulta); `manifest_digest` aditivo en `ModuleView`.
- **Decisiones del usuario aplicadas**: el token no se muestra en la ficha (solo al crear); ajustes del
  módulo en solo lectura, sin enlace a una página de edición inexistente; invitaciones creadas por clave
  se etiquetan «Instance»; scope de grants = `modules:manage`.
- **Evidencia**: `pnpm --filter core test` ✓ (387), `pnpm --filter admin test` ✓ (911), `pnpm --filter
  @027apps/i18n test` ✓ (26), `pnpm lint` ✓, `pnpm tsc` ✓, `pnpm i18n:check` ✓ (546 cadenas, 9 locales),
  `pnpm check:openapi` ✓ (58/58), `pnpm --filter admin build` ✓ (ejecutado con el dev server parado y su
  salida leída; las rutas `/invitations/[id]` y `/modules/[key]` se prerenderizan parcialmente).
- **db-tests**: `src/modules/grants.test.ts` y `src/api/invitations.test.ts` en verde (9 tests).
- **Auditoría OWASP/QA**: veredicto **APTO CON RESERVAS**, sin hallazgos altos ni críticos. Resueltos: el
  rol inventado en la ficha de invitación (eliminado) y el 409 de desinstalación con
  `details.code = "grants_active"`. Reservas aceptadas: la etiqueta «Instance» cuando el creador era un
  miembro purgado (ver reserva 1) y la regex de `moduleKey` no idéntica entre borde y servicio (ver
  reserva 2).
- **Pendiente de prueba manual**: la doble confirmación de desinstalación con concesiones activas contra
  la base real. No bloquea el cierre de código; queda como comprobación del usuario.
