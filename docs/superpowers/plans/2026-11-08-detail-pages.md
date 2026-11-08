# Plan — Fichas de detalle de invitaciones y módulos

> **Para agentes:** REQUIRED SUB-SKILL: usar `superpowers:subagent-driven-development`
> (recomendado) o `superpowers:executing-plans`. Pasos en checkbox (`- [ ]`).

**Objetivo:** dar a `/invitations` y `/modules` la misma ficha de detalle que ya tienen miembros,
categorías y claves, mover a ella las acciones de fila y cerrar los dos huecos del contrato del Core que
la ficha necesita (`GET /invitations/{id}`, `GET /modules/{key}/grants`, `manifest_digest`).

**Arquitectura:** los datos de la ficha se leen en servidor por la misma API `/api/v1` en proceso que
usa el resto del panel (`callRoute` con Bearer de sesión, ADR 0005), con parseo defensivo en
`lib/panel-*.ts` y envelope de error de ADR 0007. Las listas pasan a fila clicable con el patrón
compartido de `components/ui/row-link.tsx` (`border-separate` + `relative` en el `tr`).

**Stack:** TypeScript, Vitest (Core y panel), Postgres/Supabase (RLS), Next.js App Router (panel).

**Spec:** `docs/superpowers/specs/2026-11-08-detail-pages-design.md`

## Restricciones globales

- Código, comentarios, commits y ramas en **inglés**; docs internas y conversación en **español**.
- Solo tokens semánticos de color en la UI. Sin `any`, sin `console.log`, sin código comentado.
- Sin cambios de modelo más allá de exponer `manifest_digest` (ya en `module_registry`) y
  `created_by` (ya en `invitations`).
- Nada de N+1: las concesiones se agregan en una sola consulta.
- La rama es `sprint/06-web`; no se commitea ni se mergea sin orden explícita del usuario.
- Cada paso termina con la suite en verde antes de pasar al siguiente.

## Estructura de ficheros

**Core**
- Modificar `packages/core/src/modules/service.ts` — `ModuleView.manifest_digest`, `MODULE_COLUMNS`,
  `listModuleGrants`.
- Modificar `packages/core/src/modules/service.test.ts` — digest y grants.
- Modificar `packages/core/src/modules/api.ts` — `moduleGrantsRoute`.
- Modificar `packages/core/src/modules/api.test.ts` — 200, 403 sin `modules:manage`, 404, 400.
- Modificar `packages/core/src/invitations/service.ts` — `getInvitation` con `created_by`.
- Modificar `packages/core/src/invitations/service.test.ts` — 200/404/sin token.
- Modificar `packages/core/src/invitations/api.ts` — `invitationRoute`.
- Modificar `packages/core/src/invitations/api.test.ts` — 200, 403, 404, 400.
- Modificar `packages/core/src/openapi/registry.ts` — dos operaciones y `manifest_digest`.
- Crear `packages/db-tests/src/modules/grants.test.ts` — contrato contra Postgres.

**Rutas de la API**
- Crear `apps/admin/src/app/api/v1/modules/[key]/grants/route.ts`.
- Crear `apps/admin/src/app/api/v1/invitations/[id]/route.ts`.

**Panel**
- Crear `apps/admin/src/lib/panel-modules.ts` + `panel-modules.test.ts`.
- Modificar `apps/admin/src/lib/panel-invitations.ts` (detalle con `created_by`) y su test.
- Crear `apps/admin/src/app/(panel)/modules/[key]/page.tsx` + `page.test.tsx` + `loading.tsx`.
- Crear `apps/admin/src/app/(panel)/invitations/[id]/page.tsx` + `page.test.tsx` + `loading.tsx`.
- Modificar `apps/admin/src/components/invitation-revoke-button.tsx` — prop `redirectTo`.
- Modificar `apps/admin/src/app/(panel)/modules/page.tsx` — fila/tarjeta clicable.
- Modificar `apps/admin/src/app/(panel)/invitations/page.tsx` — fila/tarjeta clicable, sin revocar.

