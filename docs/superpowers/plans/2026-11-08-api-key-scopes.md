# Plan — Scopes de claves API y claves delegadas por propietario

> **Para agentes:** REQUIRED SUB-SKILL: usar `superpowers:subagent-driven-development`
> (recomendado) o `superpowers:executing-plans`. Pasos en checkbox (`- [ ]`).

**Objetivo:** que una clave delegada use solo el allowlist de su tipo (nunca scopes de
administración), que una service key no toque datos personales ni dispositivos, que un super_admin
pueda crear delegadas para otros usuarios y que convivan 5 claves activas por usuario.

**Arquitectura:** el Core expone una allowlist por tipo de credencial (`delegated` fija, `service`
por cap) y el guard la aplica en cada petición; crear una clave también valida contra ella. La
propiedad (`user_id`) la decide el servicio, no el actor. El límite se cierra con
`withTransaction` + `pg_advisory_xact_lock` por propietario. El panel consume las mismas constantes
del Core para no duplicar la política.

**Stack:** TypeScript, Vitest (Core y panel), Postgres/Supabase (RLS), Next.js App Router (panel).

**Spec:** `docs/superpowers/specs/2026-11-08-api-key-scopes-design.md`

## Política final aplicada (manda sobre los pasos)

- **Delegada = `user` efectivo siempre.** `resolveCaller` devuelve `roleCap: 'user'`; el `role_cap`
  guardado se ignora. Allowlist cerrada con `users:read`/`user_categories:read` y scopes de módulo
  con grant del dueño.
- **`api_keys:*` sigue en las tres sesiones** (`user`, `admin`, `super_admin`). El panel `/keys` pasa
  a `requirePanel("super_admin")` y el ítem desaparece para admin; por API, admin gestiona solo sus
  delegadas y nunca service.
- **Crear delegada recorta, no rechaza:** intersección de allowlist + scopes efectivos del creador +
  grant de módulo; si queda vacío → `validation_failed`. Crear service con un scope fuera de su set
  → `validation_failed`.
- **Límite de 5** delegadas activas por propietario, en transacción con `pg_advisory_xact_lock`;
  409 `conflict` con `details.code = "key_limit"`.
- **Propiedad:** `user_id` solo para sesión super_admin; clave ajena para un no-super_admin → 404.

## Restricciones globales

- Código, comentarios, commits y ramas en **inglés**; docs internas y conversación en **español**.
- Solo tokens semánticos de color en la UI. Sin `any`, sin `console.log`, sin código comentado.
- Nada de migraciones destructivas: no se reescriben `scopes` ni `role_cap` de filas existentes.
- La rama es `sprint/06-web`; no se commitea ni se mergea sin orden explícita del usuario.
- Antes de declarar terminado: `pnpm lint`, `pnpm tsc`, `pnpm test`, `pnpm i18n:check` y
  `pnpm --filter admin build`; `pnpm --filter db-tests test` si hay entorno local.
- Leer `apps/admin/AGENTS.md` y la guía de App Router de `apps/admin/node_modules/next/dist/docs/`
  antes de tocar páginas.

## Revisión focalizada

- **No escalada:** crear una clave nunca concede más de lo que el caller ya tiene; una delegada de
  un super_admin **no** lista ni revoca las de otros (hoy `isSuperAdmin` mira el `roleCap` y abre
  todas — se corrige).
- **Allowlist cerrada:** un scope desconocido no pasa el guard ni el alta; los de módulo se
  reconocen por patrón y se contrastan con el grant del dueño.
- **Recorte en runtime:** una fila antigua con `settings:write` responde 403 en esa acción, sin
  reescribir la fila.
- **Límite real:** dos altas concurrentes no superan 5; revocada o caducada no cuentan.
- **Sin secretos:** el secreto se devuelve una vez; ni en listados, ni en logs, ni en tests.

## Estructura de ficheros

**Core**
- Modificar `packages/core/src/auth/guard.ts` — allowlists `DELEGATED_SCOPES`,
  `SERVICE_SCOPES[cap]`; `SESSION_SCOPES` sin `api_keys:*` en admin.
- Modificar `packages/core/src/auth/guard.test.ts`.
- Modificar `packages/core/src/api-keys/service.ts` — `user_id`, validación de scopes por tipo,
  límite de 5 con lock, `isSuperAdmin` estricto.
- Crear `packages/core/src/api-keys/service.test.ts`.
- Modificar `packages/core/src/api-keys/api.ts` — `user_id` en el schema.
- Modificar `packages/core/src/api-keys/api.test.ts`.

**Panel**
- Modificar `apps/admin/src/lib/api-keys-route-deps.ts` — `withTransaction: withTransactionClient`.
- Modificar `apps/admin/src/lib/api-key-scopes.ts` y crear `api-key-scopes.test.ts` — derivar del
  Core.
