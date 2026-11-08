---
id: sprint-06-task-13
titulo: Scopes de claves API y claves delegadas por propietario
area: web
estado: finalizada
adrs: [0004, 0007]
plan: docs/superpowers/plans/2026-11-08-api-key-scopes.md
spec: docs/superpowers/specs/2026-11-08-api-key-scopes-design.md
---

**Alcance**: alinear el guard y la gestión de claves con la política de scopes acordada el
2026-11-08 (spec: `docs/superpowers/specs/2026-11-08-api-key-scopes-design.md`).

Hoy `packages/core/src/auth/guard.ts` da a `USER_SCOPES` (y por herencia a admin y super_admin)
`api_keys:read/write/revoke`, y una clave delegada hereda el suelo del rol de su dueño
(`ROLE_CAP_FLOOR[role]`, con `maintenance:run` incluido si el dueño es super_admin), así que puede
llevar `settings:*`, `invitations:*` o `users:write`. Una service key hereda además `profile:*` y
`devices:*`. El panel permite crear `service` solo a super_admin y delegadas a cualquier panel role,
siempre atribuidas al actor: no existe selector de propietario.

Cambios:

- **Guard**: suelos separados por tipo de credencial. `api_keys:*` se mantiene en las tres sesiones
  (`user`, `admin`, `super_admin`): la app móvil gestiona sus claves con la sesión. `delegated` usa
  un allowlist fijo (nunca `settings:*`, `currencies:write`, `users:write`, `users:deactivate`,
  `roles:assign`, `user_categories:write`, `invitations:*`, `modules:grant/manage`,
  `maintenance:run`) y tiene `users:read` y `user_categories:read` de toda la instancia (las
  categorías clasifican, no aíslan). `service` usa el set administrativo sin `profile:*` ni
  `devices:*`; `maintenance:run` sigue solo en cap super_admin.
- **`role_cap`**: obligatorio solo para `service`. Una delegada **actúa siempre como `user`**: el
  rol vivo del dueño y cualquier `role_cap` guardado se ignoran en runtime. No hay migración
  destructiva: el check de `0009` ya impide esa fila.
- **Recorte al validar**: los scopes efectivos de una clave se calculan en cada petición como
  `scopes ∩ allowlist(kind, cap)`; una clave antigua con scopes retirados deja de poder usarlos sin
  reescribir filas (no hay backfill de `scopes`).
- **Propiedad**: `POST /api/v1/api-keys` acepta `user_id` opcional solo para una sesión super_admin;
  una clave (incluida una delegada de un super_admin) nunca crea claves para otro usuario y no puede
  pedir scopes fuera de los suyos (no escalada). Los scopes de una delegada fuera del allowlist se
  **recortan** al crear; si no queda ninguno → `validation_failed`. Propietario inexistente o
  desactivado → 404. Una clave ajena para un no-super_admin → 404.
- **Límite**: 5 claves delegadas activas por usuario, validado en el Core dentro de transacción con
  `pg_advisory_xact_lock` por propietario; la sexta → 409 `conflict` con
  `details.code = "key_limit"`.
- **Panel**: `/keys` y `/keys/new` pasan a `requirePanel("super_admin")`, el ítem Claves solo
  aparece a super_admin y el formulario añade selector de propietario (delegadas, usuarios activos
  con `limit=100`) y ofrece los scopes de cada tipo desde el allowlist del Core. Un admin conserva
  `api_keys:*` por API para sus propias delegadas, pero en el panel recibe el 403 genérico.
- **RLS**: la política de lectura de `api_keys` deja de dar al rol admin visibilidad de las
  delegadas (`supabase/migrations/0015_api_keys_owner_policy.sql`).

**Fuera de alcance**: el runtime de módulos (los scopes `<módulo>:read|read_write` se validan al
crear contra `module_registry`/`user_modules` y el acceso efectivo lo sigue comprobando
`hasAccess`); la app Android (solo consume el contrato: `user_id` opcional y 409 del límite, en una
tarea posterior); el listado de claves por una service key (sigue siendo acción de panel con
dueño); cambios en el modelo de datos más allá del índice/política citados.

## TDD