**i18n y docs**
- Modificar `packages/i18n/catalog.en.json` y `packages/i18n/locales/*.json` (8) vía `pnpm i18n:scan`.
- Modificar `docs/superpowers/specs/2026-10-26-core-api.md` §3.4/§3.5 — delta del contrato.
- Regenerar `docs/api/openapi.json`.
- Actualizar `docs/tasks/sprint-06-web/task-14.md` con el informe de implementación.

---

### Paso 1: Endpoint de grants + `manifest_digest`

**Ficheros:**
- Modificar `packages/core/src/modules/service.ts`, `packages/core/src/modules/service.test.ts`
- Modificar `packages/core/src/modules/api.ts`, `packages/core/src/modules/api.test.ts`
- Crear `packages/db-tests/src/modules/grants.test.ts`

**Interfaces:**
- Produce: `listModuleGrants(deps: ModulesDeps, caller: Caller, key: string): Promise<ModuleGrants>`
  con `ModuleGrants = { users: Array<{ id: string; display_name: string }>; categories: Array<{ id: string; name: string }> }`.
- Produce: `moduleGrantsRoute(deps: ModulesRouteDeps)` y `ModuleView.manifest_digest: string`.

- [ ] **Paso 1a: tests de `listModuleGrants` que fallan** en `service.test.ts`

Casos: usuario con grant activo aparece; grant con `revoked_at` no aparece; módulo sin concesiones →
`{ users: [], categories: [] }`; orden estable (`display_name asc, id asc` / `name asc, id asc`);
módulo inexistente → `not_found`; key inválida → `validation_failed`; sesión `admin` y service key con
`roleCap: "admin"` pasan, llamador sin `modules:manage` → `insufficient_scope`; **una sola consulta**
(espía sobre `db.query` que cuente llamadas con `user_modules`/`user_category_modules`).

- [ ] **Paso 1b: ejecutar y ver el fallo**

```bash
pnpm --filter @027apps/core exec vitest run src/modules/service.test.ts
```

- [ ] **Paso 1c: implementar `listModuleGrants` y `manifest_digest`**

Añadir `manifest_digest` a `ModuleView`, a `toModuleView` y a `MODULE_COLUMNS` (aditivo: ningún
consumidor actual se rompe). Implementar el agregado en **una** consulta:

```sql
select
  (select coalesce(json_agg(json_build_object('id', p.id, 'display_name', p.display_name)
                            order by p.display_name asc, p.id asc), '[]')
     from public.user_modules u
     join public.profiles p on p.id = u.user_id
    where u.module_key = $1 and u.revoked_at is null) as users,
  (select coalesce(json_agg(json_build_object('id', c.id, 'name', c.name)
                            order by c.name asc, c.id asc), '[]')
     from public.user_category_modules cm
     join public.user_categories c on c.id = cm.user_category_id
    where cm.module_key = $1) as categories
```

Reutilizar `moduleKey`/validación de key del borde y `getModuleRow` para el 404. Guardar con el mismo
criterio que el resto de `service.ts` (`isAdmin(caller)` sobre sesión/service).

- [ ] **Paso 1d: ruta y tests del borde**

`moduleGrantsRoute` con `readOptions(deps, ["modules:manage"])`; exponer `GET` en
`apps/admin/src/app/api/v1/modules/[key]/grants/route.ts`. Tests: 200 con arrays, 403 sin
`modules:manage` (clave delegada con `modules:read`), 404, 400 por key inválida.

- [ ] **Paso 1e: db-tests**

`packages/db-tests/src/modules/grants.test.ts`: concesiones activas y revocadas, categorías, módulo sin
grants → arrays vacíos.

- [ ] **Paso 1f: suite en verde**

```bash
pnpm --filter @027apps/core exec vitest run src/modules
pnpm --filter db-tests exec vitest run src/modules/grants.test.ts
```

---

### Paso 2: Ficha de módulo

