# Board fase C (escritura desde el panel + flujo acumulado) — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea por tarea. Los pasos usan sintaxis de casillas (`- [ ]`). Antes de escribir código de Next, lee la guía correspondiente en `apps/admin/node_modules/next/dist/docs/` (este Next no es el que conoces). El token de GitHub **nunca** sale al cliente, a logs ni al envelope; los writes solo corren con `service_role`.

**Objetivo:** Habilitar la escritura desde el panel — cambiar `status`/milestone de una issue y añadir un comentario — reutilizando **la misma máquina de estados y el mismo guard que el CLI** (`move`/`close` de `packages/core/src/board/commands.ts`), y añadir la **evolución acumulada**: una tabla de snapshots diarios (`board_snapshots`) alimentada de forma perezosa e idempotente y un gráfico de flujo acumulado (issues por estado a lo largo del tiempo). **Sin webhooks, sin cron, sin jobs nuevos, sin dependencias nuevas.**

**Arquitectura:** La escritura reutiliza la superficie core de la fase A: `move`/`close` validan la transición y devuelven `Result<BoardIssue>` (`{ ok: false, error }`); el endpoint **no decide transiciones válidas**, solo enruta el target terminal (`done`/`discarded` → `close`, el resto → `move`) y mapea el fallo a 409 `conflict` con `details: { current, allowed }` derivados de `statusFromLabel`/`nextStatuses` (core, no reimplementados). El milestone se asigna vía `GitHubClient.updateIssue({ milestone })` (no existe comando core para milestone) tras validar que está abierto. El endpoint `PATCH`/`POST` comparte el patrón de la fase B: factoría de rutas en `routes.ts` + acceso server-only en `data.ts` (token descifrado por `service_role` + `settingsDeps.encryption.decrypt`). Los snapshots viven en core (`snapshots.ts`, patrón `QueryClient` de `packages/core/src/currencies`): `ensureDailySnapshot` (insert `on conflict do nothing`) y `readSnapshots`; la primera lectura del día del `summary` llama a `ensureDailySnapshot`. El gráfico es SVG/CSS con tokens, sin librería.

**Stack técnico:** Next 16.4.3 (`apps/admin`), `@027apps/core` (zod v4, `OctokitGitHubClient`/`BoardIssue`/`Summary`/`summarize`/`move`/`close`/`statusFromLabel`/`nextStatuses`/`canTransition` de la fase A, `QueryClient` de `api/rate-limit-storage.js`), `swr` (ya añadido en la fase B), `next/cache` (`unstable_cache`, `revalidateTag`), vitest ^5 (admin con puerto board falso; core con `QueryClient` falso). **Sin dependencias nuevas.**

**Spec:** `docs/superpowers/specs/2026-11-06-board-issues-design.md` (§3.7 fase C, §7 máquina de estados, §10 guard, §12.1/§12.2 modelo/seguridad, §13 fase C, §14 pruebas) · planes base `docs/superpowers/plans/2026-11-06-board-phase-a.md` (produce `move`/`close`/`states.ts`/`github-client.ts`) y `docs/superpowers/plans/2026-11-06-board-phase-b.md` (produce `getBoardData`, `data.ts`/`routes.ts`/`filter.ts`, endpoints `summary`/`issues`/`refresh`, caché tag `board`, shell `(panel)`, i18n) — **se consumen, no se redefinen**.

## Restricciones globales

- Node 22 (runtime y CI); pnpm 10.33.3 (`packageManager`).
- Next 16.4.3; vitest ^5 (`pnpm --filter admin test`, `pnpm --filter @027apps/core test`), zod v4 (`^4.6.7`), TypeScript strict; sin `any`, sin `@ts-ignore`.
- Tokens semánticos solo (`bg-background`, `text-foreground`, …); sin colores hardcodeados (ESLint `no-restricted-syntax`). El gráfico usa anchos CSS + utilities de token, sin librería de charts.
- i18n: toda cadena visible vía `t(...)` con el inglés como clave; `pnpm i18n:scan` commiteado, los 9 locales completos, `pnpm i18n:check` en verde.
- `guard-secrets` en verde: el token vive solo como ajuste cifrado `github_board.token`; nunca en git/`.env*`/logs/`NEXT_PUBLIC_*`/envelope.
- Conventional Commits `feat(board): …` (también `test(board)`, `docs(board)`); rama `sprint/09-board-write` (o la rama del sprint del board si C se envía en el mismo sprint que A/B).
- **Sin dependencias nuevas.** Fase C consume `swr` (añadido en B) y no añade nada más.
- Fase C depende de A (`move`/`close`/`states.ts`/`github-client.ts` con el export `./board/*.js`) y de B (`data.ts`/`routes.ts`/endpoints base). Si no están mergeadas, este plan depende de ellas.

## Foco de revisión