- `packages/core/src/auth/guard.test.ts`: sesión admin conserva `api_keys:*`; sesión `user` con
  `api_keys:*`; super_admin con ellos; delegada con `users:read`/`user_categories:read`; delegada con
  `settings:write`, `currencies:write`, `users:write`, `users:deactivate`, `roles:assign`,
  `user_categories:write`, `invitations:write`, `modules:grant`, `modules:manage` y
  `maintenance:run` → 403, incluso con `roleCap` admin/super_admin guardado; `service` con
  `profile:read` o `devices:read` → 403; `service` con `api_keys:read` en ambos caps; `service` cap
  admin sin `maintenance:run` ni `users:deactivate`; scopes almacenados fuera del allowlist se
  recortan (acción pedida → 403; el resto sigue).
- `packages/core/src/api-keys/service.test.ts` (nuevo): `user_id` rechazado para un caller que no es
  sesión super_admin; propietario inexistente o desactivado → `not_found`; scopes de administración
  recortados al crear una delegada; sin scopes permitidos → `validation_failed`; scope de módulo sin
  grant del dueño recortado; sexta clave activa → `conflict` con `details.code = "key_limit"`; clave
  revocada o caducada no cuenta; dos creaciones concurrentes no superan 5 (lock); una delegada no
  puede pedir un scope que ella no tiene; una delegada nunca crea `service` ni para otro usuario;
  **la delegada de un super_admin lista, detalla y revoca solo las de su dueño**.
- `packages/core/src/api-keys/api.test.ts`: el body con `user_id` llega al servicio; 403 de un caller
  sin `api_keys:write`; `user_id` con forma no-uuid → `validation_failed`.
- `packages/db-tests/src/rls/api-keys-devices.test.ts`: un admin ya no lee delegadas de otro
  usuario; el dueño sí; super_admin sí; service keys siguen ocultas a admin.
- `apps/admin/src/lib/panel-guard` + `apps/admin/src/app/(panel)/keys/*.test.tsx`: `/keys` y
  `/keys/new` con rol admin → 403 genérico.
- `apps/admin/src/components/panel-nav.test.tsx`: el ítem `/keys` no se renderiza para admin y sí
  para super_admin.
- `apps/admin/src/lib/api-key-scopes.test.ts`: delegada ofrece exactamente el allowlist delegado;
  service cap admin/super ofrece solo lo permitido; `settings`/`invitations`/`maintenance` no
  aparecen en una delegada.
- Formulario (`api-key-create-form.test.tsx`): selector de propietario solo para super_admin;
  envío con `user_id`; mensaje de límite al llegar a 5; selector de scopes podado al cambiar
  tipo/cap.

## DoD

- DoD de **Código** completo: TDD, `pnpm lint && pnpm tsc && pnpm test` en verde,
  `pnpm --filter admin build`, `pnpm i18n:check` y `pnpm --filter db-tests test` si el entorno de
  `docs/flows/local-development.md` está disponible. CI del PR en verde.
- ADRs 0004 (bordes/guard) y 0007 (envelope) respetados; el contrato `api_keys` se documenta como
  delta en `docs/superpowers/specs/2026-10-26-core-api.md` §3.6 y en
  `docs/superpowers/specs/2026-10-25-token-model.md` §5.
- QA de un segundo agente contra la spec y los criterios de aceptación (§9).
- **Auditoría de seguridad OWASP** obligatoria por un agente distinto del autor, con
  `docs/conventions/security-checklist.md`, centrada en **A01** (escalada de privilegios al mintear
  claves, propiedad y visibilidad por rol), **A02/A05** (la clave privada no aparece en listados ni
  logs; el selector de propietario no filtra datos de más), **A03** (zod en el borde y validación de
  scopes), **A04/A09** (límite de 5 y rate limit existente), **A07** (revocación y caducidad siguen
  siendo instantáneas) y **A08** (allowlist cerrada, sin scopes nuevos por accidente).
- Informe en esta tarea con hallazgos, severidad y resolución. Críticos o altos sin resolver
  bloquean `finalizada`.

## Dependencias y notas

- Se apoya en la autorización de task-02 (guard), las claves de task-09 y la UI de claves ya en
  `main`; no cambia el formato del secreto ni la resolución de tokens.