**Ficheros:**
- Crear `apps/admin/src/lib/panel-modules.ts`, `apps/admin/src/lib/panel-modules.test.ts`
- Crear `apps/admin/src/app/(panel)/modules/[key]/page.tsx`, `page.test.tsx`, `loading.tsx`

**Interfaces:**
- Produce: `loadModuleDetail(key: string): Promise<ModuleDetailResult>` con
  `{ module, settings, grants }` y `{ ok: false; code?; requestId? }`.
- Consume: `moduleRoute`, `moduleSettingsRoute`, `moduleGrantsRoute` en proceso.

- [ ] **Paso 2: `loadModuleDetail` y la página**

`requirePanel("admin")` (mismo mínimo que la API: `modules:manage` lo tienen admin y super_admin;
`modules:read` no basta para la ficha y no se pide). `instant = false`, `notFound()` real para
`not_found`, `PanelForbidden` para `insufficient_scope`. Contenido: breadcrumb `Modules / <name>`,
`h1`, badges de estado (`installed|active|disabled`) y `is_public`, y una sección de datos con clave,
nombre, versión, `manifest_digest`, instalada, `mcp_exposed`, ajustes (`getModuleSettings`, en solo
lectura, secretos como «configured») y concesiones en chips (`users` y `categories`, vacío explícito).
Acciones: Activar/Desactivar (mutación existente), Desinstalar solo `super_admin` con confirmación y el
409 de concesiones activas, y «Ajustes del módulo» como enlace solo si la decisión de la spec lo
permite.

Tests: estructura y badges, 404, 403, desinstalar solo `super_admin`, chips y vacío de concesiones,
`request_id` en el error.

```bash
pnpm --filter admin exec vitest run src/lib/panel-modules.test.ts src/app/\\(panel\\)/modules
```

---

### Paso 3: Detalle de invitación

**Ficheros:**
- Modificar `packages/core/src/invitations/service.ts`, `service.test.ts`, `api.ts`, `api.test.ts`
- Crear `apps/admin/src/app/api/v1/invitations/[id]/route.ts`
- Modificar `apps/admin/src/lib/panel-invitations.ts` (+ tests)
- Crear `apps/admin/src/app/(panel)/invitations/[id]/page.tsx`, `page.test.tsx`, `loading.tsx`

**Interfaces:**
- Produce: `getInvitation(deps, caller, id): Promise<InvitationDetail>` con
  `created_by: { id, display_name } | null`.
- Produce: `loadInvitation(id)` en el panel.

- [ ] **Paso 3a: Core**

`InvitationDetail = InvitationView & { created_by: { id: string; display_name: string } | null }`.
Reutilizar `toView` (estado derivado de `used_at`/`revoked_at`/`expires_at`) y hacer el join a
`profiles` por `created_by`; `created_by_key` no nulo → `null`. **No** seleccionar `token_hash` ni
devolver token. 404 si no existe, 400 si el id no es UUID, 403 sin `invitations:read`.

- [ ] **Paso 3b: ruta y tests**

`invitationRoute` con `readOptions` (`invitations:read`); `GET` en
`apps/admin/src/app/api/v1/invitations/[id]/route.ts`. Tests: 200 con `created_by`, 200 con `null` para
invitación creada por clave, 404, 400, 403, y una aserción explícita de que el JSON serializado no
contiene `token`.

- [ ] **Paso 3c: `lib/panel-invitations.ts` y página**

`loadInvitation` sigue el patrón de `loadKey` (`callRoute` con Bearer, parseo defensivo, `request_id`
propagado). Página: `requirePanel("admin")`, `instant = false`, `notFound()` real. Breadcrumb
`Invitations / <email>`, `h1`, badge de estado, email, nombre, categoría (enlace a `/categories/{id}` si
existe), módulos con nombre legible, caduca, usada/revocada si aplica, creada y creador («Instance» si
la creó una clave). **Revocar** solo si `pending`, con `InvitationRevokeButton` y
`redirectTo="/invitations"`.

