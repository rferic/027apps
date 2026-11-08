# Plan de implementación del board, fase B (panel de solo lectura)

> **Para trabajadores agénticos:** SUB-SKILL OBLIGATORIO: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea a tarea. Los pasos usan sintaxis de casillas (`- [ ]`) para el seguimiento. Al implementar, lee la guía correspondiente en `apps/admin/node_modules/next/dist/docs/` antes de escribir código Next (este Next no es el que conoces).

**Objetivo:** Construir el panel de solo lectura `/board` (solo super admin) que muestra GitHub Issues + labels como única fuente del estado del trabajo: contadores, progreso `n/m`, antigüedad, creadas vs. cerradas por semana y una tabla de issues filtrable; detrás de `github_board.enabled` y de un token cifrado solo accesible en servidor; datos vía `/api/v1/board/*` (ADR 0005), caché de 60 s + refresco manual, sin tablas nuevas, sin escrituras desde el panel, sin snapshots.

**Arquitectura:** El panel consume su propia API igual que `(panel)/modules` (Server Component → autollamada `fetch` → Client Component con SWR, ADR 0005). Los tres endpoints `/api/v1/board/*` son route handlers finos conectados a fábricas de rutas testables (`routes.ts`), que leen el token en servidor a través de un accesor dedicado (`data.ts`: pool `service_role` + `settingsDeps.encryption.decrypt`) y llaman al `OctokitGitHubClient` de la fase A; la agregación reutiliza `summarize` del core (fase A, sin duplicar). La petición de issues a GitHub va envuelta en `unstable_cache(…, { revalidate: 60, tags: ['board'] })`; el endpoint de refresco invalida con `revalidateTag('board')`.

**Stack tecnológico:** Next 16.4.3 (`apps/admin`), `@027apps/core` (zod v4, `OctokitGitHubClient`/`summarize`/`Summary`/`BoardIssue` de la fase A), `swr` (dependencia nueva de admin: primer caso de lectura de ADR 0005), `next/cache` (`unstable_cache`, `revalidateTag`), pool `pg` service-role + `createSettingsEncryption` (descifrado del token), vitest ^5 (tests de admin con un puerto de board falso).

**Spec:** `docs/superpowers/specs/2026-11-06-board-issues-design.md` (§11 panel, §12 modelo/seguridad, §13 fase B, §14 tests) · plan base `docs/superpowers/plans/2026-11-06-board-phase-a.md` (se consume, no se redefine).

## Restricciones globales

- Node 22 (runtime y CI).
- pnpm 10.33.3 (`packageManager`).
- Next 16.4.3 (`apps/admin`); lee `apps/admin/node_modules/next/dist/docs/` antes de escribir código Next (este Next tiene cambios incompatibles).
- vitest ^5 (`pnpm --filter admin test`), zod v4 (`^4.6.7`), TypeScript estricto; sin `any`, sin `@ts-ignore`.
- Solo tokens semánticos (`bg-background`, `text-foreground`, …); sin colores hardcodeados en ningún TS/TSX (ESLint `no-restricted-syntax` lo fuerza). Las barras de los gráficos usan anchos CSS + utilidades de token, sin librería de gráficos.
- i18n: cada cadena visible vía `t(...)` con el texto en inglés como clave; `pnpm i18n:scan` confirmado, las 9 locales completas, `pnpm i18n:check` en verde.
- `guard-secrets` pasa: el token de GitHub vive solo como ajuste cifrado `github_board.token`, nunca en git/`.env*`/logs/NEXT_PUBLIC_*.
- Conventional Commits `feat(board): …` (también `ci(board)`, `docs(board)`, `test(board)`); rama `sprint/09-board-panel` (o la rama del sprint del board, si el panel se entrega en el mismo sprint).
- Dependencia nueva justificada en el plan: `swr` (`dependencies` de admin); el patrón híbrido de ADR 0005 la requiere para el primer caso de lectura en cliente.
- La fase B consume `packages/core/src/board/*` de la fase A (ya planificada): `GitHubClient`/`BoardIssue`/`OctokitGitHubClient` (github-client.ts), `Summary`/`summarize` (metrics.ts), y el export del core `./board/*.js` añadido por la Tarea 10 de la fase A. Si la fase A no está mergeada aún, este plan depende de ella.

## Foco de revisión

- **`github_board.enabled` es boolean pero `SettingType` no tiene `boolean`** — la unión del catálogo debe ganar `'boolean'` con `schema: z.boolean()`, y el seed guarda JSON `false` (no `"false"`). → test `catalog seeds github_board.* with a boolean enabled key` (sync de db-tests) en la Tarea 1.
- **Forma de `summary` cuando está deshabilitado** — la decisión #3 escribe `{ summary: Summary; enabled: boolean }`, pero un board deshabilitado no tiene summary. Decidido: `{ summary: Summary | null; enabled: boolean }`, `summary === null` si y solo si `enabled === false`. → test `summary returns enabled:false and summary:null without a token` en la Tarea 4.
- **Mapeo de fallos de GitHub** — la spec no concreta la respuesta ante 401/403/429. Decidido: GitHub 429 → `rate_limited` (429); 401/403 y cualquier otro error de GitHub/red → `internal` (500); nunca un 200 con payload parcial, nunca el token. → tests `issues returns 429 rate_limited when GitHub rate-limits` y `issues returns 500 internal when the token is invalid` en la Tarea 4.
- **Semántica de filtros** — `status` mapea a la label `status:<value>`, `module` a `module:<value>`, `milestone` a coincidencia exacta de `issue.milestone`; un `status` desconocido devuelve lista vacía (no un 400). → test `filterIssues filters by status label, module label and milestone` en la Tarea 3.
- **Ruta de lectura del token** — el token se descifra solo mediante el pool `service_role` + `settingsDeps.encryption.decrypt(value_encrypted, 'github_board.token')` (slot AAD = clave completa), nunca a través del servicio de settings (que enmascara secretos) y nunca se devuelve al cliente. → test `loadBoardConfig decrypts the token with the github_board.token slot` en la Tarea 2.