- Sin `role_cap` en delegadas: el rol se lee de `profiles` en cada petición, así que una degradación
  o desactivación del dueño surte efecto en la petición siguiente. Una clave vieja con `role_cap`
  guardado no se migra; el guard no lo lee.
- Migración `0015` solo toca RLS; no reescribe `scopes` ni `role_cap` de las filas existentes.
- **Pregunta abierta (spec §8.1)**: `users:read` no expone email hoy (`UserView` no lo tiene). Se
  mantiene oculto también para el super_admin; si el usuario quiere verlo, es una línea más su test.
  La decisión sobre hacerlo visible para **no-super_admin** queda pendiente de aprobación.
- El panel carga las claves llamando a las rutas del Core en proceso
  (`apps/admin/src/lib/panel-keys.ts`), así que el gate de rol y el guard deben coincidir: el 403 de
  `/keys` no depende solo de `requirePanel`.

## Implementación (2026-11-08)

**Política final aplicada** (detalle en la spec §11):

1. **Delegada = `user` efectivo siempre.** `resolveCaller` devuelve `roleCap: 'user'`; el guard
   ignora cualquier `role_cap` guardado y aplica el allowlist cerrado. `isSuperAdmin` de claves ya
   no mira el cap de una delegada: solo una sesión super_admin o una service key con cap
   super_admin ven el global.
2. **`api_keys:*` en las tres sesiones.** Admin gestiona por API sus delegadas, pero el panel
   `/keys` y `/keys/new` son `requirePanel("super_admin")` y el ítem del menú se oculta a admin.
3. **Recorte al crear.** La delegada guarda `allowlist ∩ scopes efectivos del creador ∩ grants de
   módulo`; si queda vacío → `validation_failed`. La service key rechaza scopes fuera de su set.
4. **Límite transaccional** de 5 delegadas activas por propietario (`pg_advisory_xact_lock`),
   409 `conflict` con `details.code = "key_limit"`.
5. **RLS**: `0015_api_keys_owner_policy.sql` retira la rama `core_is_admin()` de `api_keys_select`.

**Desviaciones respecto al borrador del plan:**

- El borrador rechazaba scopes ilegales al crear; la política final **recorta** los de una delegada
  y solo rechaza si no queda ninguno (una service key sí rechaza).
- El borrador quitaba `api_keys:*` a la sesión admin y le daba 403 en la API; la política final lo
  mantiene en la sesión y limita el 403 al panel.
- El borrador dejaba el rol efectivo de la delegada en el rol vivo del dueño; la política final lo
  fija en `user`.

**Ficheros principales:** `packages/core/src/auth/{guard,caller}.ts` (+ tests),
`packages/core/src/api-keys/{service,api}.ts` (+ tests), `apps/admin/src/lib/api-key-scopes.ts` y
`panel-keys.ts` (+ tests), `apps/admin/src/components/{panel-nav,api-key-create-form}.tsx` (+ tests),
`apps/admin/src/app/(panel)/keys/*` (+ tests), `supabase/migrations/0015_api_keys_owner_policy.sql`,
`packages/db-tests/src/rls/api-keys-devices.test.ts`, catálogos i18n y docs de contrato.

### Filtros del listado de claves (2026-11-08)

`GET /api/v1/api-keys` acepta `kind` (`all|service|delegated`, omitido = `all`) y `user` (uuid del
propietario), validados con zod y aplicados en la misma consulta que el `count`, así que `total`
siempre refleja el conjunto filtrado. `user` + `kind=service` → 400 `validation_failed` (el par solo
podría devolver una lista vacía engañosa). Un no-super_admin solo puede usar su propio id: cualquier
otro propietario → 404 `not_found`, igual que una clave ajena, para no permitir enumerar usuarios.
El panel reenvía ambos desde `apps/admin/src/lib/panel-keys.ts` y `/keys` los expone como selects de
tipo y propietario (ver iteración 21 de task-11).

Tests: filtro por `kind`, por `user`, combinación con paginación y `total`, `kind=all`, un
no-super_admin filtrando lo propio y el 404/400 de los casos no permitidos
(`packages/core/src/api-keys/{service,api}.test.ts`); reenvío y omisión de `kind=all` en
`panel-keys.test.ts`; selects, conservación en paginación/reintento, ocultación con `service` y
limpieza de los tres filtros en `(panel)/keys/page.test.tsx`.