```bash
pnpm --filter @027apps/core exec vitest run src/invitations
pnpm --filter admin exec vitest run src/lib/panel-invitations.test.ts src/app/\\(panel\\)/invitations
```

---

### Paso 4: Filas clicables en ambas listas

**Ficheros:**
- Modificar `apps/admin/src/app/(panel)/modules/page.tsx`, `page.test.tsx`
- Modificar `apps/admin/src/app/(panel)/invitations/page.tsx`, `page.test.tsx`

- [ ] **Paso 4: aplicar el patrón de `904a7f7`**

`<table className="w-full border-separate border-spacing-0 …">` + `<tr className={clickableRowClass}>`
(`relative`) + `RowLink` en la celda del nombre; tarjeta móvil con el nombre enlazado. En `/modules` el
enlace es `/modules/{key}` (la clave es la identidad, no un uuid); en `/invitations`,
`/invitations/{id}`. Sin `href="#"` ni `onClick` en el `tr`.

Tests: cada fila y cada tarjeta exponen el enlace correcto; el `tr` lleva la clase compartida.

```bash
pnpm --filter admin exec vitest run src/app/\\(panel\\)/modules/page.test.tsx src/app/\\(panel\\)/invitations/page.test.tsx
```

---

### Paso 5: Retirar la acción de revocar de la fila de invitaciones

**Ficheros:**
- Modificar `apps/admin/src/app/(panel)/invitations/page.tsx`, `page.test.tsx`
- Modificar `apps/admin/src/components/invitation-revoke-button.tsx` (+ `invitation-revoke-button.test.ts`)

- [ ] **Paso 5: mover la acción y no duplicarla**

Quitar la celda de acciones (y el bloque de la tarjeta) con `InvitationRevokeButton` del listado.
Añadir `redirectTo?: string` al botón con el mismo contrato que `ApiKeyRevokeButton`: sin prop hace
`router.refresh()`; con prop navega a esa ruta tras revocar. Tests: la lista ya no renderiza el botón;
el botón navega solo cuando recibe `redirectTo`.

```bash
pnpm --filter admin exec vitest run src/app/\\(panel\\)/invitations/page.test.tsx src/components/invitation-revoke-button.test.ts
```

---

### Paso 6: Tests de página y build

- [ ] **Paso 6a: cobertura de las dos fichas**

404 (`notFound()`), 403 (`PanelForbidden`), breadcrumb y badges, revocar solo en `pending`,
desinstalar solo `super_admin`, chips de concesiones, ajustes en solo lectura, y que la ficha de
invitación no pinta ningún token.

```bash
pnpm --filter admin exec vitest run src/app/\\(panel\\)/modules src/app/\\(panel\\)/invitations
```

- [ ] **Paso 6b: gates del panel**

```bash
pnpm lint && pnpm tsc && pnpm test
pnpm i18n:check
pnpm --filter admin build
```

---

### Paso 7: OpenAPI, delta del contrato y auditoría

- [ ] **Paso 7a: registro OpenAPI**

Dos operaciones nuevas: `GET /modules/{key}/grants` (scopes `["modules:manage"]`, schema con `users` y
`categories`) y `GET /invitations/{id}` (scopes `["invitations:read"]`, `InvitationDetail`).
`manifest_digest` en el schema del módulo.

- [ ] **Paso 7b: documento y paridad**

```bash
pnpm check:openapi
```

- [ ] **Paso 7c: delta del contrato**

En `docs/superpowers/specs/2026-10-26-core-api.md` §3.4 (módulos) y §3.5 (invitaciones), con la nota
del scope `modules:manage` y la ausencia de token por diseño.

- [ ] **Paso 7d: auditoría OWASP**

A01 (grants solo con `modules:manage`, `requirePanel` coincide con el guard), A02/A05 (token fuera de
la ficha y de los logs), A03 (zod en el borde), A07 (desinstalar con concesiones exige confirmación).
Responder por escrito, con `archivo:línea`, los tres interrogantes de la §10 de
`docs/superpowers/specs/2026-11-06-web-admin-ux-review.md` para cada ficha.