- Modificar `apps/admin/src/lib/api-key-mutations.ts` y `api-keys-route-deps.ts` si el alta pasa
  `user_id`.
- Modificar `apps/admin/src/lib/panel-keys.ts` — opciones de propietario y conteo de activas.
- Modificar `apps/admin/src/app/(panel)/keys/page.tsx`, `keys/new/page.tsx` y sus tests —
  `requirePanel("super_admin")`.
- Modificar `apps/admin/src/components/panel-nav.tsx` + `panel-nav.test.tsx` — ítem según rol.
- Modificar `apps/admin/src/components/api-key-create-form.tsx` + su test — selector de propietario,
  scopes podados, aviso del límite.

**Datos**
- Crear `supabase/migrations/0015_api_keys_owner_policy.sql`.
- Modificar `packages/db-tests/src/rls/api-keys-devices.test.ts`.

**i18n y docs**
- `packages/i18n/catalog.en.json` y `packages/i18n/locales/*.json` vía `pnpm i18n:scan`.
- `docs/superpowers/specs/2026-10-26-core-api.md` §3.6 y `2026-10-25-token-model.md` §5 (delta).
- Informe de implementación y auditoría en `docs/tasks/sprint-06-web/task-13.md`.

---

### Tarea 1: Guard con allowlist por tipo de credencial

**Ficheros:**
- Modificar `packages/core/src/auth/guard.ts`, `packages/core/src/auth/guard.test.ts`

**Interfaces:**
- Produce: `DELEGATED_SCOPES: readonly string[]`, `SERVICE_ADMIN_SCOPES`, `SERVICE_SUPER_ADMIN_SCOPES`,
  `MACHINE_SCOPES: { delegated: ...; service: Record<cap, ...> }`
- Produce: `isModuleScope(scope: string): boolean` (patrón `ns:read|read_write` con `ns` fuera de
  los namespaces del Core).
- Consume: `Caller`, `DomainError`.

- [ ] **Paso 1: Escribir los tests que fallan** en `guard.test.ts`

Casos: sesión admin con `api_keys:read` → 403; sesión `user` con `api_keys:write` → ok; sesión
super_admin con `api_keys:*` → ok; delegada (cualquier `roleCap`) con cada uno de `settings:*`,
`currencies:write`, `users:write`, `users:deactivate`, `roles:assign`, `user_categories:write`,
`invitations:*`, `modules:grant`, `modules:manage`, `maintenance:run` → 403; delegada con
`users:read`, `user_categories:read`, `profile:*`, `devices:*`, `currencies:read`, `modules:read` →
ok; delegada con `expenses:read` (patrón de módulo) → ok; delegada con `settings:read` no debe
colarse por el patrón; service cap admin con `profile:read` y `devices:read` → 403; service con
`api_keys:read` en ambos caps → ok; service cap admin con `maintenance:run` y `users:deactivate` →
403; service cap super con ambos → ok; `service` con `expenses:read` → 403.

- [ ] **Paso 2: Ejecutar y ver el fallo**

`pnpm --filter @027apps/core exec vitest run src/auth/guard.test.ts`

- [ ] **Paso 3: Implementar las allowlists**

`USER_SCOPES` sin `api_keys:*`; `ADMIN_SCOPES` igual que hoy pero sin `api_keys:*`; la sesión `user`
recibe `USER_SCOPES + api_keys:*`, super_admin `SUPER_ADMIN_SCOPES + api_keys:*`. `DELEGATED_SCOPES`
= perfil, monedas lectura, dispositivos, módulos lectura, `api_keys:*`, `users:read`,
`user_categories:read`. `SERVICE_*` = admin/super **sin** `profile:*` ni `devices:*`, con
`api_keys:*`; super añade `maintenance:run`. `authorize` elige el set por `caller.kind` y, para
`delegated`, acepta además `isModuleScope`.

- [ ] **Paso 4: Ejecutar y ver el verde**

Mismo comando del paso 2.

---

### Tarea 2: Core de claves — propiedad, allowlist al crear y límite

**Ficheros:**
- Modificar `packages/core/src/api-keys/service.ts`
- Crear `packages/core/src/api-keys/service.test.ts`
- Modificar `packages/core/src/api-keys/api.ts`, `packages/core/src/api-keys/api.test.ts`

**Interfaces:**
- Produce: `CreateApiKeyInput.user_id?: string`.
- Produce: `assertScopesAllowed(db, kind, cap, scopes, ownerId): Promise<void>` (interno).
- Consume: `MACHINE_SCOPES`, `isModuleScope`, `withTransaction`, `QueryClient`.