### Ficha de detalle de la clave (2026-11-08)

La lista `/keys` deja de mostrar los scopes y el prefijo (también en la tarjeta móvil), y la acción
de revocar sale de la tabla: cada fila y cada tarjeta enlaza a `/keys/{id}`. La nueva ficha
(`requirePanel("super_admin")`, `instant = false`, `notFound()` si la clave no existe) muestra
breadcrumb, `h1`, badges de tipo/estado, propietario («Instance» o nombre), `role_cap` solo en
`service`, prefijo, creada, caduca y último uso. Los permisos son chips con el nombre legible del
mapa `API_KEY_SCOPE_LABELS` (los scopes de módulo caen al identificador) y la revocación reutiliza
`ApiKeyRevokeButton` con `redirectTo="/keys"`, así que al confirmar se vuelve al listado. Una clave
ya revocada no ofrece la acción.

`api-key-revoke-button` acepta `redirectTo` y expone `completeRevoke` para que el destino posterior
sea comprobable sin DOM. `panel-keys.ts` añade `loadKey(id)`: llamada en proceso a
`GET /api/v1/api-keys/{id}` con Bearer, parseo defensivo y 404/500 con `request_id`.

Tests: lista sin scopes/prefijo/confirmación y con enlace a `/keys/{id}` en tabla y tarjeta
(`(panel)/keys/page.test.tsx`); ficha con metadatos, permisos con nombre e identificador, 404, 403,
error con `request_id` y botón solo con la clave viva (`(panel)/keys/[id]/page.test.tsx`);
`loadKey` con owner resuelto, `Instance`, 404, 500 y cuerpo malformado (`panel-keys.test.ts`);
etiqueta conocida y fallback de módulo (`api-key-scopes.test.ts`); `completeRevoke`.

### Edición de la clave (2026-11-08)

`PATCH /api/v1/api-keys/{id}` ya existía en el Core (nombre, scopes y caducidad; `kind`,
`role_cap` y `user_id` inmutables; 409 con `details.code = "revoked"`). El panel estrena su UI:

- `panel-keys.ts` añade `updateKey(id, patch)`: llamada en proceso a la ruta del Core con Bearer,
  el mismo parseo defensivo que `loadKey` y `details.code` propagado para explicar el 409.
- `/keys/{id}` muestra un **Edit** primario junto a Revoke; una clave revocada no ofrece ninguno
  de los dos.
- `/keys/{id}/edit` (`requirePanel("super_admin")`, `instant = false`, `notFound()` si no existe,
  y redirección a la ficha si la clave está revocada) edita **nombre** y **caducidad**, y ofrece
  los permisos con el mismo selector del alta (`kind` + `role_cap`, "Select all"/"Clear all").
  Tipo, propietario, `role_cap` y prefijo son de solo lectura. Un aviso indica que los cambios se
  aplican en la siguiente petición.
- El fieldset de permisos se extrae a `components/api-key-scope-fieldset.tsx` y lo comparten alta
  y edición.
- El envío usa `useActionState` sobre la server action `updateKeyAction`: 400/404/409 vuelven como
  estado del formulario (el 409 `revoked` con su mensaje propio) y el éxito redirige a la ficha.

El selector ofrece los scopes del allowlist del Core y, en claves delegadas, los permisos de los
módulos concedidos al propietario (ver «Permisos de módulo en el panel» más abajo).

Tests: Edit visible/oculto en la ficha, valores actuales y solo el allowlist del tipo en `/edit`,
"Select all" sin permisos no permitidos, patch exacto y errores del `updateKeyAction`, y el propio
`updateKey` (método, cuerpo, Bearer, 409 y 404). Además `api-key-edit-form.test.tsx` cubre los chips
de módulo no disponibles y que desmarcar todo lo editable conserva esos scopes en el patch, y
`actions.test.ts` cubre la reinyección de los preservados y el fallo de `loadKey`.

### Permisos de módulo en el panel (2026-11-08)