- **Transición inválida desde el panel** → `move`/`close` devuelven `{ ok: false }`; el endpoint mapea a 409 `conflict` con `details: { current, allowed }` (estado actual + transiciones legales), **sin** reimplementar la máquina. → test `PATCH returns 409 conflict with current and allowed details` (Tarea 3).
- **`status: done|discarded` cierra la issue** → el despachador envía targets terminales a `close` (label terminal + `state: closed`), el resto a `move`; un PATCH a `done` desde un estado no permitido falla igual que en el CLI. → test `PATCH status done routes to close and closes the issue` (Tarea 3).
- **Milestone no abierto** → `validation_failed` (400) con `details: { milestone }`; el selector del cliente solo ofrece milestones abiertos (defensa en profundidad, ADR 0004 §3). → test `PATCH milestone rejects a closed milestone` (Tarea 3).
- **Snapshot idempotente por día** → `ensureDailySnapshot` usa `insert … on conflict (snapshot_date) do nothing`; dos lecturas del mismo día insertan una sola fila. → test `ensureDailySnapshot inserts one row per day, no duplicates` (Tarea 2).
- **Rollback optimista visible** → al fallar el PATCH, SWR restaura el valor anterior y muestra el error con `request_id`; nunca deja la UI en un estado que GitHub no confirmó. → test `status select rolls back on a failed patch` (Tarea 6).

## Mapa de ficheros

| Fichero | Crear/Modificar | Responsabilidad |
|---|---|---|
| `packages/core/src/board/github-client.ts` | Modificar | Añadir `addComment(number, body)` a `GitHubClient` + impl Octokit. |
| `packages/core/src/board/github-client.test.ts` | Modificar | Test MSW de `addComment`. |
| `packages/core/src/board/snapshots.ts` | Crear | `BoardSnapshot`, `ensureDailySnapshot`, `readSnapshots`, `buildSnapshotPayload`. |
| `packages/core/src/board/snapshots.test.ts` | Crear | Tests con `QueryClient` falso (idempotencia, orden, payload). |
| `packages/core/src/auth/guard.ts` | Modificar | Añadir `'board:write'` a `SUPER_ADMIN_SCOPES`. |
| `supabase/migrations/0015_board_snapshots.sql` | Crear | Tabla `board_snapshots` (una fila por día). |
| `apps/admin/src/lib/board/data.ts` | Modificar | Extender el puerto board con `updateIssue`/`addComment`/`history`; cablear `ensureDailySnapshot` en `getSummary`; normalizar errores de Octokit. |
| `apps/admin/src/lib/board/routes.ts` | Modificar | Factorías de rutas `boardIssuePatchRoute`/`boardIssueCommentRoute`/`boardHistoryRoute`. |
| `apps/admin/src/app/api/v1/board/issues/[number]/route.ts` | Crear | Handler `PATCH` delgado (wiring `getInfra()`). |
| `apps/admin/src/app/api/v1/board/issues/[number]/comments/route.ts` | Crear | Handler `POST` delgado. |
| `apps/admin/src/app/api/v1/board/history/route.ts` | Crear | Handler `GET` delgado. |
| `apps/admin/src/lib/board/write.test.ts`, `history.test.ts` | Crear | Tests de endpoints con puerto board falso. |
| `apps/admin/src/app/(panel)/board/{status-select,milestone-select,comment-box,cumulative-flow}.tsx` | Crear (4) | Selectores, caja de comentario y gráfico acumulado. |
| `apps/admin/src/app/(panel)/board/{board-client,issue-table}.tsx` | Modificar | Estado optimista + rollback; integrar selectores y comentarios. |
| `packages/i18n/catalog.en.json` + `locales/*.json` | Modificar | Cadenas nuevas (Tarea 9, Traductor). |
| `docs/flows/board.md` | Modificar | Sección de la fase C (Tarea 10). |

---

### Tarea 1: `addComment` en `GitHubClient` + MSW

**Ficheros:**
- Modificar: `packages/core/src/board/github-client.ts`
- Modificar: `packages/core/src/board/github-client.test.ts`

**Interfaces:**
- Produce: `addComment(number: number, body: string): Promise<void>` añadido a la interfaz `GitHubClient`.
- Produce: implementación en `OctokitGitHubClient` vía `octokit.rest.issues.createComment({ owner, repo, issue_number: number, body })` (`owner`/`repo` derivados de `repo: 'rferic/027apps'`).

- [ ] **Paso 1: Escribir el test MSW que falla**

```ts
// github-client.test.ts — append (setupServer from msw/node)
it('addComment posts a comment to the issue comments endpoint', async () => {
  let posted: { issue_number: number; body: string } | undefined;
  server.use(http.post('https://api.github.com/repos/rferic/027apps/issues/7/comments', async ({ request }) => {
    posted = await request.json() as never;
    return HttpResponse.json({ id: 1 }, { status: 201 });
  }));
  await new OctokitGitHubClient({ repo: 'rferic/027apps', token: 'x' }).addComment(7, 'LGTM');
  expect(posted).toEqual({ issue_number: 7, body: 'LGTM' });
});
```