- [ ] **Paso 1: Tests que fallan de propiedad**

`user_id` con caller sesión admin/user o clave delegada → `insufficient_scope`; con sesión
super_admin → la clave queda a nombre del `user_id`; sin `user_id` → del actor; `user_id`
inexistente o desactivado → `not_found`; una delegada de un super_admin lista/detalle/revoca solo
las del dueño (no las de otros) y no puede crear `service`.

- [ ] **Paso 2: Ejecutar y ver el fallo**

`pnpm --filter @027apps/core exec vitest run src/api-keys`

- [ ] **Paso 3: Implementar propiedad y `isSuperAdmin` estricto**

`isSuperAdmin(caller)` → solo sesión `super_admin` o `service` con cap `super_admin`; una
`delegated` nunca. `createApiKey`: resolver `ownerId = input.user_id ?? actor` solo si el caller es
sesión super_admin; leer el rol y `deactivated_at` del propietario; cap efectivo = rol del dueño.
`role_cap` sigue solo para `service` y solo con sesión super_admin.

- [ ] **Paso 4: Tests que fallan de allowlist al crear**

Delegada con un scope fuera de `DELEGATED_SCOPES` → `validation_failed`; scope de módulo sin fila
vigente en `user_modules` del dueño → `validation_failed`; scope de módulo con grant → ok; service
con `profile:read` → `validation_failed`; caller que pide scopes que él no tiene → `insufficient_scope`
(o `validation_failed` si el scope es ilegal para el tipo).

- [ ] **Paso 5: Implementar la validación de scopes**

`validateScopes` sigue validando forma; después `assertScopesAllowed` contrasta con
`MACHINE_SCOPES[kind][cap]` y, para delegadas, con `select 1 from user_modules where user_id = $1
and module_key = $2 and revoked_at is null` para cada scope de módulo. Los scopes se guardan tal
cual (sin recortar en silencio): lo que no está permitido se rechaza con 400.

- [ ] **Paso 6: Tests que fallan del límite**

5 activas → la sexta `conflict`; una revocada o caducada no cuenta; dos altas concurrentes dejan 5
(el cliente falso de test simula el lock como en `invitations/service.test.ts:192`); una service key
no cuenta; revocar libera hueco.

- [ ] **Paso 7: Implementar el límite dentro de transacción**

`const run = deps.withTransaction ?? ((fn) => fn(deps.db))`; dentro:
`select pg_advisory_xact_lock(hashtext('api_keys:' || $1))`, luego
`select count(*) from api_keys where user_id = $1 and kind = 'delegated' and revoked_at is null and
(expires_at is null or expires_at > now())`; si es 5 → `DomainError('conflict')`; si no, el insert.

- [ ] **Paso 8: Schema y ruta**

`createApiKeySchema` añade `user_id: z.uuid().optional()`; `createApiKeyRoute` lo pasa al servicio.
Test de `api.test.ts`: body con `user_id` llega; uuid inválido → `validation_failed`; caller sin
`api_keys:write` → 403.

- [ ] **Paso 9: Ejecutar y ver el verde**

`pnpm --filter @027apps/core exec vitest run src/api-keys src/auth`

---

### Tarea 3: Panel — gate de super_admin, menú y selector de propietario

**Ficheros:**
- Modificar `apps/admin/src/lib/api-keys-route-deps.ts`
- Modificar `apps/admin/src/lib/api-key-scopes.ts`, crear `api-key-scopes.test.ts`
- Modificar `apps/admin/src/lib/panel-keys.ts`, `panel-keys.test.ts`
- Modificar `apps/admin/src/app/(panel)/keys/page.tsx`, `keys/new/page.tsx` y sus `page.test.tsx`
- Modificar `apps/admin/src/components/panel-nav.tsx`, `panel-nav.test.tsx`
- Modificar `apps/admin/src/components/api-key-create-form.tsx`, su test y
  `apps/admin/src/lib/api-key-mutations.ts`

**Interfaces:**
- Produce: `allowedApiKeyScopes(kind, cap)` derivado de `MACHINE_SCOPES` del Core.
- Produce: `loadApiKeyOwners(): Promise<{ id: string; name: string }[]>` (usuarios activos vía
  `GET /api/v1/users?state=active`, en proceso).
- Consume: `requirePanel("super_admin")`, `DELEGATED_SCOPES`.

- [ ] **Paso 1: Tests que fallan de gate y menú**

`/keys` y `/keys/new` con rol admin → `PanelForbidden`; con super_admin → contenido. `PanelNav` con
`role="admin"` no renderiza `/keys`; con `super_admin` sí. Test de `api-key-scopes`: delegada ==
`DELEGATED_SCOPES`; service cap admin/super == su set; `settings`/`invitations`/`maintenance` y
`users:write` no aparecen en delegada.