`GET /api/v1/users/{id}/modules` ya devolvía los módulos concedidos y activos del propietario. El
panel la consume con `loadUserModules(userId)` (`apps/admin/src/lib/panel-user-modules.ts`, llamada
en proceso con Bearer y el mismo parseo defensivo que `loadKey`). La degradación es estrecha: un
fallo de transporte devuelve lista vacía para que el formulario siga renderizando; un 403/404/500 se
propaga como error del formulario y nunca se silencia.

- **Alta**: al elegir propietario en una clave delegada, el formulario pide sus módulos con la server
  action `loadUserModulesAction` dentro de `useTransition` (con aviso de carga y error visible). Por
  cada módulo ofrece `<key>:read` y `<key>:read_write`. "Select all" incluye los módulos ofrecidos y,
  al cambiar de propietario, el reducer descarta los scopes de módulo del anterior antes de que
  llegue la lista nueva: nunca viajan en el alta. Una service key no ofrece módulos.
- **Edición**: la página carga los módulos del dueño y los pasa al formulario; los scopes de módulo
  concedidos pasan de chips a checkboxes editables. `updateKeyAction` recarga la clave **y** los
  módulos antes de construir el patch, y usa el mismo conjunto ofrecido para separar editable de
  preservado.
- **Read and write implica read**: lo aplica `withModuleImplication` en el reducer del alta y en
  `toggleKeyScope`, no el DOM. Marcar "Read and write" marca también "Read"; desmarcar "Read"
  desmarca "Read and write"; desmarcar "Read and write" deja "Read".
- **Módulo retirado o scope legado**: cualquier scope almacenado que no esté entre los ofrecidos
  (módulo ya no concedido, scope fuera del allowlist) no tiene checkbox; se muestra bajo
  «Not available» como chip de solo lectura y el patch lo conserva. Nunca se borra en silencio; el
  único modo de quitarlo es revocar la clave.
- **Service keys**: no se ofrecen módulos; sus scopes de módulo almacenados, si los hubiera, quedan
  en «Not available» y se conservan igual.

Tests: `panel-user-modules.test.ts` (200 con Bearer, 500/403/404 propagados, degradación solo en
fallo de transporte y cuerpo malformado), `api-key-module-scopes.test.ts` (scopes ofrecidos por
módulo, implicación read/read-write, nunca módulos en service), `api-key-scope-fieldset.test.tsx`
(dos checkboxes por módulo, "Select all" con módulos, `aria-describedby` del error),
`api-key-create-form.test.tsx` (el propietario carga módulos, cambiar de dueño descarta los del
anterior, "Select all" los incluye y el input los filtra), `api-key-edit-form.test.tsx` y
`(panel)/keys/[id]/edit/{page,actions}.test.tsx` (módulos del dueño editables, quitarlos, chip
«Not available» conservado en el patch y fallo de carga sin escritura parcial).

**Verificación ejecutada**

- `pnpm --filter admin test` — 773 tests en verde.
- `pnpm --filter @027apps/core test` — 341 tests en verde.
- `pnpm --filter db-tests exec vitest run src/api/api-keys.test.ts` — 4 en verde.
- `pnpm --filter db-tests exec vitest run src/api-keys/service.test.ts` y `src/rls/api-keys-devices.test.ts` — verdes tras aplicar `0015` al stack local y aislar el conteo global de datos preexistentes.
- `pnpm lint`, `pnpm tsc`, `pnpm i18n:check` — en verde (505 cadenas, 9 locales).
- No se ejecutó `next build` (orden explícita); el dev server se reinició al terminar.

**Consecuencia aceptada:** una integración antigua con scopes hoy retirados (p. ej. `settings:write`
en una delegada) empieza a recibir 403 `insufficient_scope` tras el despliegue, sin decir qué scope
falta. Las filas no se reescriben; el valor guardado queda como pista de auditoría.

**Pendiente antes de `finalizada`:** QA de un segundo agente y auditoría de seguridad OWASP
(A01/A02/A03/A04/A05/A07/A08/A09) con informe en esta tarea.

## Hallazgos de la auditoría

Auditoría de autorización de API keys sobre la implementación anterior. Todos los hallazgos con
código corregido llevan test que falla antes del cambio y pasa después.

### M1 — `authenticated` podía escribir en `public.api_keys` (crítico)