## Mapa de ficheros (antes de las tareas)

| Fichero | Crear/Modificar | Responsabilidad |
|---|---|---|
| `supabase/migrations/0014_board_settings.sql` | Crear | Seed de la categoría `github_board` + filas `github_board.enabled` / `github_board.token` (refleja el catálogo). |
| `packages/core/src/settings/catalog.ts` | Modificar | Añadir `'boolean'` a `SettingType`; añadir la categoría `github_board` y las dos entradas `SettingMeta`; añadir `CATALOG_DEFAULTS`. |
| `packages/core/src/auth/guard.ts` | Modificar | Añadir `'board:read'` a `SUPER_ADMIN_SCOPES` (capacidad solo de super admin). |
| `apps/admin/src/lib/board/data.ts` | Crear | Accesor solo servidor: `loadBoardConfig` (lee `enabled` + descifra `token`), `getBoardData` (fixtures o `OctokitGitHubClient.listIssues` cacheado), unión `BoardData`. |
| `apps/admin/src/lib/board/fixtures.json` | Crear | `BoardIssue[]` fijo para `BOARD_FIXTURES=1` (renderizar en dev/test sin GitHub). |
| `apps/admin/src/lib/board/filter.ts` | Crear | `filterIssues(issues, { status, module, milestone })` puro, filtros en servidor. |
| `apps/admin/src/lib/board/routes.ts` | Crear | Fábricas de rutas `boardSummaryRoute` / `boardIssuesRoute` / `boardRefreshRoute` (puerta + scopes + envelope). |
| `apps/admin/src/app/api/v1/board/{summary,issues,refresh}/route.ts` | Crear (3) | Handlers finos: wiring `getInfra()` → la fábrica de rutas. |
| `apps/admin/src/app/(panel)/board/page.tsx` | Crear | Server Component: `requirePanel("super_admin")`, autollamada fetch, `notFound()`/estado vacío, entrega los datos iniciales al cliente. |
| `apps/admin/src/app/(panel)/board/board-client.tsx` | Crear | Client Component (`useSWR` + fallback), botón de refresco, fila de KPIs, composición de tabla + gráficos. |
| `apps/admin/src/app/(panel)/board/{kpis,issue-table,charts}.tsx` | Crear (3) | Tarjetas de KPIs, tabla de issues filtrable, barras CSS/SVG (creadas vs. cerradas + por estado). |
| `apps/admin/src/components/panel-nav.tsx` | Modificar | Añadir el ítem de nav `Board`, renderizado solo si `role === 'super_admin'` (nueva prop `role`). |
| `apps/admin/src/lib/board/*.test.ts` | Crear | Tests unitarios: `data`, `filter`, `routes` (puerto de board falso), degradación. |
| `apps/admin/src/app/(panel)/board/page.test.tsx` | Crear | Test de render desde fixtures (estado vacío, deshabilitado, error). |
| `apps/admin/package.json` | Modificar | Añadir la dependencia `swr` (Tarea 5). |
| `packages/i18n/catalog.en.json` + `locales/*.json` | Modificar | Todas las cadenas visibles (Tarea 8). |
| `docs/flows/board.md` | Modificar | Añadir la sección §panel (Tarea 10). |

---

### Tarea 1: Catálogo `github_board.*` + migración `0014`

**Ficheros:**
- Modificar: `packages/core/src/settings/catalog.ts`
- Crear: `supabase/migrations/0014_board_settings.sql`
- Test: `packages/core/src/settings/catalog.test.ts` (añadir casos boolean)

**Interfaces:**
- Produce (catálogo): `'boolean'` añadido a la unión `SettingType`.
- Produce (catálogo): categoría `{ categoryKey: 'github_board', label: 'Board', help: 'GitHub Issues board (read-only work-state view).', icon: 'kanban', sortOrder: 60 }`.
- Produce (catálogo): `SettingMeta` para `github_board.enabled` (`type: 'boolean'`, `isSecret: false`, `isPublic: false`, `mcpAccess: 'none'`, `superAdminOnly: true`, `readOnly: false`, `schema: z.boolean()`, `sortOrder: 10`) y `github_board.token` (`type: 'string'`, `isSecret: true`, `isPublic: false`, `mcpAccess: 'none'`, `superAdminOnly: true`, `readOnly: false`, `schema: z.string().min(1).max(512)`, `sortOrder: 20`).
- Produce (catálogo): `CATALOG_DEFAULTS['github_board.enabled'] = false`, `CATALOG_DEFAULTS['github_board.token'] = null`.

- [ ] **Paso 1: Escribir los casos de test que fallan (catalog.test.ts)**

```ts
// catalog.test.ts — append
it('github_board.enabled is a boolean setting, github_board.token a super-admin secret', () => {
  const enabled = SETTINGS_CATALOG.find((s) => s.key === 'github_board.enabled');
  expect(enabled?.type).toBe('boolean');
  expect(enabled?.isSecret).toBe(false);
  expect(enabled?.superAdminOnly).toBe(true);
  expect(enabled?.schema.parse(false)).toBe(false);
  expect(enabled?.schema.parse(true)).toBe(true);

  const token = SETTINGS_CATALOG.find((s) => s.key === 'github_board.token');
  expect(token?.type).toBe('string');
  expect(token?.isSecret).toBe(true);
  expect(token?.isPublic).toBe(false);
  expect(token?.mcpAccess).toBe('none');
  expect(token?.superAdminOnly).toBe(true);
});

it('the github_board category exists with sortOrder 60', () => {
  const cat = SETTINGS_CATEGORIES.find((c) => c.categoryKey === 'github_board');
  expect(cat?.sortOrder).toBe(60);
  expect(cat?.icon).toBe('kanban');
});
```