- [ ] **Paso 2: Ejecutar y ver el fallo**

`pnpm --filter admin exec vitest run src/components/panel-nav.test.tsx src/lib/api-key-scopes.test.ts "src/app/(panel)/keys"`

- [ ] **Paso 3: Implementar gate y menú**

`requirePanel("super_admin")` en ambas páginas; el ítem `/keys` entra en el grupo Plataforma solo si
`role === "super_admin"`. `api-key-scopes.ts` deja de duplicar listas: importa `DELEGATED_SCOPES` y
los sets de service de `@027apps/core/auth/guard.js` y agrupa por `ScopeGroupId` para la UI (los
grupos sin scopes permitidos no se pintan).

- [ ] **Paso 4: Ejecutar y ver el verde**

Mismo comando del paso 2.

- [ ] **Paso 5: Tests que fallan del formulario**

Selector «Propietario» solo con sesión super_admin (las delegadas se atribuyen a él por defecto);
`createApiKey` envía `user_id` cuando se elige otro usuario; el selector de scopes se poda al
cambiar tipo/cap y desmarca lo que deja de estar permitido; al llegar a 5 activas del propietario
elegido se deshabilita «Crear» y se explica el límite; error `conflict` del servidor se pinta como
límite y no como fallo genérico.

- [ ] **Paso 6: Implementar formulario y loader**

`loadApiKeyOwners` reutiliza el patrón de `panel-members.ts` (llamada en proceso a la ruta, mismo
caller de sesión). El formulario recibe `owners` y `activeCounts` (o el total de activas por
propietario) desde la página server; el cliente no inventa datos. `api-keys-route-deps.ts` añade
`withTransaction: withTransactionClient` (patrón de `invitations-route-deps.ts`).

- [ ] **Paso 7: Ejecutar y ver el verde**

`pnpm --filter admin exec vitest run src/components/api-key-create-form.test.tsx src/lib/panel-keys.test.ts`

- [ ] **Paso 8: Traducir**

`pnpm i18n:scan` y traducir las claves nuevas en los 8 locales no ingleses; `pnpm i18n:check`.

---

### Tarea 4: RLS sin visibilidad de admin

**Ficheros:**
- Crear `supabase/migrations/0015_api_keys_owner_policy.sql`
- Modificar `packages/db-tests/src/rls/api-keys-devices.test.ts`

- [ ] **Paso 1: Test que falla** — un admin autenticado ya no lee delegadas ajenas; el dueño sí;
  super_admin sí; service keys siguen ocultas a admin.

- [ ] **Paso 2: Ejecutar y ver el fallo**

`pnpm --filter db-tests exec vitest run src/rls/api-keys-devices.test.ts`

- [ ] **Paso 3: Migración** — `drop policy api_keys_select` + `create policy` con
  `core_is_super_admin() or user_id = auth.uid()`; sin tocar `api_keys_write` ni datos. Comentario
  que explica que el guard ya no da `api_keys:*` a admin y la RLS no debe contradecirlo.

- [ ] **Paso 4: Ejecutar y ver el verde** — mismo comando del paso 2 (si hay entorno local; si no,
  se documenta en la tarea y lo cubre CI).

---

### Tarea 5: Gates, deltas de contrato e informe

- [ ] **Paso 1: Gates**

```
pnpm lint
pnpm tsc
pnpm test
pnpm i18n:check
pnpm --filter admin build
pnpm --filter db-tests test   # si el entorno de docs/flows/local-development.md está arriba
```

- [ ] **Paso 2: Deltas de contrato** — `core-api.md` §3.6: `user_id` opcional en `POST`, 409 del
  límite, quién lista qué; `token-model.md` §5: allowlist por tipo de credencial y recorte en
  runtime. Sin contradicciones con ADR 0004/0007.

- [ ] **Paso 3: Informe en task-13** — alcance, tests añadidos, decisión sobre `role_cap` (ignorado,
  sin migración) y consecuencia aceptada (integraciones antiguas pueden recibir 403).

- [ ] **Paso 4: Auditoría OWASP** — agente distinto del autor, checklist de
  `docs/conventions/security-checklist.md`, foco A01/A02/A03/A04/A05/A07/A08/A09. Informe en
  task-13; críticos o altos sin resolver bloquean `finalizada`.

---

### Futuro (fuera de este PR)

- **Cliente Android**: consumir `user_id` (solo super_admin) y traducir el 409 del límite a un
  mensaje de "5 active keys"; nada más del contrato cambia. Se planifica cuando la app gestione
  claves; esta tarea solo fija la API.