`0009_api_keys_devices.sql` concedía `insert, update, delete` a `authenticated` y
`api_keys_write for all` lo permitía sobre las claves propias. Con su JWT, un usuario podía insertar
filas con `key_hash` a su gusto, `scopes` arbitrarios y el `user_id` de otra persona, saltándose el
límite de 5 y la propiedad.

**Resolución:** `supabase/migrations/0016_api_keys_no_direct_write.sql` elimina `api_keys_write` y
revoca `insert, update, delete` a `authenticated`; `api_keys_select` queda intacta. Las escrituras
van siempre por el Core (pool de servicio) tras el guard. Verificado con
`grep 'from("api_keys")'` sobre `apps/admin/src`: no hay ninguna escritura con el cliente de usuario
(el único acceso directo es la lectura agregada de contadores en `panel-keys.ts`, que usa el pool de
servicio).

### M2 — el comentario del guard prometía un guard de módulos inexistente

`guard.ts` afirmaba que los scopes de módulo se validaban «on every request by the modules guard».

**Resolución:** el comentario ahora dice la verdad: el scope de módulo se valida al crear/editar
contra `user_modules`; la comprobación por petición llegará con los endpoints de módulo. Corregida
también la spec (`2026-11-08-api-key-scopes-design.md` §4 y fuera de alcance).

### M3 — `PATCH` se saltaba el límite de 5

`updateApiKey` permitía alargar la caducidad de una clave caducada. Como las caducadas no cuentan
para el límite, se podían acumular y resucitar sin tope.

**Resolución:** si el patch deja la clave activa (`revoked_at is null` y `expires_at` nulo o futuro)
y antes no lo estaba, `updateApiKey` recontra dentro de la misma transacción, con
`pg_advisory_xact_lock(hashtext('api_keys:<owner>'))`, las delegadas activas del dueño excluyendo el
id editado; con 5 responde 409 `conflict` con `details.code = "key_limit"` (mismo `keyLimitError()`
que la creación). Tests: con 5 activas, extender una caducada → 409; con 4 → 200.

### M4 — oráculo de email con `users:read`

`listUsers` buscaba `q` también en `profiles.email` para cualquier caller con `users:read`, así que
una clave delegada podía confirmar si un email pertenecía a la instancia.

**Resolución:** `listUsers` recibe el `caller`; el término de email solo se aplica a un super_admin
(sesión o service con cap `super_admin`). Para el resto, `q` busca solo por nombre. Tests: una
delegada con `users:read` no encuentra por email y sí por nombre; una service cap admin tampoco; un
super_admin sí. Ruta `usersRoute` actualizada.

### B1 — editar dependía de los scopes del editor

`updateApiKey` revalidaba los scopes de una delegada con `delegatedCreationScopes`, que además
interseca con `effectiveScopes(caller)`: un usuario que editaba su propia clave perdía en silencio
scopes concedidos por un super_admin.

**Resolución:** en `PATCH` la allowlist es la de la clave (`DELEGATED_SCOPES` + módulos vigentes del
dueño), sin intersecar con los del editor; la propiedad ya limita la edición al dueño o a un
super_admin. Test: un super_admin crea una delegada con `users:read` y el dueño (sesión `user`) la
edita sin perderlo.

### B2 — `withTx` cae al cliente sin transacción si no se inyecta (riesgo aceptado)

Sin `withTransaction`, `withTx` ejecuta sobre `deps.db` y el conteo + escritura dejan de ser
atómicos. **Riesgo aceptado:** en producción siempre se inyecta `withTransaction`
(`withTransactionClient`); el fallback existe solo para tests y composiciones simples.

### B3 — la service key llevaba `api_keys:*` pero las acciones la rechazaban

`MACHINE_SCOPES.service` incluía `api_keys:*`, mientras las cuatro acciones de claves rechazan a un
caller `service`. Contrato incoherente y superficie innecesaria.

**Resolución:** `api_keys:*` sale de los scopes de service (una credencial no acuña credenciales).
La gestión de claves queda en las sesiones humanas y en las delegadas del dueño. Tests de guard
actualizados a 403 en ambos caps y test de servicio que ya esperaba `insufficient_scope`.

### B4 — server actions sin gate de panel

`updateKeyAction` y `loadUserModulesAction` no repetían el gate de página y eran invocables fuera del
render.