- [ ] **Paso 2: Verlos fallar**

Ejecutar: `pnpm --filter @027apps/core test -- src/settings/catalog.test.ts`
Esperado: FAIL — `'boolean'` no es asignable a `SettingType`; faltan los dos ajustes y la categoría.

- [ ] **Paso 3: Implementar `catalog.ts`**

Añadir `'boolean'` a `SettingType`. Añadir la categoría `github_board` a `SETTINGS_CATEGORIES` y las dos entradas `SettingMeta` a `SETTINGS_CATALOG`, y los dos defaults a `CATALOG_DEFAULTS`. Sin `validateCoherence`. El schema `z.boolean()` hace round-trip por `writeSettings` (`JSON.stringify(false)` → jsonb `false`).

- [ ] **Paso 4: Escribir la migración `0014_board_settings.sql`**

`insert` de la categoría (`source: 'core'`) y de las dos filas de ajustes, reflejando exactamente los metadatos del catálogo (`github_board.enabled` con valor `'false'`, `is_secret: false`; `github_board.token` con valor `null`, `is_secret: true`). Los secretos nunca llevan un `value` en claro.

- [ ] **Paso 5: Verlos pasar**

Ejecutar: `pnpm --filter @027apps/core test -- src/settings/catalog.test.ts`
Esperado: PASS.

- [ ] **Paso 6: Verificar el sync del db-test (la migración aplicada coincide con el catálogo)**

Ejecutar: `pnpm --filter db-tests test -- src/settings/catalog.test.ts` (requiere el stack local; si no está levantado, `supabase start`).
Esperado: PASS — `db.size === SETTINGS_CATALOG.length` y las 6 categorías coinciden (el test lee el catálogo en código, así que pasa automáticamente al aplicar `0014`).

- [ ] **Paso 7: Commit**

```bash
git add packages/core/src/settings/catalog.ts packages/core/src/settings/catalog.test.ts supabase/migrations/0014_board_settings.sql
git commit -m "feat(board): add github_board settings to the catalog and migration 0014"
```

---

### Tarea 2: Lectura del token y `getBoardData` solo servidor con caché

**Ficheros:**
- Crear: `apps/admin/src/lib/board/data.ts`
- Crear: `apps/admin/src/lib/board/fixtures.json`
- Test: `apps/admin/src/lib/board/data.test.ts`

**Interfaces:**
- Consume: `@027apps/core/board/github-client.js` (`OctokitGitHubClient`, `BoardIssue`), `@027apps/core/crypto.js` (`EncryptionKeyPort`), `@027apps/core/api/rate-limit-storage.js` (`QueryClient`).
- Produce: `export type BoardData = { enabled: false } | { enabled: true; issues: BoardIssue[] }`
- Produce: `export interface BoardConfigDeps { db: QueryClient; encryption: EncryptionKeyPort | null }`
- Produce: `export async function loadBoardConfig(deps: BoardConfigDeps): Promise<{ enabled: boolean; token: string | null }>`
- Produce: `export async function getBoardData(deps: BoardConfigDeps): Promise<BoardData>`

- [ ] **Paso 1: Escribir los tests que fallan**

```ts
// data.test.ts — fake db + encryption ports
it('loadBoardConfig returns enabled=false when the flag is false', async () => {
  const cfg = await loadBoardConfig(fakeDeps({ enabled: false, encrypted: null }));
  expect(cfg).toEqual({ enabled: false, token: null });
});

it('loadBoardConfig decrypts the token with the github_board.token slot', async () => {
  const decrypt = vi.fn(async () => 'ghp_secret');
  const cfg = await loadBoardConfig({ db: fakeDb({ enabled: true, encrypted: 'v1:iv:tag:ct' }), encryption: { encrypt: async () => null, decrypt } });
  expect(cfg.token).toBe('ghp_secret');
  expect(decrypt).toHaveBeenCalledWith('v1:iv:tag:ct', 'github_board.token');
});

it('loadBoardConfig returns enabled=false when the token row is unconfigured', async () => {
  const cfg = await loadBoardConfig(fakeDeps({ enabled: true, encrypted: null }));
  expect(cfg).toEqual({ enabled: false, token: null });
});

it('getBoardData returns fixture issues when BOARD_FIXTURES=1', async () => {
  vi.stubEnv('BOARD_FIXTURES', '1');
  const data = await getBoardData(fakeDeps({ enabled: false, encrypted: null }));
  expect(data.enabled).toBe(true);
  expect((data as { issues: BoardIssue[] }).issues.length).toBeGreaterThan(0);
});
```

- [ ] **Paso 2: Verlos fallar**

Ejecutar: `pnpm --filter admin test -- src/lib/board/data.test.ts`
Esperado: FAIL — `data.ts` no existe.

- [ ] **Paso 3: Implementar `loadBoardConfig`**

Leer `value` de `github_board.enabled` y `value_encrypted` de `github_board.token` desde `public.settings` en dos consultas (puerto service-role). `enabled = (row.value === true)`. `token = value_encrypted ? await deps.encryption?.decrypt(value_encrypted, 'github_board.token') ?? null : null`. Devolver `{ enabled: enabled && token !== null, token }`. Las filas ausentes o un `null` del descifrado degradan a deshabilitado, nunca lanzan error.

- [ ] **Paso 4: Implementar `getBoardData`**

