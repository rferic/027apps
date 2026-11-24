# Sprint 17 · Tarea 01 — Import atómico y candado de duplicados

**Goal:** que el commit de una importación sea atómico y que dos commits simultáneos del mismo
grupo no puedan duplicar movimientos, y que los miembros del mapeo nazcan dentro de esa misma
transacción.

**Architecture:** la lectura de las huellas ya importadas pasa de hacerse antes de la transacción a
hacerse dentro, justo después del `pg_advisory_xact_lock` por grupo, que es lo que el comentario del
código ya promete. Los miembros nuevos dejan de crearse en los llamantes (panel y app) y se crean
dentro de la misma transacción, reutilizando la lógica de `addMember` sobre el `db` transaccional.

**Tech Stack:** TypeScript (`packages/owe-no`, Next.js admin), Postgres/Supabase (`pg`), Vitest
(`packages/db-tests`, `apps/admin`), Android Kotlin + Compose, Zod, OpenAPI.

**Spec:** [`docs/tasks/sprint-17-panel-y-notificaciones/README.md`](../tasks/sprint-17-panel-y-notificaciones/README.md)

> **Estado 2026-11-23:** tarea 01 **finalizada** (PR #152, CI en verde). El test de concurrencia
> fallaba con el código anterior (`expected 2, received 4`) y pasa con el arreglo; la suite de
> importaciones queda 12/12. Revisada por dos agentes: el test ya no desinstala un módulo existente
> (solo limpia su grupo) y los hallazgos de estilo quedaron cerrados.
> Pendiente de revisión y auditoría de seguridad antes de `finalizada`.

## Global Constraints

- Toda escritura del import corre en **una** transacción, bajo
  `pg_advisory_xact_lock(hashtext(group_id))`.
- Las huellas se leen **después** del candado y con el `db` de la transacción, nunca con `deps.db`.
- `newMembers` solo crea miembros del propio grupo; el servidor deriva estado y rol como
  `addMember` (invitado si es cuenta, activo si es nombre ficticio).
- Sin `any` injustificado, sin `console.log`, sin SQL concatenado.
- Commits en Conventional Commits, en inglés. Rama `sprint/17-panel-y-notificaciones`.

## Mapa de archivos

| Área | Archivos |
|---|---|
| Core | `packages/owe-no/src/importer.ts`, `packages/owe-no/src/requests.ts` |
| Rutas | `apps/admin/src/app/api/v1/owe-no/groups/[id]/imports/route.ts` |
| Panel | `apps/admin/src/lib/owe-no-import-actions.ts` |
| App | `data/ApiClient.kt`, `data/OweDtos.kt`, `ui/screens/OweImportScreen.kt` |
| Tests | `packages/db-tests/src/modules/owe-no-imports.test.ts`, `apps/admin/src/components/owe-no/import-wizard.test.tsx`, `apps/android/app/src/test/...` |
| OpenAPI | `packages/core/src/openapi/*` y el documento generado |

---

### Task 1: test de regresión de la carrera (rojo)

**Files:**
- Modify: `packages/db-tests/src/modules/owe-no-imports.test.ts`

**Interfaces:**
- Consumes: `commitImport(deps, userId, groupId, csv)`.
- Produces: un test que falla con el código actual y pasa con el candado bien puesto.

- [x] **Step 1: deps con transacción real**

Añadir al fichero un helper `poolDeps()`: cada `withTransaction` abre **su propia** conexión
(`new Client({ connectionString: dbUrl() })`), hace `BEGIN`/`COMMIT`/`ROLLBACK` y entrega un
`OweDb` que consulta por esa conexión; `deps.db` usa otra conexión dedicada. Cerrar todas en el
`finally`.

- [x] **Step 2: estado comprometido**

El test no puede vivir en `inRollback`: necesita dos conexiones que se vean. Crea el usuario
super_admin, instala y activa el módulo, crea el grupo y sus miembros en una transacción
**committed**, y limpia en `finally` (`uninstallModule` con el manifest y borrado de
`auth.users`/`public.profiles`).

- [x] **Step 3: forzar el solape**

Con una conexión `blocker`: `BEGIN; select pg_advisory_xact_lock(hashtext($grupo))`. Lanza los dos
`commitImport` con `poolDeps()` distintos y espera a que **los dos** backends estén esperando en un
lock (`select count(*) from pg_stat_activity where wait_event_type = 'Lock' and query ilike
'%pg_advisory_xact_lock%'`), con timeout de 5 s. Suelta el `blocker` y espera ambos.

- [x] **Step 4: la aserción**

`select count(*) from module_owe_no.owe_no_movements where group_id = $1` debe ser igual al número
de filas del CSV, no al doble. Y `owe_no_import_rows` igual. El CSV de dos filas basta.

- [x] **Step 5: rojo**

`pnpm --filter db-tests test -- src/modules/owe-no-imports.test.ts` → el test nuevo falla con
`expected 2, received 4` (o el doble del CSV). Anotar la salida.

### Task 2: leer las huellas dentro del candado (verde)

**Files:**
- Modify: `packages/owe-no/src/importer.ts`

- [x] **Step 1: `knownHashes` acepta el `db`**

Cambiar la firma a `knownHashes(db: Pick<OweDb, "query">, groupId)` y pasarle el `db` de la
transacción.

- [x] **Step 2: mover la lectura**

`rows`, `duplicates` y `fresh` se calculan dentro de `run`, después del `pg_advisory_xact_lock` y,
si hay `reset`, después de borrar. El comentario de `:261` pasa a ser verdad.

- [x] **Step 3: verde**

El test de la Task 1 pasa; el resto de la suite de importaciones sigue en verde.

### Task 3: miembros dentro de la transacción

**Files:**
- Modify: `packages/owe-no/src/importer.ts`, `packages/owe-no/src/requests.ts`,
  `apps/admin/src/lib/owe-no-import-actions.ts`, `apps/android/.../ApiClient.kt`,
  `apps/android/.../OweDtos.kt`, `apps/android/.../OweImportScreen.kt`
- Test: `packages/db-tests/src/modules/owe-no-imports.test.ts`,
  `apps/android/app/src/test/...`

- [x] **Step 1: test primero**

`commitImport` con `newMembers: [{ name: "Bolli" }, { name: "Luis", userId }]` y un `mapping` que
los use: los crea dentro y los movimientos apuntan a ellos. Un CSV con un nombre no mapeado y sin
`newMembers` sigue dando `unmapped_identity`. Un fallo posterior revierte también los miembros.

- [x] **Step 2: dominio**

`commitImport` acepta `newMembers` y, dentro de `run` y con el `scoped`, crea cada uno reutilizando
la lógica de `addMember` (extraer un `addMemberWith(db, …)` interno si hace falta; `addMember`
público lo llama).

- [x] **Step 3: panel**

`importCommitAction` manda `newMembers` y deja de llamar a `addMember` en bucle.

- [x] **Step 4: app**

El mapeo guarda la elección (`name → { memberId } | { userId } | { newName }`) en memoria;
`oweImportCommit` la envía en el commit. Cancelar no llama a `POST /members`.

- [x] **Step 5: borde y OpenAPI**

`new_members` en `importCommitSchema` (`zod` estricto, máximo 200) y en el esquema OpenAPI.

### Task 4: el mensaje del límite

**Files:**
- Modify: `packages/owe-no/src/importer.ts`

- [x] **Step 1:** «the file is larger than 400 KB» → «2 MB», con su test si ya existe uno del error.

### Task 5: verificación

- [x] `pnpm --filter db-tests test -- src/modules/owe-no-imports.test.ts`
- [x] `pnpm --filter @027apps/owe-no test`
- [x] `pnpm --filter admin test`
- [x] `pnpm lint && pnpm tsc`
- [x] `./gradlew :app:testDebugUnitTest`
- [x] Actualizar `task-01.md` a `test` y anotar la evidencia en el README del sprint.