**Resolución:** ambas empiezan con `await requirePanel("super_admin")`; denegado devuelve
`insufficient_scope` sin tocar el API. Tests: un `admin` recibe el error y no se llama a
`loadKey`/`updateKey` ni a `loadUserModules`.

## Caducidad relative en alta y edición, filtro `expired` en servidor

El Core ya acepta `expires_at` en `POST`, `expires_at: string | null` en `PATCH` y `state` en el
listado. El panel los usa así:

- **Alta**: `ApiKeyExpiryField` (nunca / en X horas, días, meses o años) con estado
  `ExpiryChoice` y `never` por defecto. `buildApiKeyCreateInput` añade `expires_at` solo para
  `relative`; un importe fuera de `1..10000` lanza `RangeError` y se muestra como error del campo
  `expiry_amount` sin enviar la petición.
- **Edición**: el `datetime-local` y el hidden `current_expires_at` desaparecen. El formulario
  ofrece `never`, `keep` (solo si la clave caduca) y `relative`; la acción parsea
  `expiry_mode`/`expiry_amount`/`expiry_unit`, calcula el instante en UTC con `expiresAtFrom` y
  envía `null` al quitar la caducidad o nada al mantenerla. `toDateTimeLocal` y `changedExpiry`
  se eliminan.
- **Lista**: `loadApiKeys` reenvía `state` al API (`all`, `active`, `revoked`, `expired`) y la
  página deja de filtrar en cliente: la paginación y `total` salen del servidor. El selector
  ofrece Active, Expired, Revoked y All, y el badge deriva tres estados (revocada → destructive,
  caducada → neutral, activa → success) en tabla y tarjeta móvil.

Tests: aritmética UTC por unidad y límites en `api-key-expiry.test.ts`; render de los tres modos y
error accesible en `api-key-expiry-field.test.tsx`; alta, edición y acción de los tres modos;
listado con `state=expired` llegando al API, badge caducado, orden del filtro y `total` sin
recortes.

## Cierre (2026-11-08)

- **Evidencia**: `pnpm lint` ✓, `pnpm tsc` ✓, `pnpm --filter admin build` ✓ (ejecutado con el
  dev server parado y su salida leída), `pnpm --filter core test` ✓ (363), `pnpm --filter admin
  test` ✓ (836), `pnpm --filter @027apps/i18n test` ✓ (26), `pnpm i18n:check` ✓ (518 cadenas, 9
  locales), `pnpm check:openapi` ✓ (56/56 operaciones).
- **Migraciones**: `0015` y `0016` aplicadas en local con `npx supabase migration up`.
- **db-tests**: `src/api/api-keys.test.ts`, `src/api-keys/service.test.ts` y
  `src/rls/api-keys-devices.test.ts` en verde. Los 8 fallos del resto de la suite son previos y
  ambientales, por datos residuales en la base compartida (tabla de monedas con 2 filas en vez de
  155, invitaciones y categorías sobrantes, ajustes de instancia y FCM modificados a mano) y una
  expectativa obsoleta de `total` en `users/service.test.ts`. Ninguno toca claves API.
- **Auditoría OWASP**: veredicto **APTO CON RESERVAS**. M1, M3, M4, B1, B3 y B4 resueltos en
  `a025d36`; M2 corregido en el comentario del guard; B2 aceptado como riesgo documentado (en
  producción siempre se inyecta `withTransaction`).
- **Revisión de estilo**: sin bloqueantes. Aplicados: `inputClass` y `cancelClass` compartidos en
  `components/ui/form.tsx`, reutilización de `toggleKeyScope`/`selectAllKeyScopes` de `lib` en el
  alta, `ownerAtLimit` en el selector de propietario, límite con `MAX_ACTIVE_DELEGATED_KEYS` como
  única fuente (mensaje con `{count}` y una sola clave i18n), `case "reset"` explícito, orden de
  imports y docblock de `apiKeyFingerprint` en dos frases. Diferido: extraer la lógica pura de
  `api-key-create-form.tsx` (782 líneas) a `lib/`; queda anotado como deuda técnica y no bloquea.
- **Fuera de alcance, anotado**: `state` se filtra en servidor desde `3912d90`; las fichas de
  detalle de invitaciones y módulos no existen (sin destino para filas clicables).