`BOARD_FIXTURES === '1'` → `{ enabled: true, issues: fixtures }` (importar desde `fixtures.json`). Si no, `loadBoardConfig`; si no está habilitado → `{ enabled: false }`. Si lo está, llamar al fetcher cacheado `listIssuesCached(token)` y devolver `{ enabled: true, issues }`. El fetcher cacheado es `unstable_cache(async (token: string) => new OctokitGitHubClient({ repo: BOARD_REPO, token }).listIssues({ state: 'all' }), ['board', 'issues'], { revalidate: 60, tags: ['board'] })` con `BOARD_REPO = process.env.GITHUB_REPO ?? 'rferic/027apps'` (URL base desde `process.env.GITHUB_API_URL` si está definida). La función cacheada solo lee su argumento `token`, nunca datos de la petición (contrato de `unstable_cache`).

- [ ] **Paso 5: Escribir `fixtures.json`**

Un array JSON de 8–10 objetos `BoardIssue` que cubran `status:backlog/in-progress/in-review/done`, `module:core/admin`, un par de milestones, y issues abiertas y cerradas con `createdAt`/`closedAt` repartidos en dos semanas — suficiente para un `summarize` no trivial y para los gráficos.

- [ ] **Paso 6: Verlos pasar**

Ejecutar: `pnpm --filter admin test -- src/lib/board/data.test.ts`
Esperado: PASS.

- [ ] **Paso 7: Commit**

```bash
git add apps/admin/src/lib/board/data.ts apps/admin/src/lib/board/fixtures.json apps/admin/src/lib/board/data.test.ts
git commit -m "feat(board): add server-only board config read and cached issue fetch"
```

---

### Tarea 3: Endpoints `summary` / `issues` / `refresh` + scope `board:read`

**Ficheros:**
- Crear: `apps/admin/src/lib/board/filter.ts`
- Crear: `apps/admin/src/lib/board/routes.ts`
- Crear: `apps/admin/src/app/api/v1/board/summary/route.ts`, `.../issues/route.ts`, `.../refresh/route.ts`
- Modificar: `packages/core/src/auth/guard.ts` (añadir `'board:read'`)
- Test: `apps/admin/src/lib/board/filter.test.ts`, `apps/admin/src/lib/board/routes.test.ts`

**Interfaces:**
- Produce (filter): `export interface BoardFilters { status?: string; module?: string; milestone?: string }`
- Produce (filter): `export function filterIssues(issues: BoardIssue[], filters: BoardFilters): BoardIssue[]`
- Produce (routes): `export interface BoardRouteDeps { door: DoorDeps; auth: (req: Request) => Promise<Caller>; board: { getSummary(): Promise<{ enabled: boolean; summary: Summary | null }>; getIssues(filters: BoardFilters): Promise<BoardIssue[]>; refresh(): void } }`
- Produce (routes): `export function boardSummaryRoute(deps): (req: Request) => Promise<Response>`
- Produce (routes): `export function boardIssuesRoute(deps): (req: Request) => Promise<Response>`
- Produce (routes): `export function boardRefreshRoute(deps): (req: Request) => Promise<Response>`

- [ ] **Paso 1: Añadir `board:read` al guard y verlo (sin test propio, lo cubre la Tarea 4)**

En `guard.ts`, añadir `'board:read'` a `SUPER_ADMIN_SCOPES` (solo super admin). Ejecutar `pnpm --filter @027apps/core test` (sin regresiones). Ningún scope de admin/user lo obtiene, así que `board:read` aplica la puerta de super admin en el door (ADR 0004 §2).

- [ ] **Paso 2: Escribir los tests de `filterIssues`**

```ts
// filter.test.ts
it('filters by status label, module label and milestone', () => {
  const issues = [
    mk(1, ['status:in-progress', 'module:core'], 'sprint-web'),
    mk(2, ['status:backlog', 'module:admin'], null),
    mk(3, ['status:in-progress', 'module:core'], null),
  ];
  expect(filterIssues(issues, { status: 'in-progress' })).toHaveLength(2);
  expect(filterIssues(issues, { module: 'admin' })).toHaveLength(1);
  expect(filterIssues(issues, { milestone: 'sprint-web' })).toHaveLength(1);
  expect(filterIssues(issues, { status: 'in-progress', module: 'core', milestone: 'sprint-web' })).toHaveLength(1);
});

it('returns an empty list for an unknown status (not an error)', () => {
  expect(filterIssues([mk(1, ['status:backlog', 'module:core'], null)], { status: 'nope' })).toHaveLength(0);
});
```

- [ ] **Paso 3: Verlos fallar**

Ejecutar: `pnpm --filter admin test -- src/lib/board/filter.test.ts`
Esperado: FAIL — `filter.ts` no existe.

- [ ] **Paso 4: Implementar `filterIssues`**

Puro: `status` → conservar si `labels.includes('status:' + status)`; `module` → `labels.includes('module:' + module)`; `milestone` → `issue.milestone === milestone`. Los filtros ausentes no hacen nada; todos los filtros presentes se combinan con AND.

- [ ] **Paso 5: Escribir los tests de `routes.test.ts` (puerto de board falso)**

```ts
// routes.test.ts — vi.mock('next/cache') for revalidateTag
const CALLER = { kind: 'session', userId: 'u1', role: 'super_admin' } as const;
function makeDeps(overrides) { /* door: noop rateLimit/logger; auth: async () => CALLER; board: fake */ }

it('summary returns { enabled, summary } and never the token', async () => {
  const res = await boardSummaryRoute(makeDeps({ getSummary: async () => ({ enabled: true, summary: SAMPLE }) }))(new Request('http://x/api/v1/board/summary'));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.summary).toEqual(SAMPLE);
  expect(JSON.stringify(body)).not.toContain('ghp_');
});

it('issues parses filters from query and returns the filtered list', async () => {
  const getIssues = vi.fn(async () => []);
  const res = await boardIssuesRoute(makeDeps({ getIssues }))(new Request('http://x/api/v1/board/issues?status=in-progress&module=core'));
  expect(res.status).toBe(200);
  expect(getIssues).toHaveBeenCalledWith({ status: 'in-progress', module: 'core' });
});

it('refresh calls revalidateTag and returns ok', async () => {
  const refresh = vi.fn();
  const res = await boardRefreshRoute(makeDeps({ refresh }))(new Request('http://x/api/v1/board/refresh', { method: 'POST' }));
  expect(res.status).toBe(200);
  expect(refresh).toHaveBeenCalled();
});
```