- [ ] **Paso 2: Verlo fallar**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/github-client.test.ts`
Esperado: FAIL — `addComment` no existe en la interfaz ni en la impl.

- [ ] **Paso 3: Implementar `addComment`**

Añadir la firma a `GitHubClient` y el método a `OctokitGitHubClient` (`this.octokit.rest.issues.createComment(...)`, sin mapear la respuesta porque el contrato es `void`).

- [ ] **Paso 4: Verlo pasar**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/github-client.test.ts`
Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/core/src/board/github-client.ts packages/core/src/board/github-client.test.ts
git commit -m "feat(board): add addComment to the GitHub client"
```

---

### Tarea 2: migración `0015_board_snapshots.sql` + `snapshots.ts`

**Ficheros:**
- Crear: `supabase/migrations/0015_board_snapshots.sql`
- Crear: `packages/core/src/board/snapshots.ts`
- Test: `packages/core/src/board/snapshots.test.ts`

**Interfaces:**
- Produce: `export interface BoardSnapshot { snapshotDate: string; payload: { byStatus: Record<BoardStatus, number> } }` (`BoardStatus` importado de `./states`).
- Produce: `export async function ensureDailySnapshot(db: QueryClient, snapshotDate: string, payload: BoardSnapshot['payload']): Promise<void>` — `insert into public.board_snapshots (snapshot_date, payload) values ($1, $2) on conflict (snapshot_date) do nothing` con `payload` serializado a JSON.
- Produce: `export async function readSnapshots(db: QueryClient, days: number): Promise<BoardSnapshot[]>` — `select snapshot_date, payload from public.board_snapshots where snapshot_date >= current_date - ($1::int - 1) order by snapshot_date asc`.
- Produce: `export function buildSnapshotPayload(issues: BoardIssue[], date: Date): BoardSnapshot['payload']` — `{ byStatus: summarize(issues, date).byStatus }`.

- [ ] **Paso 1: Escribir la migración `0015_board_snapshots.sql`**

```sql
-- Board cumulative-flow daily snapshots (phase C). One row per day, written
-- lazily and idempotently by the first /summary read of the day (no cron).
create table public.board_snapshots (
  snapshot_date date primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.board_snapshots enable row level security;
grant all on public.board_snapshots to service_role;
-- No anon/authenticated grants: history is read server-side via service_role only.
```

- [ ] **Paso 2: Escribir los tests que fallan (`QueryClient` falso)**

```ts
// snapshots.test.ts — in-memory fake db recording queries
const issues = [mk(1, ['status:in-progress', 'type:feature', 'module:core']), mk(2, ['status:done', 'type:chore', 'module:core'])];
const day = new Date('2026-11-06T00:00:00Z');

it('buildSnapshotPayload counts issues by status', () => {
  expect(buildSnapshotPayload(issues, day)).toEqual({ byStatus: { 'in-progress': 1, done: 1 } });
});

it('ensureDailySnapshot inserts one row per day, no duplicates', async () => {
  const db = makeDb();
  await ensureDailySnapshot(db, '2026-11-06', { byStatus: { done: 1 } });
  await ensureDailySnapshot(db, '2026-11-06', { byStatus: { done: 2 } }); // same day, ignored
  expect(await db.countRows('public.board_snapshots')).toBe(1);
});

it('readSnapshots returns rows ordered by date within the days window', async () => {
  const db = makeDb([
    { snapshot_date: '2026-11-05', payload: { byStatus: { done: 1 } } },
    { snapshot_date: '2026-11-06', payload: { byStatus: { done: 2 } } },
  ]);
  const snapshots = await readSnapshots(db, 90);
  expect(snapshots.map((s) => s.snapshotDate)).toEqual(['2026-11-05', '2026-11-06']);
  expect(snapshots[1].payload.byStatus.done).toBe(2);
});
```

- [ ] **Paso 3: Verlos fallar**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/snapshots.test.ts`
Esperado: FAIL — `snapshots.ts` no existe.

- [ ] **Paso 4: Implementar `snapshots.ts`**

`ensureDailySnapshot` serializa `payload` con `JSON.stringify` y ejecuta el `insert ... on conflict do nothing`. `readSnapshots` mapea `snapshot_date` a `String(...)` y `payload` (jsonb) a su objeto. `buildSnapshotPayload` delega en `summarize` (fase A) y devuelve solo `byStatus`.

- [ ] **Paso 5: Verlos pasar**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/snapshots.test.ts`
Esperado: PASS.

- [ ] **Paso 6: Commit**

```bash
git add packages/core/src/board/snapshots.ts packages/core/src/board/snapshots.test.ts supabase/migrations/0015_board_snapshots.sql
git commit -m "feat(board): add daily board snapshots and migration 0015"
```

---

### Tarea 3: endpoint `PATCH /api/v1/board/issues/[number]` (reutilizando `move`/`close`)

**Ficheros:**
- Modificar: `packages/core/src/auth/guard.ts` (añadir `'board:write'`)
- Modificar: `apps/admin/src/lib/board/data.ts` (puerto `updateIssue` + normalización de errores)
- Modificar: `apps/admin/src/lib/board/routes.ts` (factoría de rutas `boardIssuePatchRoute`)
- Crear: `apps/admin/src/app/api/v1/board/issues/[number]/route.ts`
- Test: `apps/admin/src/lib/board/write.test.ts`

**Interfaces:**
- Produce (guard): `'board:write'` añadido a `SUPER_ADMIN_SCOPES` (solo super-admin, igual que `'board:read'` en B).
- Produce (data): el puerto `makeBoard(settingsDeps)` gana `updateIssue(number: number, patch: { status?: BoardStatus; milestone?: string | null }): Promise<BoardIssue>` y el helper `mapGithubError(err: { status?: number }): DomainError` (404 → `not_found`, 429 → `rate_limited`, 422 → `validation_failed`, 401/403/resto → `internal`).
- Produce (routes): `export function boardIssuePatchRoute(deps: BoardRouteDeps): (req: Request, number: number) => Promise<Response>`.

- [ ] **Paso 1: Añadir `board:write` al guard**

En `guard.ts`, añadir `'board:write'` a `SUPER_ADMIN_SCOPES`. Sin test propio (lo cubre Tarea 3/Tarea 4: un caller no super-admin recibe 403 `insufficient_scope`). Ejecutar `pnpm --filter @027apps/core test` (sin regresión).

- [ ] **Paso 2: Escribir los tests que fallan (puerto board falso)**

```ts
// write.test.ts — makeDeps({ updateIssue }) con door/auth noop
const CALLER = { kind: 'session', userId: 'u1', role: 'super_admin' } as const;
const patchBody = (b: unknown) => new Request('http://x/api/v1/board/issues/7', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

it('PATCH returns the updated issue and never the token', async () => {
  const updateIssue = vi.fn(async () => mkIssue(7, ['status:in-progress']));
  const res = await boardIssuePatchRoute(makeDeps({ updateIssue }))(patchBody({ status: 'in-review' }), 7);
  expect(res.status).toBe(200);
  expect(JSON.stringify(await res.json())).not.toContain('ghp_');
});

it('PATCH returns 409 conflict with current and allowed details for an invalid transition', async () => {
  const updateIssue = vi.fn(async () => { throw new DomainError('conflict', undefined, { current: 'backlog', allowed: ['approved', 'discarded'] }); });
  const res = await boardIssuePatchRoute(makeDeps({ updateIssue }))(patchBody({ status: 'done' }), 7);
  expect(res.status).toBe(409);
  expect((await res.json()).error.details).toEqual({ current: 'backlog', allowed: ['approved', 'discarded'] });
});

it('PATCH rejects a body with neither status nor milestone (validation_failed)', async () => {
  const res = await boardIssuePatchRoute(makeDeps({ updateIssue: vi.fn() }))(patchBody({}), 7);
  expect(res.status).toBe(400);
  expect((await res.json()).error.code).toBe('validation_failed');
});

it('PATCH maps a GitHub 429 to rate_limited', async () => {
  const updateIssue = vi.fn(async () => { throw new DomainError('rate_limited'); });
  const res = await boardIssuePatchRoute(makeDeps({ updateIssue }))(patchBody({ status: 'approved' }), 7);
  expect(res.status).toBe(429);
});
```

- [ ] **Paso 3: Verlos fallar**

Ejecutar: `pnpm --filter admin test -- src/lib/board/write.test.ts`
Esperado: FAIL — `boardIssuePatchRoute` no existe.

- [ ] **Paso 4: Implementar el puerto `updateIssue` en `data.ts`**

1. `loadBoardConfig(settingsDeps)`; si `enabled === false` → `throw new DomainError('not_found')` (board no configurado).
2. Construir `new OctokitGitHubClient({ repo: BOARD_REPO, token })`; `getIssue(number)` envuelto en `try/catch` → `throw mapGithubError(err)` (404 → `not_found`).
3. Calcular `current = statusFromLabel(issue.labels)` y `allowed = nextStatuses(current)` **solo** para el detalle de error; **no** validar antes de tiempo.
4. Si `patch.status !== undefined`: si `patch.status` es `'done'` o `'discarded'` → `close(client, { issue: number, target: patch.status })`; si no → `move(client, { issue: number, status: patch.status })`. Si el `Result` es `{ ok: false }` → `throw new DomainError('conflict', undefined, { current, allowed })`.
5. Si `patch.milestone !== undefined`: si es `string`, comprobar `(await client.listMilestones('open')).some(m => m.title === patch.milestone)`; si no está abierto → `throw new DomainError('validation_failed', undefined, { milestone: patch.milestone })`. Luego `client.updateIssue(number, { milestone: patch.milestone })` envuelto en `try/catch` → `throw mapGithubError(err)`.
6. Devolver `client.getIssue(number)` (envuelto en `mapGithubError`).

> Nota (decisión de implementación): el orden es `status` primero y `milestone` después; si el status se aplica y el milestone falla, el endpoint responde error y el siguiente `check` del CLI detecta la desviación (spec §13/§7). Sin reintentos silenciosos.

- [ ] **Paso 5: Implementar `boardIssuePatchRoute` en `routes.ts`**

Schema zod en el borde (estricto, al menos un campo):

```ts
const patchSchema = z.object({
  status: z.enum(['backlog', 'approved', 'ready', 'in-progress', 'in-review', 'done', 'discarded']).optional(),
  milestone: z.string().min(1).max(120).nullable().optional(),
}).strict().refine((o) => o.status !== undefined || o.milestone !== undefined, { message: 'at least one of status or milestone' });
```

El handler usa `withDoor(req, { scopes: ['board:write'], auth, rateLimit: { identity: 'user', limit: 10 }, schema: patchSchema }, door, ...)` (límite de peticiones = el de escritura del admin, mismo patrón que `patchCurrencyRoute`). Dentro: `const issue = await board.updateIssue(number, ctx.body); return { issue };`.

- [ ] **Paso 6: Escribir el handler `route.ts`**

Wiring fino de `getInfra()`: `const { deps, auth, settingsDeps } = await getInfra(); return boardIssuePatchRoute({ door: deps, auth, board: makeBoard(settingsDeps) })(req, number);` (leer `number` desde `ctx.params`).

- [ ] **Paso 7: Verlos pasar**

Ejecutar: `pnpm --filter admin test -- src/lib/board/write.test.ts`
Esperado: PASS.

- [ ] **Paso 8: Commit**

```bash
git add packages/core/src/auth/guard.ts apps/admin/src/lib/board/data.ts apps/admin/src/lib/board/routes.ts apps/admin/src/lib/board/write.test.ts apps/admin/src/app/api/v1/board/issues/[number]/route.ts
git commit -m "feat(board): add PATCH issue endpoint reusing move/close and board:write scope"
```

---

### Tarea 4: endpoint `POST /api/v1/board/issues/[number]/comments`

**Ficheros:**
- Modificar: `apps/admin/src/lib/board/data.ts` (puerto `addComment`)
- Modificar: `apps/admin/src/lib/board/routes.ts` (`boardIssueCommentRoute`)
- Crear: `apps/admin/src/app/api/v1/board/issues/[number]/comments/route.ts`
- Test: `apps/admin/src/lib/board/write.test.ts` (ampliar)

**Interfaces:**
- Produce (data): el puerto gana `addComment(number: number, body: string): Promise<void>`.
- Produce (routes): `export function boardIssueCommentRoute(deps: BoardRouteDeps): (req: Request, number: number) => Promise<Response>`.

- [ ] **Paso 1: Escribir los tests que fallan**

```ts
// write.test.ts — append
const commentBody = (b: unknown) => new Request('http://x/api/v1/board/issues/7/comments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

it('POST comment calls addComment and returns created', async () => {
  const addComment = vi.fn(async () => {});
  const res = await boardIssueCommentRoute(makeDeps({ addComment }))(commentBody({ body: 'LGTM' }), 7);
  expect(res.status).toBe(200);
  expect(addComment).toHaveBeenCalledWith(7, 'LGTM');
});

it('POST comment rejects an empty or 4001-char body (validation_failed)', async () => {
  const res = await boardIssueCommentRoute(makeDeps({ addComment: vi.fn() }))(commentBody({ body: 'x'.repeat(4001) }), 7);
  expect(res.status).toBe(400);
  expect((await res.json()).error.code).toBe('validation_failed');
});
```

- [ ] **Paso 2: Verlos fallar**

Ejecutar: `pnpm --filter admin test -- src/lib/board/write.test.ts`
Esperado: FAIL — `boardIssueCommentRoute` no existe.

- [ ] **Paso 3: Implementar el puerto `addComment` y la factoría de rutas**

`data.ts`: `addComment(number, body)` = `loadBoardConfig` (disabled → `not_found`), construir cliente, `client.addComment(number, body)` envuelto en `try/catch` → `throw mapGithubError(err)`.
`routes.ts`: `boardIssueCommentRoute` con `withDoor(req, { scopes: ['board:write'], auth, rateLimit: { identity: 'user', limit: 10 }, schema: z.object({ body: z.string().min(1).max(4000) }).strict() }, door, ...)`; handler → `await board.addComment(number, body); return { created: true };`.

- [ ] **Paso 4: Escribir el handler `route.ts`** (mismo wiring que Tarea 3, con `boardIssueCommentRoute`).

- [ ] **Paso 5: Verlos pasar**

Ejecutar: `pnpm --filter admin test -- src/lib/board/write.test.ts`
Esperado: PASS.

- [ ] **Paso 6: Commit**

```bash
git add apps/admin/src/lib/board/data.ts apps/admin/src/lib/board/routes.ts apps/admin/src/lib/board/write.test.ts apps/admin/src/app/api/v1/board/issues/[number]/comments/route.ts
git commit -m "feat(board): add POST comment endpoint with 1..4000 body validation"
```

---

### Tarea 5: endpoint `GET /api/v1/board/history` + snapshot perezoso en `summary`

**Ficheros:**
- Modificar: `apps/admin/src/lib/board/data.ts` (`ensureDailySnapshot` en `getSummary`; puerto `history`)
- Modificar: `apps/admin/src/lib/board/routes.ts` (`boardHistoryRoute`)
- Crear: `apps/admin/src/app/api/v1/board/history/route.ts`
- Test: `apps/admin/src/lib/board/history.test.ts`

**Interfaces:**
- Produce (data): `getSummary()` llama a `ensureDailySnapshot(settingsDeps.db, todayISO, buildSnapshotPayload(issues, new Date()))` **después** de computar `summary`, antes de devolverlo; el puerto gana `history(days: number): Promise<BoardSnapshot[]>`.
- Produce (routes): `export function boardHistoryRoute(deps: BoardRouteDeps): (req: Request) => Promise<Response>`.

- [ ] **Paso 1: Escribir los tests que fallan**

```ts
// history.test.ts
it('history returns the snapshots from readSnapshots', async () => {
  const history = vi.fn(async () => [{ snapshotDate: '2026-11-05', payload: { byStatus: { done: 1 } } }]);
  const res = await boardHistoryRoute(makeDeps({ history }))(new Request('http://x/api/v1/board/history?days=90'));
  expect(res.status).toBe(200);
  expect((await res.json()).snapshots).toHaveLength(1);
});

it('history validates days (1..365, default 90)', async () => {
  const history = vi.fn(async () => []);
  const bad = await boardHistoryRoute(makeDeps({ history }))(new Request('http://x/api/v1/board/history?days=0'));
  expect(bad.status).toBe(400);
  const ok = await boardHistoryRoute(makeDeps({ history }))(new Request('http://x/api/v1/board/history'));
  expect(ok.status).toBe(200);
  expect(history).toHaveBeenCalledWith(90);
});

it('summary calls ensureDailySnapshot for today', async () => {
  const ensure = vi.fn(async () => {});
  const { getSummary } = makeBoardWith({ ensure });
  await getSummary();
  expect(ensure).toHaveBeenCalledOnce();
});
```

- [ ] **Paso 2: Verlos fallar**

Ejecutar: `pnpm --filter admin test -- src/lib/board/history.test.ts`
Esperado: FAIL — `boardHistoryRoute`/`ensureDailySnapshot` no cableados.

- [ ] **Paso 3: Implementar el snapshot perezoso en `getSummary`**

En `data.ts`, `getSummary` calcula `summary = summarize(issues, new Date())`, luego `await ensureDailySnapshot(settingsDeps.db, new Date().toISOString().slice(0, 10), buildSnapshotPayload(issues, new Date()))`, y devuelve `{ enabled, summary }`. El `todayISO` es la fecha de calendario UTC (`YYYY-MM-DD`).

- [ ] **Paso 4: Implementar `history` y `boardHistoryRoute`**

`data.ts`: `history(days)` = `readSnapshots(settingsDeps.db, days)`. `routes.ts`: `boardHistoryRoute` con `withDoor(req, { scopes: ['board:read'], auth, rateLimit: { identity: 'user', limit: 120 } }, door, ...)` (lectura, igual que `issues` en B); parsea `ctx.searchParams` con `z.object({ days: z.coerce.number().int().min(1).max(365).default(90) })`; devuelve `{ snapshots: await board.history(days) }`.

- [ ] **Paso 5: Escribir el handler `route.ts`** (wiring de `getInfra()`, mismo patrón).

- [ ] **Paso 6: Verlos pasar**

Ejecutar: `pnpm --filter admin test -- src/lib/board/history.test.ts`
Esperado: PASS.

- [ ] **Paso 7: Commit**

```bash
git add apps/admin/src/lib/board/data.ts apps/admin/src/lib/board/routes.ts apps/admin/src/lib/board/history.test.ts apps/admin/src/app/api/v1/board/history/route.ts
git commit -m "feat(board): add history endpoint and lazy daily snapshot on summary"
```

---

### Tarea 6: UI de estado + milestone con actualización optimista y rollback

**Ficheros:**
- Crear: `apps/admin/src/app/(panel)/board/status-select.tsx`
- Crear: `apps/admin/src/app/(panel)/board/milestone-select.tsx`
- Modificar: `apps/admin/src/app/(panel)/board/issue-table.tsx`, `board-client.tsx`
- Test: `apps/admin/src/app/(panel)/board/status-select.test.tsx`

**Interfaces:**
- Produce: `StatusSelect({ issue, messages, onChange })` — `<select>` con solo las transiciones legales: `current = statusFromLabel(issue.labels)`, opciones = `nextStatuses(current)` (importadas de `@027apps/core/board/states.js`). Si `current` es terminal (`done`/`discarded`), sin opciones (select deshabilitado).
- Produce: `MilestoneSelect({ issue, milestones, messages, onChange })` — opciones = milestones abiertos + "None" (para `null`).
- Produce (board-client): `mutateIssue(issue, patch)` — actualización optimista de SWR con `rollbackOnError: true` sobre la clave `/api/v1/board/issues…`.

- [ ] **Paso 1: Escribir el test que falla**

```tsx
// status-select.test.tsx — renderToStaticMarkup
it('renders only the legal next statuses for the issue state', () => {
  const html = renderToStaticMarkup(<StatusSelect issue={mk(7, ['status:backlog', 'type:feature', 'module:core'])} messages={{}} onChange={() => {}} />);
  expect(html).toContain('approved');
  expect(html).toContain('discarded');
  expect(html).not.toContain('done'); // not legal from backlog
});

it('renders a disabled select for a terminal state', () => {
  const html = renderToStaticMarkup(<StatusSelect issue={mk(7, ['status:done'])} messages={{}} onChange={() => {}} />);
  expect(html).toContain('disabled');
});
```

- [ ] **Paso 2: Verlo fallar**

Ejecutar: `pnpm --filter admin test -- src/app/(panel)/board/status-select.test.tsx`
Esperado: FAIL — `status-select.tsx` no existe.

- [ ] **Paso 3: Implementar `StatusSelect` y `MilestoneSelect`**

`StatusSelect` calcula `current = statusFromLabel(issue.labels)` y `nextStatuses(current)` (core, sin reimplementar); renderiza un `<select>` con las opciones legales y llama `onChange(status)`. `MilestoneSelect` renderiza los milestones abiertos (pasados desde `BoardClient`, que los obtiene del `summary.byMilestone` o de un nuevo fetch de milestones abiertos) más "None".

- [ ] **Paso 4: Implementar la mutación optimista con rollback**

En `BoardClient`, `mutateIssue(number, patch)` hace `mutate('/api/v1/board/issues…', optimisticUpdate, { rollbackOnError: true, revalidate: false })` seguido de `fetch(PATCH ...)`; si la respuesta no es 2xx, SWR restaura el valor previo (rollback visible) y se muestra el error (`message` traducido + `request_id`). Tras éxito, `mutate()` de la clave de issues y del `summary`.

- [ ] **Paso 5: Verlo pasar**

Ejecutar: `pnpm --filter admin test -- src/app/(panel)/board/status-select.test.tsx`
Esperado: PASS.

- [ ] **Paso 6: Commit**

```bash
git add apps/admin/src/app/(panel)/board/status-select.tsx apps/admin/src/app/(panel)/board/milestone-select.tsx apps/admin/src/app/(panel)/board/issue-table.tsx apps/admin/src/app/(panel)/board/board-client.tsx apps/admin/src/app/(panel)/board/status-select.test.tsx
git commit -m "feat(board): add status and milestone selectors with optimistic rollback"
```

---

### Tarea 7: UI de comentario

**Ficheros:**
- Crear: `apps/admin/src/app/(panel)/board/comment-box.tsx`
- Modificar: `apps/admin/src/app/(panel)/board/board-client.tsx`
- Test: `apps/admin/src/app/(panel)/board/comment-box.test.tsx`

**Interfaces:**
- Produce: `CommentBox({ issueNumber, messages, onPosted })` — textarea (1..4000) + botón submit; estado `submitting`/`error`; al éxito resetea el textarea y llama `onPosted()`.

- [ ] **Paso 1: Escribir el test que falla**

```tsx
// comment-box.test.tsx — renderToStaticMarkup
it('renders a textarea and a submit button', () => {
  const html = renderToStaticMarkup(<CommentBox issueNumber={7} messages={{}} onPosted={() => {}} />);
  expect(html).toContain('<textarea');
  expect(html).toContain('type="submit"');
});
```

- [ ] **Paso 2: Verlo fallar**

Ejecutar: `pnpm --filter admin test -- src/app/(panel)/board/comment-box.test.tsx`
Esperado: FAIL — `comment-box.tsx` no existe.

- [ ] **Paso 3: Implementar `CommentBox`**

`"use client"`. Estado local del textarea; submit → `POST /api/v1/board/issues/[number]/comments` con `{ body }`; valida `1..4000` en el cliente antes de enviar; `disabled` mientras `submitting`; error del servidor (code `validation_failed`/`rate_limited`/`internal`) mostrado con `request_id`.

- [ ] **Paso 4: Verlo pasar**

Ejecutar: `pnpm --filter admin test -- src/app/(panel)/board/comment-box.test.tsx`
Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/admin/src/app/(panel)/board/comment-box.tsx apps/admin/src/app/(panel)/board/board-client.tsx apps/admin/src/app/(panel)/board/comment-box.test.tsx
git commit -m "feat(board): add comment box to the issue view"
```

---

### Tarea 8: gráfico de flujo acumulado

**Ficheros:**
- Crear: `apps/admin/src/app/(panel)/board/cumulative-flow.tsx`
- Modificar: `apps/admin/src/app/(panel)/board/board-client.tsx` (fetch de `/history` y composición)
- Test: `apps/admin/src/app/(panel)/board/cumulative-flow.test.tsx`

**Interfaces:**
- Produce: `CumulativeFlow({ snapshots }: { snapshots: BoardSnapshot[] })` — SVG/CSS con una serie apilada por `status:*` (conteos acumulados por día), colores vía tokens (`fill-primary`, `fill-accent`, …), sin librería.

- [ ] **Paso 1: Escribir el test que falla**

```tsx
// cumulative-flow.test.tsx
it('renders one band per status across snapshot dates with token classes', () => {
  const html = renderToStaticMarkup(<CumulativeFlow snapshots={[{ snapshotDate: '2026-11-05', payload: { byStatus: { backlog: 2, done: 1 } } }]} />);
  expect(html).toContain('2026-11-05');
  expect(html).toContain('backlog');
  expect(html).not.toMatch(/bg-(gray|slate|red|green|blue)-\d/); // token only
});

it('renders an empty state when there are no snapshots', () => {
  expect(renderToStaticMarkup(<CumulativeFlow snapshots={[]} />)).toContain('No data');
});
```

- [ ] **Paso 2: Verlo fallar**

Ejecutar: `pnpm --filter admin test -- src/app/(panel)/board/cumulative-flow.test.tsx`
Esperado: FAIL — `cumulative-flow.tsx` no existe.

- [ ] **Paso 3: Implementar `CumulativeFlow`**

Componente presentacional puro: convierte `snapshots` en una serie por `status:*` (claves del payload `byStatus`), dibuja bandas apiladas con `div`/`rect` cuyo `style={{ width/height }}` usa el máximo como denominador; clases de relleno con tokens semánticos; estados vacío (`t("No data")`) y `error`/`isLoading` gestionados por el padre con SWR.

- [ ] **Paso 4: Verlo pasar**

Ejecutar: `pnpm --filter admin test -- src/app/(panel)/board/cumulative-flow.test.tsx`
Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/admin/src/app/(panel)/board/cumulative-flow.tsx apps/admin/src/app/(panel)/board/board-client.tsx apps/admin/src/app/(panel)/board/cumulative-flow.test.tsx
git commit -m "feat(board): add cumulative flow chart from daily snapshots"
```

---

### Tarea 9: i18n y accesibilidad

**Ficheros:**
- Modificar: componentes de `apps/admin/src/app/(panel)/board/*` (todas las cadenas vía `t(...)`; verificar)
- Modificar: `packages/i18n/catalog.en.json` (+ `locales/*.json` — los rellena el Traductor)

- [ ] **Paso 1: Fijar las claves en inglés**

`Move`, `Set milestone`, `None`, `Comment`, `Post comment`, `Add a comment…`, `Status`, `Milestone`, `Cumulative flow`, `No data`, `We couldn't update the issue.`, `We couldn't post the comment.`, `Board is not configured.`, `State conflict` (mensaje canónico de `conflict`, ya en el catálogo de errores). Toda cadena visible usa `t("…", messages)` con el inglés como clave.

- [ ] **Paso 2: Accesibilidad**

Los `<select>` y `<textarea>` llevan `label` asociado (o `aria-label`); el `StatusSelect` deshabilitado comunica el estado terminal con `aria-disabled` + texto; el error de mutación usa `role="alert"`. Sin cambios de comportamiento.

- [ ] **Paso 3: Actualizar el catálogo**

Ejecutar: `pnpm i18n:scan` y commitear el diff de `packages/i18n/catalog.en.json`.

- [ ] **Paso 4: Traducciones (agente Traductor)**

Los 8 locales no-`en` se rellenan en un PR del Traductor (español + 7 más, `docs/flows/i18n.md`): mismas claves, placeholders idénticos, inglés intacto. El PR del plan no se mergea hasta que aterrice.

- [ ] **Paso 5: Verificar**

Ejecutar: `pnpm i18n:check`
Esperado: PASS — sin claves faltantes/sobrantes, placeholders coincidentes en los 9 locales.

- [ ] **Paso 6: Commit**

```bash
git add packages/i18n/catalog.en.json apps/admin/src/app/(panel)/board/
git commit -m "feat(board): localize and make accessible the write and history UI"
```

---

### Tarea 10: tests de borde, documentación y criterios de aceptación

**Ficheros:**
- Crear: `apps/admin/src/lib/board/edge-write.test.ts`
- Modificar: `docs/flows/board.md` (sección de la fase C)

- [ ] **Paso 1: Escribir los tests de borde que fallan**

```ts
// edge-write.test.ts
it('PATCH maps GitHub 422 to validation_failed', async () => { /* updateIssue → DomainError('validation_failed') → 400 */ });
it('PATCH maps GitHub 404 to not_found', async () => { /* getIssue → mapGithubError 404 → 404 not_found */ });
it('history returns [] when there are no snapshots', async () => { /* history → [] → 200 { snapshots: [] } */ });
it('ensureDailySnapshot does not duplicate the same day (reinforces Tarea 2)', async () => { /* two calls, one row */ });
it('the write envelope never leaks the token or the issue body', async () => { /* full response text assertion */ });
```

- [ ] **Paso 2: Verlos fallar / pasar**

Ejecutar: `pnpm --filter admin test -- src/lib/board/edge-write.test.ts` y `pnpm --filter @027apps/core test -- src/board/snapshots.test.ts`
Esperado: los casos ya cubiertos pasan; los nuevos (422, 404, token-leak) fallan hasta implementar el mapeo que falta en `data.ts` (`mapGithubError` cubre 422/404).

- [ ] **Paso 3: Escribir la sección de la fase C en `docs/flows/board.md`**

En español: los tres endpoints nuevos (`PATCH …/issues/[number]`, `POST …/issues/[number]/comments`, `GET …/history`), el scope `board:write`, la reutilización de `move`/`close` (el panel no decide transiciones), el mapeo de errores (409 `conflict` con `details`, 400 `validation_failed`, 404, 429, 500), la tabla `board_snapshots` y el snapshot perezoso (sin cron), el gráfico acumulado y las puertas de setup (nada nuevo: el token ya existe de la fase B).

- [ ] **Paso 4: Verificar contra el repo**

Ejecutar: `node scripts/check-ai-docs.mjs`
Esperado: PASS — rutas y comandos citados existen.

- [ ] **Paso 5: Criterios de aceptación de la fase C (anotados en el PR)**

- Cambiar `status`/milestone y comentar desde el panel respeta la misma máquina/guard que el CLI (transición inválida → 409 con `details`).
- Los snapshots se persisten en `board_snapshots` de forma idempotente (una fila por día); `GET /history` los devuelve; sin cron ni webhooks.
- El gráfico de flujo acumulado renderiza con datos y con datos vacíos.
- El token nunca llega al cliente; el envelope de error nunca filtra token ni cuerpo.
- `pnpm lint && pnpm tsc && pnpm test && pnpm i18n:check && pnpm --filter admin build` en verde.

- [ ] **Paso 6: Commit**

```bash
git add apps/admin/src/lib/board/edge-write.test.ts docs/flows/board.md
git commit -m "test(board): cover write edges and document phase C"
```

---

## Autorrevisión

- **Cobertura de la spec:** §3.7/§13 fase C (escritura + snapshots), §7 (máquina de estados reutilizada, no reimplementada), §10 (guard: milestone abierto validado server-side), §12.1 (tabla `board_snapshots`, sin webhooks), §12.2 (token solo servidor, log sin token/cuerpo) y §14 (endpoints con auth/scope/envelope, snapshots con `QueryClient` falso) quedan cubiertos; webhooks/cron quedan fuera, como exige la spec.
- **Pasos no vagos:** cada paso nombra el código de error (`conflict`, `validation_failed`, `rate_limited`, `not_found`, `internal`), el status HTTP (200/400/404/409/429/500), y los helpers reales (`withDoor`, `move`, `close`, `statusFromLabel`, `nextStatuses`, `summarize`, `ensureDailySnapshot`, `readSnapshots`, `loadBoardConfig`, `getInfra`, `mapGithubError`, `t`).
- **Consistencia con A y B:** los tipos `BoardIssue`/`BoardStatus`/`Summary`/`BoardSnapshot` son los de A; el puerto `makeBoard` extiende el de B (mismos nombres de métodos `getSummary`/`getIssues`/`refresh`, nuevos `updateIssue`/`addComment`/`history`); los endpoints base `/api/v1/board/*` y el envelope de ADR 0007 se reutilizan; `board:write` se añade junto a `board:read` en `SUPER_ADMIN_SCOPES`.
- **Foco de revisión con test:** las 5 entradas señalan el test exacto y la tarea que lo posee (Tareas 2, 3, 6).
- **Proporción:** 10 tareas (rango 8–10); los pasos de implementación son mínimos; la máquina de estados y la agregación de core (fase A) no se duplican.
