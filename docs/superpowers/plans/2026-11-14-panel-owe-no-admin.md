# Panel: espacio de módulo y administración de OweNo — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada módulo activo tiene su espacio propio en el panel (`/panel/<key>`) con logo en el menú, la ficha queda en `/panel/modules/<key>`, y OweNo se administra desde ahí (grupos, movimientos y liquidaciones) con dos widgets de dashboard.

**Architecture:** El host de páginas de módulo pasa a servir `/panel/<key>/<route>`; el manifest no cambia. OweNo gana un dominio de administración explícito (`packages/owe-no/src/admin.ts`) con auditoría, y el panel lo expone con Server Actions a través de envoltorios finos que inyectan acciones en componentes presentacionales del paquete.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, PostgreSQL/Supabase, zod, Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-11-14-panel-owe-no-admin-design.md`

## Global Constraints

- Código, ramas y commits en inglés; comentarios y docs internas en español cuando el fichero ya lo está.
- Colores solo por tokens; nada de hex libres.
- i18n: toda cadena visible sale de `locales/*.json` (módulo) o del catálogo del panel; nada de inglés fijo en JSX.
- Dinero: enteros de céntimos; una moneda por grupo; nunca sumar monedas distintas.
- Toda escritura de OweNo deja auditoría (`created_by`, `updated_by`, `deleted_by`, `added_by`, `archived_by`).
- Borrado lógico; nunca físico.
- Migraciones con `down` y `digest`/`down_digest` en el manifest.
- Antes de anunciar: `scripts/verify-local.sh`, suites, build y APK si toca.

## Review Focus

- Un módulo inactivo o sin permisos no debe aparecer en el menú ni resolverse por URL directa.
- Un `?group=` de otro grupo/instancia no debe filtrar datos ni permitir escrituras.
- Editar importe o participantes debe mover balances de forma exacta (resto incluido).
- Quitar un miembro con saldo debe fallar con un motivo claro, no dejar deuda huérfana.
- Un grupo archivado no admite escrituras ni por API ni por panel.

---

# Fase A — Plataforma: el módulo como espacio

### Task 1: Rutas `/panel/<key>` y `/panel/<key>/<route>`

**Files:**
- Create: `apps/admin/src/app/(panel)/panel/[module]/page.tsx`
- Create: `apps/admin/src/app/(panel)/panel/[module]/[route]/page.tsx`
- Modify: `apps/admin/src/components/module-page-host.tsx`
- Modify: `apps/admin/src/components/module-page-host.test.tsx`
- Delete after redirect: `apps/admin/src/app/(panel)/panel/modules/[key]/page.tsx`, `.../[key]/[route]/page.tsx`

**Interfaces:**
- `ModulePageHost({ moduleKey, route })` renders links with base `/panel/${moduleKey}`.
- Settings link: `/panel/modules/${moduleKey}`.

- [ ] Test: una página declarada renderiza con enlaces `/panel/<key>/...` y «Ajustes» a `/panel/modules/<key>`.
- [ ] Implementar base configurable en el host y las dos rutas dinámicas.
- [ ] Redirigir 308 desde `/panel/modules/[key]` y `/panel/modules/[key]/[route]` a los nuevos caminos.
- [ ] `pnpm --filter admin exec vitest run src/components/module-page-host.test.tsx` en verde.

### Task 2: Grupo «Módulos» en la barra lateral

**Files:**
- Create: `apps/admin/src/lib/panel-module-nav.ts` (+ test)
- Modify: `apps/admin/src/components/panel-nav.tsx` (+ test)
- Modify: `apps/admin/src/app/(panel)/layout.tsx`

**Interfaces:**
- `loadPanelModuleNav(role): Promise<Array<{ key; name; color }>>` — solo `state='active'`, con `admin_pages` que el rol puede abrir.
- `PanelNav` recibe `modules` y pinta un grupo «Módulos» entre Inicio y Usuarios.

- [ ] Test: módulo activo con página de admin aparece; inactivo no; rol insuficiente no; sin páginas no.
- [ ] Implementar el cargador (manifest + registry) y el grupo con `ModuleIcon` y nombre.
- [ ] Verificar en `/panel/modules` y `/panel/owe-no`.

### Task 3: Ficha del módulo en `/panel/modules/<key>`

**Files:**
- Move: `apps/admin/src/app/(panel)/panel/modules/[key]/settings/page.tsx` → `.../[key]/page.tsx` (y sus tests)
- Modify: `apps/admin/src/app/(panel)/panel/modules/page.tsx` (enlaces «Abrir»/«Ajustes»)
- Create: redirects `/panel/modules/[key]/settings`

- [ ] «Abrir» → `/panel/<key>` solo si está activo y tiene páginas; «Ajustes» → `/panel/modules/<key>`.
- [ ] Redirect 308 de `/panel/modules/<key>/settings` a la ficha.
- [ ] Tests de la página y del catálogo en verde.

### Task 4: Slugs reservados

**Files:**
- Modify: `packages/core/src/modules/manifest.ts` (+ test)
- Modify: `docs/ai/module-system.md`

- [ ] Test: `key: "settings"`, `"modules"`, `"members"`, `"keys"`, `"docs"`, `"categories"`, `"invitations"`, `"api"`, `"mcp"`, `"admin"`, `"core"` se rechazan al validar.
- [ ] Ampliar `RESERVED_MODULE_KEYS` con los slugs del panel y documentarlo.

### Task 5: Widgets con marca, enlace y traducción

**Files:**
- Modify: `apps/admin/src/app/(panel)/panel/page.tsx` (+ test)
- Modify: `packages/core/src/modules/widgets.ts` (solo si hace falta el `params`)
- Modify: `docs/ai/module-system.md`

- [ ] Test: el panel traduce `title`/`label`/`detail` con `loadModuleMessages`, interpola `params` y enlaza a `/panel/<key>`.
- [ ] Render: logo del módulo + nombre + enlace en cada tarjeta; grupo bajo «Módulos».

---

# Fase B — OweNo administrado

### Task 6: Migración 1.3.0

**Files:**
- Create: `packages/owe-no/sql/003-admin.sql` y `003-admin.down.sql`
- Modify: `packages/owe-no/manifest.json` (versión 1.3.0 + digests)
- Test: `packages/db-tests/src/modules/owe-no-admin.test.ts`

**Interfaces:**
- Columnas: `owe_no_groups.archived_by`, `owe_no_members.added_by`.
- Vista: `owe_no_balances(group_id uuid, member_id uuid, amount_minor bigint)`.

- [ ] Test: instalar 1.3.0 sobre 1.2.0 aplica la migración y la vista coincide con `balances()`.
- [ ] Escribir SQL up/down y actualizar digests.

### Task 7: Dominio de administración (lectura)

**Files:**
- Create: `packages/owe-no/src/admin.ts`
- Test: `packages/db-tests/src/modules/owe-no-admin.test.ts`

**Interfaces:**
- `adminGroupDetail(deps, groupId): Promise<{ group; members; balances; movements }>`
- `adminUserOptions(deps): Promise<Array<{ id; display_name }>>`
- Guard: `requireAdmin(caller)` (`admin`/`super_admin`), si no `forbidden`.

- [ ] Test: detalle con miembros activos/quitados y balances; opciones de usuario; un `user` recibe `forbidden`.

### Task 8: Dominio de administración (escritura)

**Files:**
- Modify: `packages/owe-no/src/admin.ts`, `packages/owe-no/src/service.ts` (archivado en miembro)
- Test: `packages/db-tests/src/modules/owe-no-admin.test.ts`

**Interfaces:**
- `adminCreateGroup`, `adminSetArchived`, `adminAddMember`, `adminLinkMember`, `adminRemoveMember`, `adminCreateMovement`, `adminUpdateMovement`, `adminDeleteMovement`, `adminSettlementPlan`.
- Reglas: grupo archivado → `conflict`; quitar con saldo ≠ 0 → `conflict` (`member_has_balance`); editar recalcula repartos y `updated_by`; eventos `owe_no.movement_*`.

- [ ] Test por función (roles, auditoría, reparto, liquidación, archivado, saldo).
- [ ] Implementar y hacer pasar la suite.

### Task 9: Acciones y lista de grupos

**Files:**
- Create: `apps/admin/src/lib/owe-no-actions.ts` (`"use server"`)
- Create: `apps/admin/src/components/owe-no/groups-page.tsx` (envoltorio)
- Modify: `apps/admin/src/lib/module-pages.ts`, `packages/owe-no/admin/groups/page.tsx`
- Test: `apps/admin/src/lib/owe-no-actions.test.ts`, página.

- [ ] Test: gate repetido, zod, error tipado, `revalidatePath`, creación de grupo.
- [ ] Nota: los tests existentes del paquete se actualizan si cambia la firma.

### Task 10: Ficha de grupo

**Files:**
- Create: `packages/owe-no/admin/group/page.tsx` (presentacional, recibe datos y callbacks)
- Create: `apps/admin/src/components/owe-no/group-page.tsx` (envoltorio con acciones y 404)
- Modify: `apps/admin/src/lib/module-pages.ts`, manifest `admin_pages` (`route: "group"` o reutilizar `groups` con `?group=`).

- [ ] Test de render: balances, miembros, movimientos, botones; sin literales ingleses.
- [ ] Implementar los diálogos de movimiento y liquidación como componentes cliente con estados de error.

### Task 11: Widgets de OweNo

**Files:**
- Modify: `packages/owe-no/manifest.json` (dos `dashboard_widgets` de panel)
- Modify: `packages/owe-no/sql/003-admin.sql` (`widget_groups`, `widget_pending`)
- Test: db-tests del widget.

- [ ] Test: con cero grupos devuelve 0; con datos, conteos y monedas; `pending` usa la vista.

### Task 12: i18n, docs, upgrade y verificación

**Files:**
- Modify: `packages/owe-no/locales/*.json`, `docs/ai/module-system.md`, `docs/tasks/sprint-15-app-y-finanzas/README.md` (D26/D27)
- Run: `scripts/verify-local.sh`, suites, build.

- [ ] Traducir las cadenas nuevas en los 9 idiomas.
- [ ] Documentar rutas, slugs, envoltorio y widgets.
- [ ] Upgrade local de OweNo a 1.3.0 y verificar la ficha con datos.