- [ ] **Paso 6: Verlos fallar**

Ejecutar: `pnpm --filter admin test -- src/lib/board/routes.test.ts`
Esperado: FAIL — `routes.ts` no existe.

- [ ] **Paso 7: Implementar `routes.ts` (las tres fábricas de rutas)**

Cada una usa `withDoor(req, { scopes: ['board:read'], auth, rateLimit: { identity: 'user', limit: 60 } }, door, handler)`.
- `boardSummaryRoute`: handler → `const { enabled, summary } = await board.getSummary(); return { summary, enabled };` (summary es `null` cuando está deshabilitado).
- `boardIssuesRoute`: el handler lee `ctx.searchParams` en un pequeño schema zod (`z.object({ status: z.string().min(1).max(40).optional(), module: …, milestone: … })`) — si no es válido → `DomainError('validation_failed')`; después `return { issues: await board.getIssues(filters) }`.
- `boardRefreshRoute`: handler → `board.refresh(); return { revalidated: true };` (el wiring de producción llama a `revalidateTag('board')`).

Ningún handler devuelve `token`, y ninguno de los objetos devueltos lo incluye. Los fallos de GitHub surgen como errores del door (ver Tarea 4), no aquí.

- [ ] **Paso 8: Escribir los tres route handlers**

Cada uno es el wiring fino de `getInfra()`: `const { deps, auth, settingsDeps } = await getInfra(); return boardSummaryRoute({ door: deps, auth, board: makeBoard(settingsDeps) })(req);` donde `makeBoard` se exporta desde `data.ts` (Tarea 2 + el pequeño glue de esta tarea que calcula `summary = summarize(issues, new Date())` y conecta `refresh = () => revalidateTag('board')`). Añadir init perezosa tipo `connection()` solo donde `getInfra` ya lo hace (lo hace).

- [ ] **Paso 9: Verlos pasar**

Ejecutar: `pnpm --filter admin test -- src/lib/board/routes.test.ts src/lib/board/filter.test.ts`
Esperado: PASS.

- [ ] **Paso 10: Commit**

```bash
git add packages/core/src/auth/guard.ts apps/admin/src/lib/board/filter.ts apps/admin/src/lib/board/filter.test.ts apps/admin/src/lib/board/routes.ts apps/admin/src/lib/board/routes.test.ts apps/admin/src/app/api/v1/board/
git commit -m "feat(board): add summary, issues and refresh endpoints with board:read scope"
```

---

### Tarea 4: Degradación y fixtures (sin token, token inválido, 429)

**Ficheros:**
- Modificar: `apps/admin/src/lib/board/data.ts` (normalizar errores de Octokit a `DomainError`)
- Test: `apps/admin/src/lib/board/degradation.test.ts`

**Interfaces:**
- Produce (data): `getBoardData` relanza los fallos de GitHub como `DomainError('rate_limited')` (Octokit `status === 429`) o `DomainError('internal')` (401/403/otros), para que el door emita los envelopes 429/500.

- [ ] **Paso 1: Escribir los tests que fallan**

```ts
// degradation.test.ts — fake OctokitGitHubClient via a fake board port, or BOARD_FIXTURES off
it('summary returns 200 { enabled:false, summary:null } without a token', async () => {
  const res = await boardSummaryRoute(makeDeps({ getSummary: async () => ({ enabled: false, summary: null }) }))(new Request('http://x/api/v1/board/summary'));
  expect(res.status).toBe(200);
  expect((await res.json())).toEqual({ enabled: false, summary: null });
});

it('issues returns 429 rate_limited when GitHub rate-limits', async () => {
  const deps = makeDeps({ getIssues: async () => { throw new DomainError('rate_limited'); } });
  const res = await boardIssuesRoute(deps)(new Request('http://x/api/v1/board/issues'));
  expect(res.status).toBe(429);
  expect((await res.json()).error.code).toBe('rate_limited');
});

it('issues returns 500 internal when the token is invalid (401/403)', async () => {
  const deps = makeDeps({ getIssues: async () => { throw new DomainError('internal'); } });
  const res = await boardIssuesRoute(deps)(new Request('http://x/api/v1/board/issues'));
  expect(res.status).toBe(500);
  expect((await res.json()).error.code).toBe('internal');
});

it('the error envelope never leaks the token or the Octokit status details', async () => {
  const res = await boardIssuesRoute(makeDeps({ getIssues: async () => { throw new DomainError('internal', 'github token rejected'); } }))(new Request('http://x/api/v1/board/issues'));
  const body = await res.text();
  expect(body).not.toContain('ghp_');
  expect(body).not.toContain('token rejected'); // canonical message only
});
```

- [ ] **Paso 2: Verlos fallar**

Ejecutar: `pnpm --filter admin test -- src/lib/board/degradation.test.ts`
Esperado: FAIL (o las aserciones exponen el error de Octokit sin normalizar antes del glue de la Tarea 3).

- [ ] **Paso 3: Normalizar los errores de Octokit en `data.ts`**

Envolver la llamada Octokit de `listIssuesCached` en un try/catch que relance `new DomainError('rate_limited')` si `status === 429` y `new DomainError('internal')` en otro caso (registrando el status crudo solo en servidor, nunca en el envelope). El door emite entonces el envelope 429/500 (ADR 0007). La salud de settings/panel no se ve afectada (spec §11.2).

- [ ] **Paso 4: Verlos pasar**

Ejecutar: `pnpm --filter admin test -- src/lib/board/degradation.test.ts`
Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/admin/src/lib/board/data.ts apps/admin/src/lib/board/degradation.test.ts
git commit -m "test(board): cover disabled board, invalid token and rate-limit degradation"
```

---

### Tarea 5: Página `/board` + nav + KPIs (SWR)

**Ficheros:**
- Crear: `apps/admin/src/app/(panel)/board/page.tsx`
- Crear: `apps/admin/src/app/(panel)/board/board-client.tsx`
- Crear: `apps/admin/src/app/(panel)/board/kpis.tsx`
- Modificar: `apps/admin/src/components/panel-nav.tsx`, `apps/admin/src/components/panel-nav.test.tsx`
- Modificar: `apps/admin/package.json` (añadir `swr`), `pnpm-lock.yaml`

**Interfaces:**
- Produce (page): Server Component `BoardPage` — `requirePanel("super_admin")`; autollamada `fetch` a `/api/v1/board/summary` + `/api/v1/board/issues` (cookie de sesión reenviada como Bearer por `proxy.ts`, mismo patrón que `(panel)/modules/page.tsx`).
- Produce (nav): `PanelNav({ messages, role }: { messages: TranslationMap; role?: 'super_admin' | 'admin' | 'user' })` — muestra el ítem `Board` solo si `role === 'super_admin'`; el layout pasa `gate.user.role`.

- [ ] **Paso 1: Añadir `swr` y justificarlo**

`apps/admin/package.json` → `dependencies.swr = "^2.3.x"`, `pnpm install`. Justificación: el patrón híbrido de ADR 0005 requiere una librería de fetch en cliente; este es el primer caso real de lectura, y SWR es la opción más ligera (menos conceptos, siembra con `fallback`). Ninguna otra dependencia nueva.

- [ ] **Paso 2: Añadir el ítem `Board` al nav (solo super admin)**

Añadir al grupo `Platform`: `{ label: t("Board", messages), href: "/board", superAdminOnly: true }`. Renderizar los ítems condicionalmente: `items.filter((i) => !i.superAdminOnly || role === 'super_admin')`. El layout pasa `role={gate.user.role}`.

- [ ] **Paso 3: Actualizar `panel-nav.test.tsx`**

Mantener la aserción existente de 8 enlaces (sin `role` → `Board` oculto); añadir: `it('shows Board only for super_admin', …)` aserando que `renderToStaticMarkup(<PanelNav messages={{}} role="super_admin" />)` contiene `href="/board"` y que el render sin `role` no lo contiene.

- [ ] **Paso 4: Escribir la página (Server Component)**

`export const instant = false;`. `requirePanel("super_admin")` → si `"denied" in gate` renderizar el 403 genérico (copiar el patrón de la página de modules). Resolver `locale` + `messages`. Después autollamada `fetch` para `summary` e `issues` (sin filtro para el `issues` inicial); si la respuesta de summary es `{ enabled: false }` renderizar el estado vacío (abajo). Pasar `initialSummary`, `initialIssues` y `messages` a `<BoardClient>`.

- [ ] **Paso 5: Escribir `BoardClient` + `kpis`**

`"use client"`. `useSWR('/api/v1/board/summary', fetcher, { fallbackData: initialSummary })` y `useSWR('/api/v1/board/issues' + filterQuery, fetcher, { fallbackData: initialIssues })`. El `fetcher` es un `fetch` same-origin (cookie reenviada por el proxy). Renderizar: un botón de refresco (`POST /api/v1/board/refresh` y después `mutate()` de ambas claves), la fila de KPIs (conteos `byStatus`, `progress` `n/m`, `agingDays` más antiguo), y pasar los datos a la tabla y a los gráficos. Los estados de carga/error usan `isLoading`/`error` de SWR + clases del DS. Estado vacío cuando `enabled === false`: `t("The board is not enabled.")` + pista. Estado de error (GitHub caído): `t("We couldn't load the board.")` + id de petición.

- [ ] **Paso 6: Ver el render desde fixtures**

Ejecutar: `pnpm --filter admin test -- src/app/(panel)/board/page.test.tsx` (la Tarea 9 añade el fichero completo; aquí, un smoke test mínimo de que el estado deshabilitado renderiza `The board is not enabled.` desde un `fetch` stub). Añadirlo ahora.
Esperado: PASS.

- [ ] **Paso 7: Commit**

```bash
git add apps/admin/package.json pnpm-lock.yaml apps/admin/src/components/panel-nav.tsx apps/admin/src/components/panel-nav.test.tsx apps/admin/src/app/(panel)/board/
git commit -m "feat(board): add the board page, nav entry and KPI row with SWR"
```

---

### Tarea 6: Tabla de issues con filtros

**Ficheros:**
- Crear: `apps/admin/src/app/(panel)/board/issue-table.tsx`
- Test: `apps/admin/src/app/(panel)/board/issue-table.test.tsx`

**Interfaces:**
- Produce: `IssueTable({ issues, messages, filters, onFilterChange })` — componente cliente que renderiza las filas de issues (número, título, badges `status:*`/`module:*`, milestone, antigüedad) y una fila de filtros (select de `status` + inputs de `module`/`milestone`). Cambiar un filtro vuelve a clavar el SWR de `issues` con la query string.

- [ ] **Paso 1: Escribir el test que falla**

```tsx
// issue-table.test.tsx — renderToStaticMarkup
it('renders rows with status and module badges and applies filters', () => {
  const html = renderToStaticMarkup(<IssueTable issues={SAMPLE} messages={{}} filters={{}} onFilterChange={() => {}} />);
  expect(html).toContain('Core data platform');
  expect(html).toContain('In progress');
  expect(html).toContain('core');
});

it('renders an empty row when no issues match', () => {
  expect(renderToStaticMarkup(<IssueTable issues={[]} messages={{}} filters={{}} onFilterChange={() => {}} />)).toContain('No issues');
});
```

- [ ] **Paso 2: Verlo fallar**

Ejecutar: `pnpm --filter admin test -- src/app/(panel)/board/issue-table.test.tsx`
Esperado: FAIL — `issue-table.tsx` no existe.

- [ ] **Paso 3: Implementar `IssueTable`**

Los badges usan el componente `Badge` existente con `BadgeVariant` mapeado desde el status (sin colores hardcodeados — solo `bg-surface`, `border-border`, utilidades de token). Las opciones del select de `status` salen de los valores `BoardStatus` de la fase A; `module`/`milestone` son inputs de texto libre. El padre (`BoardClient`) mantiene el estado `filters` y construye la clave SWR `/api/v1/board/issues?status=…&module=…&milestone=…` (filtrado en servidor, decisión #3).

- [ ] **Paso 4: Verlo pasar**

Ejecutar: `pnpm --filter admin test -- src/app/(panel)/board/issue-table.test.tsx`
Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/admin/src/app/(panel)/board/issue-table.tsx apps/admin/src/app/(panel)/board/issue-table.test.tsx
git commit -m "feat(board): add the filterable issue table"
```

---

### Tarea 7: Gráficos (creadas vs. cerradas y distribución por estado)

**Ficheros:**
- Crear: `apps/admin/src/app/(panel)/board/charts.tsx`
- Test: `apps/admin/src/app/(panel)/board/charts.test.tsx`

**Interfaces:**
- Produce: `WeeklyChart({ weekly }: { weekly: Summary['weekly'] })` — gráfico de barras de creadas vs. cerradas por semana ISO.
- Produce: `StatusChart({ byStatus }: { byStatus: Summary['byStatus'] })` — barras horizontales con el conteo por estado.

- [ ] **Paso 1: Escribir el test que falla**

```tsx
// charts.test.tsx
it('renders one bar per week and per status with token-based widths', () => {
  const html = renderToStaticMarkup(<WeeklyChart weekly={[{ weekStart: '2026-11-02', created: 3, closed: 1 }]} />);
  expect(html).toContain('2026-11-02');
  // width computed as a percentage style, no raw color class
  expect(html).toContain('width:');
  expect(html).not.toMatch(/bg-(gray|slate|red|green|blue)-\d/);

  const shtml = renderToStaticMarkup(<StatusChart byStatus={{ 'in-progress': 2, done: 1 } as never} />);
  expect(shtml).toContain('In progress');
  expect(shtml).toContain('Done');
});
```

- [ ] **Paso 2: Verlo fallar**

Ejecutar: `pnpm --filter admin test -- src/app/(panel)/board/charts.test.tsx`
Esperado: FAIL — `charts.tsx` no existe.

- [ ] **Paso 3: Implementar `charts.tsx`**

Componentes presentacionales puros. Las barras son `div` cuyo `style={{ width: `${pct}%` }}` usa el valor máximo como denominador; la clase de relleno es un token semántico (`bg-primary` o `bg-accent`), nunca un color crudo. Sin librería de gráficos (decisión #6). Las etiquetas de estado pasan por `t(...)` con claves en inglés (`In progress`, `Done`, …).

- [ ] **Paso 4: Verlo pasar**

Ejecutar: `pnpm --filter admin test -- src/app/(panel)/board/charts.test.tsx`
Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/admin/src/app/(panel)/board/charts.tsx apps/admin/src/app/(panel)/board/charts.test.tsx
git commit -m "feat(board): add created-vs-closed and by-status CSS charts"
```

---

### Tarea 8: i18n de todas las cadenas

**Ficheros:**
- Modificar: los componentes de `apps/admin/src/app/(panel)/board/*` (todas las cadenas ya pasan por `t(...)`; verificar)
- Modificar: `packages/i18n/catalog.en.json` (+ `locales/*.json` — los rellena el Traductor)

- [ ] **Paso 1: Inventariar y fijar las claves en inglés**

`Board`, `Summary`, `Open`, `Closed`, `Backlog`, `Approved`, `Ready`, `In progress`, `In review`, `Done`, `Discarded`, `Created`, `Closed per week`, `By status`, `Status`, `Module`, `Milestone`, `Age (days)`, `Refresh`, `The board is not enabled.`, `Enable the board in Settings to see the work state.`, `We couldn't load the board.`, `No issues`, `Issues` (apto para placeholders: `Created: {n}`, `Closed: {n}`). Cada cadena visible usa `t("…", messages)` (servidor) o `t("…", messages)` (cliente) con el texto en inglés como clave.

- [ ] **Paso 2: Actualizar el catálogo**

Ejecutar: `pnpm i18n:scan` y commitear el diff regenerado de `packages/i18n/catalog.en.json`.

- [ ] **Paso 3: Traducciones (agente Traductor)**

Las 8 locales distintas de `en` se rellenan en un PR del Traductor (español + 7 más, según `docs/flows/i18n.md`): mismas claves, `{placeholders}` idénticos, el inglés nunca se modifica. El PR de este plan no se mergea hasta que esto esté listo.

- [ ] **Paso 4: Verificar**

Ejecutar: `pnpm i18n:check`
Esperado: PASS — sin claves faltantes/sobrantes, placeholders coincidentes en las 9 locales.

- [ ] **Paso 5: Commit**

```bash
git add packages/i18n/catalog.en.json apps/admin/src/app/(panel)/board/
git commit -m "feat(board): localize all board strings across the 9 locales"
```

---

### Tarea 9: Tests de borde (repo sin issues, milestones vacíos, no-token-leak, estados de página)

**Ficheros:**
- Crear: `apps/admin/src/app/(panel)/board/page.test.tsx`
- Test: `apps/admin/src/lib/board/edge.test.ts`

- [ ] **Paso 1: Escribir los tests que fallan**

```ts
// edge.test.ts
it('summary of a repo with no issues is a zero Summary, not an error', async () => {
  // getBoardData with an empty listIssues → summarize([]) yields empty buckets
});

it('issues handles a milestone filter that matches nothing', async () => {
  expect(filterIssues(SAMPLE, { milestone: 'sprint-never' })).toHaveLength(0);
});

it('the summary payload never contains the token key or value', async () => {
  // full route response text assertion (reinforces Task 4)
});
```

```tsx
// page.test.tsx — stub fetch, render states
it('renders the disabled empty state when summary reports enabled:false', async () => { /* → "The board is not enabled." */ });
it('renders the error state when the summary fetch fails', async () => { /* → "We couldn't load the board." */ });
```

- [ ] **Paso 2: Verlos fallar**

Ejecutar: `pnpm --filter admin test -- src/lib/board/edge.test.ts src/app/(panel)/board/page.test.tsx`
Esperado: FAIL (ficheros que faltan / estados sin cubrir).

- [ ] **Paso 3: Implementar lo que falte**

Los estados vacío/error en `BoardClient` (Tarea 5) y el comportamiento de borde de resumen vacío/filtro. No se esperan cambios de lógica de producción más allá de lo definido en las Tareas 2–6; esta tarea ajusta las aserciones a las formas reales.

- [ ] **Paso 4: Verlos pasar**

Ejecutar: `pnpm --filter admin test -- src/lib/board/edge.test.ts src/app/(panel)/board/page.test.tsx`
Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/admin/src/lib/board/edge.test.ts apps/admin/src/app/(panel)/board/page.test.tsx
git commit -m "test(board): cover empty repo, empty milestone and no-token-leak edges"
```

---

### Tarea 10: Documentación y criterios de aceptación

**Ficheros:**
- Modificar: `docs/flows/board.md` (sección §panel)
- (Solo si cambia CI: `docs/flows/cicd.md` — no cambia; no se toca)

- [ ] **Paso 1: Escribir la sección del panel en `docs/flows/board.md`**

En español: ruta `/board` (super admin), los dos ajustes (`github_board.enabled`/`github_board.token` cifrado), los endpoints `/api/v1/board/*` (summary/issues/refresh), la caché de 60 s + refresco manual, la degradación (deshabilitado/sin token → estado vacío; 401/403/429 de GitHub → aviso sin romper), los fixtures (`BOARD_FIXTURES=1`) y las puertas de setup (activar el ajuste + cargar el token desde el panel).

- [ ] **Paso 2: Revisar el flujo i18n y `cicd.md`**

`i18n.md` no cambia (el panel usa la tabla `translations`, como el resto). `cicd.md` no cambia: no se añade workflow (el guard de la fase A ya existe); se documenta únicamente si hay evidencia de lo contrario.

- [ ] **Paso 3: Verificar contra el repo**

Ejecutar: `node scripts/check-ai-docs.mjs`
Esperado: PASS — las rutas y comandos citados existen.

- [ ] **Paso 4: Criterios de aceptación de la fase B (anotados en el PR)**

- `/board` renderiza contadores, progreso `n/m`, antigüedad y creadas vs. cerradas desde GitHub (o fixtures).
- Con `github_board.enabled=false` o sin token, la ruta no aparece para no super admin y muestra estado vacío para super admin; nada falla.
- El token nunca llega al cliente (auditable en bundle/network; los tests lo fijan).
- Caché de 60 s + refresco manual (`POST /api/v1/board/refresh` → `revalidateTag('board')`); sin tablas nuevas (solo las dos claves de settings).
- `pnpm lint && pnpm tsc && pnpm test && pnpm i18n:check && pnpm --filter admin build` en verde.

- [ ] **Paso 5: Commit**

```bash
git add docs/flows/board.md
git commit -m "docs(board): document the read-only board panel and phase B acceptance criteria"
```

---

## Autorrevisión

- **Cobertura de la spec:** §11.1 (ajustes + token cifrado), §11.2 (ruta de super admin, KPIs, degradación), §11.3 (ADR 0005, caché de 60 s, fixtures, i18n) y §14 (endpoints con auth/scope/envelope, fixtures, degradación) quedan cubiertos; la fase C (escritura/snapshots) y los webhooks quedan fuera, como exige la spec.
- **Pasos no vagos:** cada paso nombra el error (`rate_limited`, `internal`, `validation_failed`), el comportamiento (200/429/500, estado vacío) y el helper real (`withDoor`, `unstable_cache`, `revalidateTag`, `requirePanel`, `loadPanelMessages`, `summarize`, `Badge`, `t`).
- **Consistencia de tipos:** `Summary | null` en el endpoint `summary` coincide con el `BoardData`/`getSummary` del puerto; `BoardIssue[]` idéntico entre `getBoardData`, `filterIssues`, el endpoint `issues` y la tabla; `BoardFilters` compartido entre endpoint y cliente.
- **Foco de revisión con test:** cada una de las 5 entradas señala el test exacto y la tarea que lo posee (Tareas 1, 2, 3, 4).
- **Proporción:** 10 tareas (rango 9–12); los pasos de implementación son mínimos y de una sola cosa razonable; la agregación del core (fase A) no se duplica.
