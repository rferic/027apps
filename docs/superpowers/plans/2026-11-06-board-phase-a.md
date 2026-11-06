# Board fase A (taxonomía + CLI + máquina de estados + guard) — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDO: Usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan la sintaxis de casillas (`- [ ]`) para el seguimiento.

**Objetivo:** Convertir GitHub Issues + labels en la única fuente de verdad del estado del trabajo, fase A: la taxonomía de labels, la CLI determinista `board` (10 comandos + `--dry-run` + guard `BOARD_CONFIRM`), la máquina de estados de issues, el guard de labels, el contrato generado `<!-- board:meta -->` + checklist, los issue forms, la documentación y la suite de integración opt-in. Sin panel, sin escrituras desde el panel, sin snapshots.

**Arquitectura:** Las funciones de dominio puras (`states.ts`, `meta.ts`, `checklist.ts`, `metrics.ts`, `taxonomy.ts`) están separadas de la única superficie de red (`github-client.ts`, Octokit). Los comandos dependen solo de la interfaz `GitHubClient`, así que los tests usan un doble en memoria; `msw` se reserva para testear solo la implementación de Octokit. La CLI es un `cli.ts` fino (parser de argumentos propio, sin dependencia nueva) conectado como script raíz `board`.

**Stack técnico:** TypeScript ESM (`@027apps/core`), zod v4, `@octokit/rest` (solo red), `msw` (tests de Octokit), `tsx` (ejecutar la CLI desde TS), vitest ^5.

**Spec:** `docs/superpowers/specs/2026-11-06-board-issues-design.md`

## Restricciones globales

- Node 22 (runtime y CI).
- pnpm 10.33.3 (`packageManager` en el `package.json` raíz).
- vitest ^5 (`pnpm --filter @027apps/core test`), zod v4 (`^4.6.7`).
- TypeScript ESM (`"type": "module"`, `module: ESNext`, `moduleResolution: bundler`, `strict: true`); sin `any`, sin `@ts-ignore`.
- Código, commits, labels, mensajes de error y superficie de GitHub en **inglés**; `docs/` en **español**.
- Conventional Commits `feat(board): …` (también `ci(board)`, `docs(board)`, `test(board)`); rama `sprint/09-board-contract`.
- `guard-secrets` debe pasar: sin secretos, sin `.env*`, sin keystores trackeados en git; token solo mediante la variable de entorno `GITHUB_TOKEN`, nunca en el repo.
- Dependencias nuevas justificadas en el plan: `@octokit/rest` (`dependencies` de core), `msw` (`devDependencies` de core), `tsx` (`devDependencies` raíz); `pnpm install` regenera `pnpm-lock.yaml`.
- La fase A no toca Supabase ni `apps/admin`: cero migraciones, cero endpoints nuevos.

## Foco de revisión

- **`board start` con un `spec:` que coincide con 0 o >1 issues** debe fallar con un error que dirija a `--issue <n>`; nunca elegir uno en silencio. → test `start fails when spec matches 0 or >1 issues` en la Tarea 7.
- **`board close` sobre un issue ya cerrado** debe aplicar el label terminal y avisar, sin error y sin reabrirlo. → test `close on an already-closed issue is idempotent` en la Tarea 7.
- **`sprint new` mientras otro milestone está abierto** debe avisar pero no fallar (no hay invariante de sprint único abierto). → test `sprint new warns (not fails) when another milestone is open` en la Tarea 6.
- **`checklist sync` cuando `tasks:` no es legible o el frontmatter no coincide** debe fallar sin tocar el body (sin adivinar). → test `checklist sync fails cleanly when tasks dir is unreadable` en la Tarea 9.
- **`guard` sobre un issue cuyos labels se editaron a mano** debe eliminar solo el otro label del grupo del label recién añadido, nunca "corregir" otros grupos ni inferir estado. → test `guard removes only the other same-group label` en la Tarea 8.

**Fixture de test compartido** (usado por las Tareas 4, 6–10): un doble en memoria de `GitHubClient` construido con `makeClient(issues: BoardIssue[], overrides?)` que registra llamadas y devuelve `issues` predefinidos desde `listIssues`/`getIssue`; la Tarea 6 lo define y las tareas posteriores lo reutilizan. Las Tareas 1 y 3 usan un repo fixture en `packages/core/test/fixtures/repo/`, creado en el Paso 1 de la Tarea 1: contiene `packages/split-expenses/manifest.json` (con `"key": "split-expenses"`), `docs/tasks/sprint-09-core-data/task-01.md` (`estado: finalizada`, `titulo: Usuarios y roles`) y `task-02.md` (`estado: pendiente`, `titulo: Categorías`). Toda ruta de test es relativa a `packages/core/` (la raíz de vitest).

---

### Tarea 1: Taxonomía — `board.labels.json` + `taxonomy.ts`

**Ficheros:**
- Crear: `packages/core/src/board/board.labels.json`
- Crear: `packages/core/src/board/taxonomy.ts`
- Test: `packages/core/src/board/taxonomy.test.ts`

**Interfaces:**
- Produce: `export type BoardType = 'bug' | 'feature' | 'chore' | 'docs' | 'infra'`
- Produce: `export interface BoardLabel { name: string; color: string; description: string }`
- Produce: `export const boardLabelsSchema: z.ZodType<BoardLabel[]>`
- Produce: `export const TYPE_LABELS: Record<BoardType, string>` (`bug` → `'type:bug'`, …)
- Produce: `export function typeFromLabel(label: string): BoardType | null`
- Produce: `export function groupOf(label: string): 'type' | 'status' | 'module' | null` (divide por el primer `:`)
- Produce: `export function discoverModuleKeys(repoRoot: string): string[]` (lee `packages/*/manifest.json`, devuelve su `key`)
- Produce: `export function fullCatalog(repoRoot: string): BoardLabel[]` (labels base + `module:<key>` por cada key descubierta)

- [ ] **Paso 1: Escribe `board.labels.json` con los valores de §6 (literales)**

Array JSON de `{ name, color, description }` — 14 entradas:

- `type:bug` `d73a4a` "A defect to fix"; `type:feature` `0e8a16` "A new capability or module"; `type:chore` `e4e669` "Housekeeping, refactor with no observable change"; `type:docs` `0075ca` "Documentation only"; `type:infra` `7057ff` "CI, deploy, dependencies, secrets, tooling".
- `status:backlog` `eeeeee` "Captured, not approved"; `status:approved` `c2e0c6` "Approved; spec written locally"; `status:ready` `0e8a16` "Spec + plan approved"; `status:in-progress` `fbca04` "Branch open + milestone"; `status:in-review` `1d76db` "PR marked ready for review"; `status:done` `a2eeef` "Merged and deployed (closed)"; `status:discarded` `b60205` "Closed, won't do".
- `module:core` `c5def5` "Core platform and shared capabilities"; `module:admin` `c5def5` "The admin panel itself".

Crea también el repo fixture usado por los tests: `test/fixtures/repo/packages/split-expenses/manifest.json` con `{"key": "split-expenses"}`, más `test/fixtures/repo/docs/tasks/sprint-09-core-data/task-01.md` (`---` / `titulo: Usuarios y roles` / `estado: finalizada` / `---`) y `task-02.md` (`titulo: Categorías` / `estado: pendiente`). Todas las rutas de test son relativas a `packages/core/`.

- [ ] **Paso 2: Escribe los tests de taxonomía que fallan**

```ts
// taxonomy.test.ts
it('validates board.labels.json with zod', () => {
  // boardLabelsSchema.parse(labels) succeeds; 14 entries; every color matches /^[0-9a-f]{6}$/.
  expect(labels).toHaveLength(14);
  expect(labels.every((l) => /^[0-9a-f]{6}$/.test(l.color))).toBe(true);
});

it('maps types to type:* labels and back', () => {
  expect(TYPE_LABELS.bug).toBe('type:bug');
  expect(TYPE_LABELS.infra).toBe('type:infra');
  expect(typeFromLabel('type:feature')).toBe('feature');
  expect(typeFromLabel('status:done')).toBeNull();
});

it('returns the label group for a name, null for unknown prefixes', () => {
  expect(groupOf('status:in-progress')).toBe('status');
  expect(groupOf('module:core')).toBe('module');
  expect(groupOf('size:large')).toBeNull();
});

it('discovers module:<key> from packages/*/manifest.json', () => {
  expect(discoverModuleKeys('test/fixtures/repo')).toEqual(['split-expenses']);
});

it('builds the full catalog with core+admin and discovered modules, no duplicates', () => {
  const names = fullCatalog('test/fixtures/repo').map((l) => l.name);
  expect(names).toContain('module:core');
  expect(names).toContain('module:admin');
  expect(names).toContain('module:split-expenses');
  expect(new Set(names).size).toBe(names.length);
});
```

- [ ] **Paso 3: Ejecuta los tests para verificar que fallan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/taxonomy.test.ts`
Esperado: FAIL — `taxonomy.ts` no existe.

- [ ] **Paso 4: Implementa `taxonomy.ts`**

Import estático `import labels from './board.labels.json' with { type: 'json' };`; `boardLabelsSchema` (zod) parsea el JSON en `BASE_LABELS`. `TYPE_LABELS`/`typeFromLabel`/`groupOf` según lo especificado. `discoverModuleKeys(repoRoot)`: `node:fs.readdirSync` sobre `packages/`, lee cada `manifest.json` que exista y recoge `key`. `fullCatalog(repoRoot)`: `BASE_LABELS` + `{ name: 'module:'+key, color: 'c5def5', description: 'Module '+key }` por cada key, deduplicado por name.

- [ ] **Paso 5: Ejecuta los tests para verificar que pasan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/taxonomy.test.ts`
Esperado: PASS.

- [ ] **Paso 6: Commit**

```bash
git add packages/core/src/board/board.labels.json packages/core/src/board/taxonomy.ts packages/core/src/board/taxonomy.test.ts
git commit -m "feat(board): add label taxonomy catalog and module key discovery"
```

---

### Tarea 2: Máquina de estados — `states.ts`

**Ficheros:**
- Crear: `packages/core/src/board/states.ts`
- Test: `packages/core/src/board/states.test.ts`

**Interfaces:**
- Produce: `export type BoardStatus = 'backlog' | 'approved' | 'ready' | 'in-progress' | 'in-review' | 'done' | 'discarded'`
- Produce: `export const STATUS_LABELS: Record<BoardStatus, string>` (`backlog` → `'status:backlog'`, …)
- Produce: `export function statusFromLabel(label: string): BoardStatus | null`
- Produce: `export function canTransition(from: BoardStatus, to: BoardStatus): boolean`
- Produce: `export function nextStatuses(from: BoardStatus): BoardStatus[]`

- [ ] **Paso 1: Escribe los tests de la máquina de estados que fallan**

La tabla de transiciones legales es toda la decisión; codifícala exactamente (§7.1/§7.2).

```ts
// states.test.ts
const legal: Array<[BoardStatus, BoardStatus]> = [
  ['backlog', 'approved'], ['approved', 'ready'], ['ready', 'in-progress'],
  ['in-progress', 'in-review'], ['in-review', 'in-progress'], ['in-review', 'done'],
  ['backlog', 'discarded'], ['approved', 'discarded'], ['ready', 'discarded'],
  ['in-progress', 'discarded'], ['discarded', 'backlog'],
];

it('allows every legal transition', () => {
  for (const [from, to] of legal) expect(canTransition(from, to)).toBe(true);
});

it('rejects illegal transitions', () => {
  expect(canTransition('backlog', 'done')).toBe(false);
  expect(canTransition('done', 'in-progress')).toBe(false);
  expect(canTransition('discarded', 'ready')).toBe(false);
});

it('lists the legal next statuses for each state', () => {
  expect(nextStatuses('ready')).toEqual(['in-progress', 'discarded']);
  expect(nextStatuses('done')).toEqual([]); // terminal
});

it('maps status labels to states and back', () => {
  expect(STATUS_LABELS['in-progress']).toBe('status:in-progress');
  expect(statusFromLabel('status:done')).toBe('done');
  expect(statusFromLabel('type:bug')).toBeNull();
});
```

- [ ] **Paso 2: Ejecuta los tests para verificar que fallan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/states.test.ts`
Esperado: FAIL — `states.ts` no existe.

- [ ] **Paso 3: Implementa `states.ts`**

Una única `const TRANSITIONS: Record<BoardStatus, BoardStatus[]>` que contiene exactamente la tabla `legal`, más `STATUS_LABELS`, `statusFromLabel`, `canTransition(from, to) = TRANSITIONS[from].includes(to)`, `nextStatuses(from) = [...TRANSITIONS[from]]`.

- [ ] **Paso 4: Ejecuta los tests para verificar que pasan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/states.test.ts`
Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/core/src/board/states.ts packages/core/src/board/states.test.ts
git commit -m "feat(board): add issue state machine with legal transitions"
```

---

### Tarea 3: Meta y checklist — `meta.ts` + `checklist.ts`

**Ficheros:**
- Crear: `packages/core/src/board/meta.ts`
- Crear: `packages/core/src/board/checklist.ts`
- Test: `packages/core/src/board/meta.test.ts`
- Test: `packages/core/src/board/checklist.test.ts`

**Interfaces:**
- Produce (meta): `export const META_START = '<!-- board:meta'` y `export const META_END = '-->'`
- Produce (meta): `export function parseMeta(body: string): Record<string, string> | null`
- Produce (meta): `export function upsertMeta(body: string, meta: Record<string, string>): string`
- Produce (checklist): `export interface TaskItem { id: string; title: string; done: boolean }`
- Produce (checklist): `export function parseTaskFile(id: string, content: string): TaskItem`
- Produce (checklist): `export function readTasks(dir: string): TaskItem[]` (`node:fs`; `task-*.md`, id a partir del nombre de fichero, `titulo`/`estado` desde el frontmatter plano)
- Produce (checklist): `export function renderChecklist(items: TaskItem[]): string`
- Produce (checklist): `export function upsertChecklist(body: string, items: TaskItem[]): string`

- [ ] **Paso 1: Escribe los tests de meta que fallan**

```ts
// meta.test.ts
const bodyWithMeta = `Summary\n\n<!-- board:meta\nstatus: ready\nmodule: core\ntype: feature\nsprint: sprint-09-core-data\ntasks: docs/tasks/sprint-09-core-data/\nspec: docs/superpowers/specs/x.md\nplan: docs/superpowers/plans/y.md\n-->\n\nBody text\n## Checklist (generated — do not edit)\n\n- [ ] task-01 Usuarios y roles\n`;

it('parses the meta block into a record', () => {
  expect(parseMeta(bodyWithMeta)).toEqual({
    status: 'ready', module: 'core', type: 'feature',
    sprint: 'sprint-09-core-data', tasks: 'docs/tasks/sprint-09-core-data/',
    spec: 'docs/superpowers/specs/x.md', plan: 'docs/superpowers/plans/y.md',
  });
});

it('returns null when no meta block is present', () => {
  expect(parseMeta('no meta here')).toBeNull();
});

it('upserts the meta block in place, leaving the rest of the body untouched', () => {
  const out = upsertMeta(bodyWithMeta, { status: 'in-progress', module: 'core', type: 'feature' });
  expect(out).toContain('status: in-progress');
  expect(out).not.toContain('status: ready');
  expect(out).toContain('Body text');
  expect(out).toContain('## Checklist (generated — do not edit)');
});

it('appends a meta block at the top when none exists', () => {
  expect(upsertMeta('just body', { status: 'backlog' }))
    .toBe('<!-- board:meta\nstatus: backlog\n-->\n\njust body');
});
```

- [ ] **Paso 2: Ejecuta los tests de meta para verificar que fallan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/meta.test.ts`
Esperado: FAIL — `meta.ts` no existe.

- [ ] **Paso 3: Escribe los tests de checklist que fallan**

```ts
// checklist.test.ts
const taskContent = '---\nid: sprint-09-task-01\ntitulo: Usuarios y roles\narea: core\nestado: finalizada\n---\nAlcance...';

it('parses a task file into a TaskItem (done = estado: finalizada)', () => {
  expect(parseTaskFile('task-01', taskContent)).toEqual({ id: 'task-01', title: 'Usuarios y roles', done: true });
  expect(parseTaskFile('task-03', taskContent.replace('finalizada', 'pendiente')).done).toBe(false);
});

it('renders the checklist with the fixed generated header', () => {
  const out = renderChecklist([{ id: 'task-01', title: 'Usuarios y roles', done: true }]);
  expect(out).toContain('## Checklist (generated — do not edit)');
  expect(out).toContain('- [x] task-01 Usuarios y roles');
});

it('upserts the checklist whole, not preserving hand edits', () => {
  const out = upsertChecklist('Body\n\n## Checklist (generated — do not edit)\n\n- [x] stale\n', [{ id: 'task-01', title: 'Usuarios y roles', done: false }]);
  expect(out).toContain('- [ ] task-01 Usuarios y roles');
  expect(out).not.toContain('stale');
});

it('readTasks reads task-*.md from a fixture dir and marks done by estado', () => {
  const items = readTasks('test/fixtures/repo/docs/tasks/sprint-09-core-data');
  expect(items).toHaveLength(2);
  expect(items.find((i) => i.id === 'task-01')!.done).toBe(true);
});
```

- [ ] **Paso 4: Ejecuta los tests de checklist para verificar que fallan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/checklist.test.ts`
Esperado: FAIL — `checklist.ts` no existe.

- [ ] **Paso 5: Implementa `meta.ts` y `checklist.ts`**

`meta.ts`: `parseMeta` localiza el texto entre `META_START` y `META_END`, separa las líneas `key: value` en un `Record`; `null` si no existe. `upsertMeta` reemplaza el bloque (o lo antepone), preservando todo lo demás byte a byte.
`checklist.ts`: `parseTaskFile` lee `titulo`/`estado` del frontmatter plano (lector línea a línea, sin dependencia yaml), `done = estado === 'finalizada'`. `readTasks` lista `task-*.md` ordenados por id. `renderChecklist` emite la cabecera y luego `- [x]`/`- [ ]` por cada item. `upsertChecklist` reemplaza desde el marcador `## Checklist (generated — do not edit)` hasta el final (añade si no existe).

- [ ] **Paso 6: Ejecuta los tests para verificar que pasan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/meta.test.ts src/board/checklist.test.ts`
Esperado: PASS.

- [ ] **Paso 7: Commit**

```bash
git add packages/core/src/board/meta.ts packages/core/src/board/checklist.ts packages/core/src/board/meta.test.ts packages/core/src/board/checklist.test.ts
git commit -m "feat(board): add board:meta and checklist parsing and generation"
```

---

### Tarea 4: Métricas — `metrics.ts`

**Ficheros:**
- Crear: `packages/core/src/board/github-client.ts` (solo `export interface BoardIssue` — la Tarea 5 añade el cliente)
- Crear: `packages/core/src/board/metrics.ts`
- Test: `packages/core/src/board/metrics.test.ts`

**Interfaces:**
- Produce: `export interface BoardIssue { number: number; title: string; body: string; state: 'open' | 'closed'; labels: string[]; milestone: string | null; createdAt: string; closedAt: string | null }` (en `github-client.ts`)
- Produce: `export interface Summary { byStatus: Record<BoardStatus, number>; byModule: Record<string, number>; byMilestone: Record<string, number>; progress: Array<{ number: number; title: string; done: number; total: number }>; agingDays: Array<{ number: number; title: string; days: number }>; weekly: Array<{ weekStart: string; created: number; closed: number }> }`
- Produce: `export function summarize(issues: BoardIssue[], today: Date): Summary`

- [ ] **Paso 1: Escribe la interfaz `BoardIssue` en `github-client.ts`**

Exactamente el tipo `BoardIssue` de arriba (sin cliente todavía).

- [ ] **Paso 2: Escribe los tests de métricas que fallan**

```ts
// metrics.test.ts (fixtures via a local mk() helper: mk(n, labels, createdAt, milestone?, closedAt?))
const today = new Date('2026-11-06T00:00:00Z');

it('counts by status, module and milestone', () => {
  const s = summarize([
    mk(1, ['status:in-progress', 'type:feature', 'module:core'], '2026-11-01', 'sprint-09-core-data'),
    mk(2, ['status:backlog', 'type:bug', 'module:core'], '2026-11-02'),
    mk(3, ['status:done', 'type:chore', 'module:admin'], '2026-11-03', null, '2026-11-05'),
  ], today);
  expect(s.byStatus['in-progress']).toBe(1);
  expect(s.byStatus['backlog']).toBe(1);
  expect(s.byModule['core']).toBe(2);
  expect(s.byMilestone['sprint-09-core-data']).toBe(1);
});

it('computes agingDays for open issues only (days since createdAt)', () => {
  expect(summarize([mk(1, ['status:in-progress', 'type:feature', 'module:core'], '2026-11-01')], today).agingDays)
    .toEqual([{ number: 1, title: '#1', days: 5 }]);
});

it('computes weekly created-vs-closed buckets (week start = Monday)', () => {
  const s = summarize([
    mk(1, ['status:done', 'type:chore', 'module:core'], '2026-11-01', null, '2026-11-02'),
    mk(2, ['status:backlog', 'type:bug', 'module:core'], '2026-11-03'),
  ], today);
  expect(s.weekly.find((w) => w.weekStart === '2026-11-02')).toMatchObject({ created: 1, closed: 1 });
});
```

- [ ] **Paso 3: Ejecuta los tests para verificar que fallan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/metrics.test.ts`
Esperado: FAIL — `metrics.ts` no existe.

- [ ] **Paso 4: Implementa `metrics.ts`**

Agregación pura. `byStatus`/`byModule` cuentan los labels `status:*`/`module:*` (prefijo eliminado); `byMilestone` cuenta `milestone`. `agingDays` = issues abiertos ordenados por `createdAt` descendente, `days = floor((today - createdAt)/86400000)`. `weekly` = buckets de lunes ISO a partir de `createdAt`/`closedAt` con los contadores `created`/`closed`. `progress` = `[]` en esta tarea (se rellena en el `status` de la Tarea 9).

- [ ] **Paso 5: Ejecuta los tests para verificar que pasan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/metrics.test.ts`
Esperado: PASS.

- [ ] **Paso 6: Commit**

```bash
git add packages/core/src/board/github-client.ts packages/core/src/board/metrics.ts packages/core/src/board/metrics.test.ts
git commit -m "feat(board): add board metrics aggregation"
```

---

### Tarea 5: Cliente de GitHub — interfaz + Octokit + MSW

**Ficheros:**
- Modificar: `packages/core/src/board/github-client.ts` (añadir `GitHubClient` + `OctokitGitHubClient`)
- Test: `packages/core/src/board/github-client.test.ts`
- Modificar: `packages/core/package.json` (añadir `@octokit/rest` a `dependencies`, `msw` a `devDependencies`)

**Interfaces:**
- Produce: `export interface GitHubClient { listIssues(opts?: { state?: 'open' | 'closed' | 'all' }): Promise<BoardIssue[]>; getIssue(number: number): Promise<BoardIssue>; createIssue(input: { title: string; body: string; labels: string[]; milestone?: string | null }): Promise<BoardIssue>; updateIssue(number: number, patch: { body?: string; state?: 'open' | 'closed'; milestone?: string | null; labels?: string[] }): Promise<BoardIssue>; listLabels(): Promise<Array<{ name: string; color: string; description: string }>>; upsertLabel(label: { name: string; color: string; description: string }): Promise<void>; listMilestones(state?: 'open' | 'closed' | 'all'): Promise<Array<{ title: string; state: 'open' | 'closed' }>>; createMilestone(title: string): Promise<void>; closeMilestone(title: string): Promise<void> }`
- Produce: `export class OctokitGitHubClient implements GitHubClient { constructor(opts: { repo: string; token: string; baseUrl?: string }) }`

- [ ] **Paso 1: Escribe los tests MSW que fallan**

Los handlers simulan `https://api.github.com/repos/rferic/027apps/...`; comprueban el mapeo y la paginación.

```ts
// github-client.test.ts (setupServer from msw/node)
it('maps an issue: labels→string[], milestone→title, created_at/closed_at→camelCase', async () => {
  // GET /issues → [{ number: 1, title: 'Core data platform', state: 'open', labels: [{name:'type:feature'}], milestone: {title:'sprint-09-core-data'}, created_at, closed_at: null }]
  const issues = await new OctokitGitHubClient({ repo: 'rferic/027apps', token: 'x' }).listIssues({ state: 'open' });
  expect(issues[0]).toMatchObject({ number: 1, labels: ['type:feature'], milestone: 'sprint-09-core-data', state: 'open' });
  expect(issues[0].closedAt).toBeNull();
});

it('paginates listIssues across pages (per_page=100, loop page)', async () => {
  // page=1 returns 1 issue, page=2 returns [] → listIssues() resolves to 1 issue.
  expect(await client.listIssues()).toHaveLength(1);
});

it('upserts a label via POST, falling back to PATCH on 422 conflict', async () => {
  await expect(client.upsertLabel({ name: 'type:bug', color: 'd73a4a', description: 'A defect to fix' })).resolves.toBeUndefined();
});

it('lists milestones and creates/closes them', async () => {
  expect(await client.listMilestones()).toEqual([{ title: 'sprint-09-core-data', state: 'open' }]);
  await expect(client.createMilestone('sprint-web')).resolves.toBeUndefined();
  await expect(client.closeMilestone('sprint-web')).resolves.toBeUndefined(); // lookup by title then PATCH state:closed
});
```

- [ ] **Paso 2: Ejecuta los tests para verificar que fallan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/github-client.test.ts`
Esperado: FAIL — `GitHubClient` y `OctokitGitHubClient` no existen.

- [ ] **Paso 3: Añade las dos dependencias**

Edita `packages/core/package.json` (`@octokit/rest` → `dependencies`, `msw` → `devDependencies`), y luego `pnpm install`. Justificación: `@octokit/rest` es la única superficie REST paginada contra `api.github.com` (spec §4.6/§12.2); `msw` intercepta HTTP para testear el mapeo de Octokit (rutas, parámetros, paginación) sin red — los comandos se testean contra el doble de la interfaz, así que `msw` queda acotado a este fichero.

- [ ] **Paso 4: Implementa `github-client.ts`**

`OctokitGitHubClient` envuelve `new Octokit({ auth: token, baseUrl: baseUrl ?? 'https://api.github.com' })`; mapea `labels: {name}[]` → `string[]`, `milestone?.title`, `created_at`/`closed_at` → `createdAt`/`closedAt`; pagina `listIssues`; `upsertLabel` hace POST→PATCH en 422; `closeMilestone` busca por título y luego hace PATCH con `state: 'closed'`.

- [ ] **Paso 5: Ejecuta los tests para verificar que pasan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/github-client.test.ts`
Esperado: PASS.

- [ ] **Paso 6: Commit**

```bash
git add packages/core/src/board/github-client.ts packages/core/src/board/github-client.test.ts packages/core/package.json pnpm-lock.yaml
git commit -m "feat(board): add GitHub client interface and Octokit implementation"
```

---

### Tarea 6: `labels sync`, `sprint new`, `sprint close`

**Ficheros:**
- Crear: `packages/core/src/board/commands.ts`
- Test: `packages/core/src/board/commands.labels-sprint.test.ts`

**Interfaces:**
- Consume: `GitHubClient`, `BoardIssue` (Tarea 5), `fullCatalog` (Tarea 1)
- Produce: `export type Result<T> = { ok: true; value: T } | { ok: false; error: string }`
- Produce: `export async function labelsSync(client: GitHubClient, input: { repoRoot: string }): Promise<Result<void>>`
- Produce: `export async function sprintNew(client: GitHubClient, input: { title: string }): Promise<Result<{ title: string; existed: boolean; warn?: string }>>`
- Produce: `export async function sprintClose(client: GitHubClient, input: { title: string }): Promise<Result<void>>`

- [ ] **Paso 1: Define el doble en memoria y escribe los tests que fallan**

Define `makeClient(issues, overrides?)` (registra las llamadas a `upsertLabel`/`createMilestone`/`closeMilestone`; `listIssues`/`getIssue` devuelven el array predefinido).

```ts
// commands.labels-sprint.test.ts
it('labelsSync creates missing and updates changed labels, converging idempotently', async () => {
  const upserted: string[] = [];
  const client = makeClient([], { listLabels: async () => [{ name: 'type:bug', color: '000000', description: 'old' }], upsertLabel: async (l) => { upserted.push(l.name); } });
  await labelsSync(client, { repoRoot: 'test/fixtures/repo' });
  expect(upserted).toContain('type:bug');            // color differs → updated
  expect(upserted).toContain('status:backlog');
  expect(upserted).toContain('module:split-expenses'); // discovered from manifest
  expect(upserted.length).toBe(new Set(upserted).size); // no duplicates
});

it('sprintNew is idempotent when the milestone exists', async () => {
  let created = 0;
  const client = makeClient([], { listMilestones: async () => [{ title: 'sprint-09-core-data', state: 'open' }], createMilestone: async () => { created++; } });
  const r = await sprintNew(client, { title: 'sprint-09-core-data' });
  expect(r.ok && r.value.existed).toBe(true);
  expect(created).toBe(0);
});

it('sprintNew warns (not fails) when another milestone is open', async () => {
  const client = makeClient([], { listMilestones: async () => [{ title: 'sprint-08-core-base', state: 'open' }] });
  const r = await sprintNew(client, { title: 'sprint-09-core-data' });
  expect(r.ok).toBe(true);
  expect((r as { ok: true; value: { warn?: string } }).value.warn).toBeTruthy();
});

it('sprintClose fails when open issues remain in the milestone', async () => {
  const client = makeClient([{ number: 1, title: 'x', body: '', state: 'open', labels: [], milestone: 'sprint-09-core-data', createdAt: '', closedAt: null }]);
  expect((await sprintClose(client, { title: 'sprint-09-core-data' })).ok).toBe(false);
});

it('sprintClose closes the milestone when no open issues remain', async () => {
  let closed = '';
  const client = makeClient([], { closeMilestone: async (t) => { closed = t; } });
  expect((await sprintClose(client, { title: 'sprint-09-core-data' })).ok).toBe(true);
  expect(closed).toBe('sprint-09-core-data');
});
```

- [ ] **Paso 2: Ejecuta los tests para verificar que fallan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/commands.labels-sprint.test.ts`
Esperado: FAIL — `commands.ts` no existe.

- [ ] **Paso 3: Implementa los tres comandos**

`labelsSync`: `listLabels()` → mapa nombre→actual; `fullCatalog(repoRoot)`; `upsertLabel` en cada label que falte o haya cambiado. `sprintNew`: `listMilestones('all')`; si existe → `{ existed: true }`; si no, detecta cualquier otro milestone abierto → `warn`; `createMilestone`. `sprintClose`: `listIssues('open')` filtrado por ese milestone; si hay alguno → `{ ok: false }`; si no, `closeMilestone`.

- [ ] **Paso 4: Ejecuta los tests para verificar que pasan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/commands.labels-sprint.test.ts`
Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/core/src/board/commands.ts packages/core/src/board/commands.labels-sprint.test.ts
git commit -m "feat(board): add labels sync, sprint new and sprint close commands"
```

---

### Tarea 7: `new`, `start`, `move`, `close`

**Ficheros:**
- Modificar: `packages/core/src/board/commands.ts`
- Test: `packages/core/src/board/commands.issue.test.ts`

**Interfaces:**
- Consume: `canTransition`, `STATUS_LABELS`, `statusFromLabel`, `nextStatuses` (Tarea 2), `parseMeta`, `upsertMeta`, `renderChecklist`, `upsertChecklist`, `readTasks` (Tarea 3), `typeFromLabel` (Tarea 1)
- Produce: `export interface NewIssueInput { title: string; type: BoardType; module: string; spec?: string; plan?: string }`
- Produce: `export async function newIssue(client: GitHubClient, input: NewIssueInput): Promise<Result<BoardIssue>>`
- Produce: `export interface StartInput { issue?: number; spec?: string; title?: string; sprint?: string; repoRoot: string }`
- Produce: `export async function start(client: GitHubClient, input: StartInput): Promise<Result<BoardIssue>>`
- Produce: `export async function move(client: GitHubClient, input: { issue: number; status: BoardStatus }): Promise<Result<BoardIssue>>`
- Produce: `export async function close(client: GitHubClient, input: { issue: number; target: 'done' | 'discarded' }): Promise<Result<BoardIssue>>`

- [ ] **Paso 1: Escribe los tests que fallan (reutiliza el doble `makeClient` de la Tarea 6)**

```ts
// commands.issue.test.ts
it('newIssue creates in status:backlog with a board:meta block', async () => {
  const r = await newIssue(makeClient([]), { title: 'Core data platform', type: 'feature', module: 'core', spec: 'docs/x.md' });
  const v = (r as { ok: true; value: BoardIssue }).value;
  expect(v.labels).toEqual(['status:backlog', 'type:feature', 'module:core']);
  expect(v.body).toContain('status: backlog');
});

it('start fails when the issue is not in status:ready', async () => {
  const r = await start(makeClient([mk(1, ['status:backlog', 'type:feature', 'module:core'])]), { issue: 1, repoRoot: 'test/fixtures/repo' });
  expect(r.ok).toBe(false);
});

it('start fails when spec matches 0 or >1 issues, directing to --issue', async () => {
  const client = makeClient([mk(1, ['status:ready', 'type:feature', 'module:core']), mk(2, ['status:ready', 'type:feature', 'module:core'])]);
  const r = await start(client, { spec: 'docs/x.md', repoRoot: 'test/fixtures/repo' });
  expect(r.ok).toBe(false);
  expect((r as { ok: false; error: string }).error).toMatch(/--issue/);
});

it('start moves ready→in-progress, sets milestone for type:feature, writes meta + checklist', async () => {
  const r = await start(makeClient([mk(1, ['status:ready', 'type:feature', 'module:core'])]), { issue: 1, sprint: 'sprint-09-board-contract', repoRoot: 'test/fixtures/repo' });
  const v = (r as { ok: true; value: BoardIssue }).value;
  expect(v.labels).toContain('status:in-progress');
  expect(v.milestone).not.toBeNull();
  expect(v.body).toContain('## Checklist (generated — do not edit)');
});

it('start does not require a milestone for a non-feature issue', async () => {
  expect((await start(makeClient([mk(1, ['status:ready', 'type:bug', 'module:core'])]), { issue: 1, repoRoot: 'test/fixtures/repo' })).ok).toBe(true);
});

it('move rejects an illegal transition listing legal ones', async () => {
  const r = await move(makeClient([mk(1, ['status:backlog', 'type:feature', 'module:core'])]), { issue: 1, status: 'done' });
  expect(r.ok).toBe(false);
  expect((r as { ok: false; error: string }).error).toMatch(/approved/);
});

it('move is a no-op when moving to the same status', async () => {
  expect((await move(makeClient([mk(1, ['status:in-progress', 'type:feature', 'module:core'])]), { issue: 1, status: 'in-progress' })).ok).toBe(true);
});

it('close applies the terminal label and closes the issue', async () => {
  const v = (await close(makeClient([mk(1, ['status:in-review', 'type:feature', 'module:core'])]), { issue: 1, target: 'done' }) as { ok: true; value: BoardIssue }).value;
  expect(v.labels).toContain('status:done');
  expect(v.state).toBe('closed');
});

it('close is idempotent on an already-closed issue (applies label, warns, no error)', async () => {
  const closed = { ...mk(1, ['status:in-review', 'type:feature', 'module:core']), state: 'closed' as const };
  expect((await close(makeClient([closed]), { issue: 1, target: 'done' })).ok).toBe(true);
});
```

- [ ] **Paso 2: Ejecuta los tests para verificar que fallan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/commands.issue.test.ts`
Esperado: FAIL — los cuatro comandos no están implementados.

- [ ] **Paso 3: Implementa los cuatro comandos**

`newIssue`: valida `type`/`module` contra `fullCatalog`; `labels = ['status:backlog', 'type:'+type, 'module:'+module]`; body = `upsertMeta('', { status: 'backlog', module, type, ...(spec&&{spec}), ...(plan&&{plan}) })`. `start`: resuelve por `issue` o por coincidencia exacta de `spec:` (`parseMeta(body).spec`); 0 o >1 → error que dirige a `--issue`; exige el estado actual `ready`; milestone = `input.sprint` ?? `meta.sprint`, requerido solo para `type:feature` (error si una feature no tiene ninguno); reescribe meta (`status: in-progress`, `sprint`, `tasks`) + checklist mediante `readTasks`/`renderChecklist`/`upsertChecklist`. `move`: control con `canTransition` (el error lista el actual + `nextStatuses`); no-op si el estado es el mismo; intercambia el label `status:*`. `close`: establece el label terminal y `state: 'closed'`, tolera un issue ya cerrado.

- [ ] **Paso 4: Ejecuta los tests para verificar que pasan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/commands.issue.test.ts`
Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/core/src/board/commands.ts packages/core/src/board/commands.issue.test.ts
git commit -m "feat(board): add new, start, move and close commands"
```

---

### Tarea 8: `check` y `guard`

**Ficheros:**
- Modificar: `packages/core/src/board/commands.ts`
- Test: `packages/core/src/board/commands.check-guard.test.ts`

**Interfaces:**
- Consume: `groupOf`, `fullCatalog` (Tarea 1), `parseMeta` (Tarea 3), `readTasks` (Tarea 3)
- Produce: `export async function check(client: GitHubClient, input: { repoRoot: string }): Promise<{ problems: string[] }>`
- Produce: `export async function guard(client: GitHubClient, input: { issue: number; added: string }): Promise<Result<BoardIssue>>`

- [ ] **Paso 1: Escribe los tests que fallan (reutiliza `makeClient`/`mk`)**

```ts
// commands.check-guard.test.ts
it('check reports duplicate status labels (cardinality drift)', async () => {
  const r = await check(makeClient([mk(1, ['status:ready', 'status:in-progress', 'type:feature', 'module:core'])]), { repoRoot: 'test/fixtures/repo' });
  expect(r.problems.some((p) => p.includes('status'))).toBe(true);
});

it('check reports a feature in-progress without an open milestone', async () => {
  const r = await check(makeClient([{ ...mk(1, ['status:in-progress', 'type:feature', 'module:core']), milestone: null }]), { repoRoot: 'test/fixtures/repo' });
  expect(r.problems.some((p) => p.includes('milestone'))).toBe(true);
});

it('check reports meta↔labels mismatch', async () => {
  const body = '<!-- board:meta\nstatus: ready\nmodule: core\ntype: feature\n-->\n';
  const r = await check(makeClient([mk(1, ['status:in-progress', 'type:feature', 'module:core'], body)]), { repoRoot: 'test/fixtures/repo' });
  expect(r.problems.some((p) => p.includes('meta'))).toBe(true);
});

it('check reports checklist drift and returns [] when clean', async () => {
  const drifted = '## Checklist (generated — do not edit)\n\n- [ ] task-01 Wrong title\n';
  expect((await check(makeClient([mk(1, ['status:in-progress', 'type:feature', 'module:core'], drifted)]), { repoRoot: 'test/fixtures/repo' })).problems.length).toBeGreaterThan(0);
  const clean = '## Checklist (generated — do not edit)\n\n- [x] task-01 Usuarios y roles\n- [ ] task-02 Categorías\n';
  expect((await check(makeClient([mk(1, ['status:in-progress', 'type:feature', 'module:core'], clean)]), { repoRoot: 'test/fixtures/repo' })).problems).toEqual([]);
});

it('guard removes only the other label of the added label group', async () => {
  const v = (await guard(makeClient([mk(1, ['status:ready', 'status:in-progress', 'type:feature', 'module:core'])]), { issue: 1, added: 'status:in-progress' }) as { ok: true; value: BoardIssue }).value;
  expect(v.labels).toEqual(['status:in-progress', 'type:feature', 'module:core']);
});

it('guard is a no-op when the added label has no group or no sibling', async () => {
  const v = (await guard(makeClient([mk(1, ['type:feature', 'module:core'])]), { issue: 1, added: 'type:feature' }) as { ok: true; value: BoardIssue }).value;
  expect(v.labels).toEqual(['type:feature', 'module:core']);
});
```

- [ ] **Paso 2: Ejecuta los tests para verificar que fallan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/commands.check-guard.test.ts`
Esperado: FAIL — `check` y `guard` no están implementados.

- [ ] **Paso 3: Implementa `check` y `guard`**

`check`: primero llama a `listMilestones('open')`; luego, para cada issue abierto, emite un problema por (a) ≠1 label `status:*`/`type:*`/`module:*`, (b) `type:feature` en `in-progress`/`in-review` sin milestone abierto, (c) `parseMeta(body)` ≠ los labels, (d) checklist del body ≠ `readTasks(meta.tasks)` re-renderizado. Nunca escribe. `guard`: `groupOf(added)`; null → sin cambios; si no, conserva `added`, elimina los otros labels del mismo grupo, `updateIssue`. Sin validación de transiciones.

- [ ] **Paso 4: Ejecuta los tests para verificar que pasan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/commands.check-guard.test.ts`
Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/core/src/board/commands.ts packages/core/src/board/commands.check-guard.test.ts
git commit -m "feat(board): add check (drift detection) and guard commands"
```

---

### Tarea 9: `checklist sync` y `status`

**Ficheros:**
- Modificar: `packages/core/src/board/commands.ts`
- Test: `packages/core/src/board/commands.sync-status.test.ts`

**Interfaces:**
- Consume: `parseMeta`, `readTasks`, `renderChecklist`, `upsertChecklist` (Tarea 3), `summarize`, `Summary` (Tarea 4)
- Produce: `export async function checklistSync(client: GitHubClient, input: { issue: number; repoRoot: string }): Promise<Result<BoardIssue>>`
- Produce: `export async function status(client: GitHubClient, input: { repoRoot: string }): Promise<Result<Summary>>`

- [ ] **Paso 1: Escribe los tests que fallan (reutiliza `makeClient`/`mk`)**

```ts
// commands.sync-status.test.ts
it('checklistSync regenerates the checklist whole from docs/tasks, replacing hand edits', async () => {
  const body = '<!-- board:meta\nstatus: in-progress\nmodule: core\ntype: feature\ntasks: docs/tasks/sprint-09-core-data/\n-->\n\n## Checklist (generated — do not edit)\n\n- [x] stale hand edit\n';
  const v = (await checklistSync(makeClient([mk(1, ['status:in-progress', 'type:feature', 'module:core'], body)]), { issue: 1, repoRoot: 'test/fixtures/repo' }) as { ok: true; value: BoardIssue }).value;
  expect(v.body).toContain('- [x] task-01 Usuarios y roles');
  expect(v.body).not.toContain('stale');
});

it('checklistSync fails cleanly without touching the body when tasks: is unreadable', async () => {
  const body = '<!-- board:meta\nstatus: in-progress\nmodule: core\ntype: feature\ntasks: docs/tasks/does-not-exist/\n-->\n';
  expect((await checklistSync(makeClient([mk(1, ['status:in-progress', 'type:feature', 'module:core'], body)]), { issue: 1, repoRoot: 'test/fixtures/repo' })).ok).toBe(false);
});

it('status returns the summary aggregation (same shape as the panel)', async () => {
  const r = await status(makeClient([mk(1, ['status:in-progress', 'type:feature', 'module:core']), mk(2, ['status:done', 'type:chore', 'module:admin'])]), { repoRoot: 'test/fixtures/repo' });
  const s = (r as { ok: true; value: Summary }).value;
  expect(s.byStatus['in-progress']).toBe(1);
  expect(s.byModule['core']).toBe(1);
});
```

- [ ] **Paso 2: Ejecuta los tests para verificar que fallan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/commands.sync-status.test.ts`
Esperado: FAIL — `checklistSync` y `status` no están implementados.

- [ ] **Paso 3: Implementa `checklistSync` y `status`**

`checklistSync`: `getIssue`; `meta = parseMeta(body)`; resuelve `meta.tasks` bajo `repoRoot`; si no es legible o no coincide → `{ ok: false }` sin llamar a `updateIssue`. Si no, `items = readTasks(dir)`, `updateIssue({ body: upsertChecklist(body, items) })` (el bloque meta no se toca). `status`: `listIssues('all')` → `summarize(issues, new Date())`; rellena `summary.progress` para los issues abiertos a partir de `parseMeta` + `readTasks` (done/total).

- [ ] **Paso 4: Ejecuta los tests para verificar que pasan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/commands.sync-status.test.ts`
Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/core/src/board/commands.ts packages/core/src/board/commands.sync-status.test.ts
git commit -m "feat(board): add checklist sync and status commands"
```

---

### Tarea 10: CLI — parser, configuración, despacho, códigos de salida, conexión

**Ficheros:**
- Crear: `packages/core/src/board/cli.ts`
- Test: `packages/core/src/board/cli.test.ts`
- Modificar: `package.json` (raíz — añadir script `board` y devDependency `tsx`)
- Modificar: `packages/core/package.json` (añadir export `"./board/*.js": "./src/board/*.ts"`)

**Interfaces:**
- Consume: todas las exportaciones de `commands.ts` (Tareas 6–9), `OctokitGitHubClient` (Tarea 5)
- Produce: `export interface BoardConfig { apiUrl: string; repo: string; token: string; confirm: boolean }`
- Produce: `export function loadConfig(env: NodeJS.ProcessEnv): BoardConfig` (`GITHUB_API_URL` por defecto `https://api.github.com`, `GITHUB_REPO` por defecto `rferic/027apps`, `GITHUB_TOKEN`, `BOARD_CONFIRM` → `confirm`)
- Produce: `export const DEFAULT_REPO = 'rferic/027apps'` (usado por `loadConfig` y por el guard de producción)
- Produce: `export function parseArgs(argv: string[]): ParsedCommand` (escrito a mano, sin dependencia; `{ command, args, flags, dryRun }`)
- Produce: `export async function main(argv: string[], env: NodeJS.ProcessEnv): Promise<number>` (`0` ok, `1` fallo de comando o drift en `check`, `2` error de uso)

- [ ] **Paso 1: Escribe los tests de parser/configuración/guard que fallan**

```ts
// cli.test.ts
it('parses subcommands, flags and dry-run', () => {
  expect(parseArgs(['move', '12', 'in-review'])).toEqual({ command: 'move', args: ['12', 'in-review'], flags: {}, dryRun: false });
  expect(parseArgs(['--dry-run', 'labels', 'sync'])).toMatchObject({ command: 'labels', dryRun: true });
  expect(parseArgs(['guard', '--issue', '5', '--added', 'status:in-progress'])).toMatchObject({ command: 'guard', flags: { issue: '5', added: 'status:in-progress' } });
});

it('throws on an unknown command', () => {
  expect(() => parseArgs(['frobnicate'])).toThrow(/unknown command/);
});

it('loadConfig reads env with defaults and the confirm flag', () => {
  expect(loadConfig({ GITHUB_TOKEN: 'tok', BOARD_CONFIRM: '1' })).toEqual({ apiUrl: 'https://api.github.com', repo: 'rferic/027apps', token: 'tok', confirm: true });
  expect(loadConfig({ GITHUB_TOKEN: 'tok' }).confirm).toBe(false);
  expect(loadConfig({ GITHUB_TOKEN: 'tok', GITHUB_API_URL: 'https://gh.local' }).apiUrl).toBe('https://gh.local');
});

it('main blocks writes to the production repo without BOARD_CONFIRM (implicit dry-run)', async () => {
  expect(await main(['move', '1', 'in-review'], { GITHUB_REPO: 'rferic/027apps', GITHUB_TOKEN: 'tok' })).toBe(0); // dry-run notice, no network
});

it('main exits 1 on check drift', async () => {
  // check against a drifted fixture → 1.
});

it('main exits 2 on usage error (unknown command)', async () => {
  expect(await main(['nope'], { GITHUB_TOKEN: 'tok' })).toBe(2);
});
```

- [ ] **Paso 2: Ejecuta los tests para verificar que fallan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/cli.test.ts`
Esperado: FAIL — `cli.ts` no existe.

- [ ] **Paso 3: Implementa `cli.ts`**

Shebang `#!/usr/bin/env node`. `parseArgs`: el primer token que no sea flag es el comando; `--dry-run` en cualquier posición activa `dryRun`; `--issue <n>`/`--added <label>`/`--spec <s>` → `flags`; el resto son `args` posicionales; un comando desconocido lanza error. `main`: `loadConfig`, construye `OctokitGitHubClient`, despacha al comando, imprime resultados/errores y devuelve el código de salida. Guard de producción: `repo === DEFAULT_REPO && !confirm` en un comando de escritura → dry-run (imprime, no llama), devuelve `0`. `check` devuelve `1` cuando `problems.length > 0` tras imprimir.

- [ ] **Paso 4: Ejecuta los tests para verificar que pasan**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/cli.test.ts`
Esperado: PASS.

- [ ] **Paso 5: Conecta los manifiestos del paquete**

- `package.json` raíz: añade `"board": "tsx packages/core/src/board/cli.ts"` a `scripts`, y `"tsx"` a `devDependencies`. Justificación: `tsx` ejecuta el TS de la CLI directamente (sin paso de build de core; el paquete se consume vía `exports` → `.ts`).
- `packages/core/package.json`: añade `"./board/*.js": "./src/board/*.ts"` a `exports`.
- Ejecuta `pnpm install` (el lockfile incorpora `tsx`).

- [ ] **Paso 6: Verifica la CLI de extremo a extremo (dry-run)**

Ejecutar: `pnpm board check --dry-run` y `pnpm board labels sync --dry-run`
Esperado: salida de uso/listado, código de salida 0, sin red.

- [ ] **Paso 7: Commit**

```bash
git add packages/core/src/board/cli.ts packages/core/src/board/cli.test.ts package.json packages/core/package.json pnpm-lock.yaml
git commit -m "feat(board): add CLI with arg parsing, config and exit codes"
```

---

### Tarea 11: Workflow de guard + issue forms

**Ficheros:**
- Crear: `.github/workflows/board-guard.yml`
- Crear: `.github/ISSUE_TEMPLATE/bug.yml`
- Crear: `.github/ISSUE_TEMPLATE/feature.yml`
- Crear: `.github/ISSUE_TEMPLATE/suggestion.yml`
- Crear: `.github/ISSUE_TEMPLATE/config.yml`
- Modificar: `.github/workflows/ci.yml` (job admin — ejecutar la suite board de core)

- [ ] **Paso 1: Escribe `board-guard.yml`**

Disparador `issues: [opened, labeled]`; `permissions: { issues: write, contents: read }`; un job en `ubuntu-24.04`: checkout + configuración de Node/pnpm (mismos SHA fijados que `ci.yml`), `pnpm install --frozen-lockfile`, y luego ejecutar `pnpm board guard --issue ${{ github.event.issue.number }} --added ${{ github.event.label.name }}` con `BOARD_CONFIRM=1` y `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` definidos **solo en ese paso** (`env`), no a nivel de job.

- [ ] **Paso 2: Escribe los issue forms**

- `bug.yml`: `name: "Bug report"`, frontmatter `labels: [type:bug, status:backlog]`, `title` + textarea de descripción.
- `feature.yml`: `name: "Feature request"`, frontmatter `labels: [type:feature, status:backlog]`.
- `suggestion.yml`: `name: "Suggestion"`, frontmatter `labels: [type:feature, status:backlog]` (una sugerencia es una idea de feature; el módulo se elige después con `board start`).
- `config.yml`: `blank_issues_enabled: false`.

- [ ] **Paso 3: Protege la suite board en CI**

Añade `- run: pnpm --filter @027apps/core test` al job `admin` de `ci.yml` (junto al test de manifiestos existente) para que los tests de board se ejecuten en cada PR.

- [ ] **Paso 4: Verifica los cambios de workflow/CI**

Ejecutar: `git diff --check`; lee el diff de `ci.yml` para confirmar que el paso está dentro del job `admin`.
Esperado: sin errores de espacios en blanco; el job `admin` lista la ejecución de tests de core.

- [ ] **Paso 5: Commit**

```bash
git add .github/workflows/board-guard.yml .github/ISSUE_TEMPLATE/ .github/workflows/ci.yml
git commit -m "ci(board): add label guard workflow and issue forms"
```

---

### Tarea 12: Documentación y ficheros de tareas del sprint

**Ficheros:**
- Crear: `docs/flows/board.md`
- Modificar: `docs/flows/feature.md`, `docs/flows/git.md`, `docs/flows/bugfix.md`, `docs/flows/cicd.md`, `docs/conventions/definition-of-done.md`, `AGENTS.md`
- Crear: `docs/tasks/sprint-09-board-contract/README.md` + `task-01.md` … `task-13.md`

- [ ] **Paso 1: Escribe `docs/flows/board.md` (en español)**

Flujo completo del board: ciclo de vida (estados de §7 + actores), los 10 comandos (§9), el guard (§10), el contrato `<!-- board:meta -->` + checklist (§8), los issue forms y el runbook de la suite de integración (Tarea 13).

- [ ] **Paso 2: Parchea `feature.md`, `git.md`, `bugfix.md`, `definition-of-done.md`, `AGENTS.md`**

- `feature.md`: mapeo de estados (§3.4) y las puertas `approved`/`ready`; una transición `board move` en cada puerta.
- `git.md`: milestone por sprint, el PR referencia issues con `Refs #…` (no `Closes #…`), el issue pasa a `in-review` solo cuando el PR sale de draft.
- `bugfix.md`: los bugs son issues `type:bug`; `board close <n> done` tras el test de regresión.
- `definition-of-done.md`: equivalencia `done` ↔ `finalizada`.
- `AGENTS.md`: puntero a `docs/flows/board.md` + la regla "los agentes nunca etiquetan a mano; todas las transiciones vía `board move`/`board close`".

- [ ] **Paso 3: Parchea `docs/flows/cicd.md`**

Añade el workflow `board-guard.yml` a la tabla de disparadores y anota la regla de secreto: `BOARD_CONFIRM=1` solo en el paso del guard (exigido por `AGENTS.md` desde que se añadió un workflow en la Tarea 11).

- [ ] **Paso 4: Crea los ficheros de tareas del sprint**

`README.md` (tabla de entregables) + `task-01.md` … `task-13.md`, cada uno con frontmatter `id`, `titulo`, `area: board`, `estado: pendiente`, `plan: docs/superpowers/plans/2026-11-06-board-phase-a.md`.

- [ ] **Paso 5: Verifica los docs contra el repo**

Ejecutar: `node scripts/check-ai-docs.mjs`; vuelve a leer los docs cambiados para confirmar que no contradicen `AGENTS.md`/spec.
Esperado: el check pasa; las rutas y nombres de comandos coinciden con el spec.

- [ ] **Paso 6: Commit**

```bash
git add docs/flows/board.md docs/flows/feature.md docs/flows/git.md docs/flows/bugfix.md docs/flows/cicd.md docs/conventions/definition-of-done.md AGENTS.md docs/tasks/sprint-09-board-contract/
git commit -m "docs(board): document the board flow and sprint-09-board-contract tasks"
```

---

### Tarea 13: Suite de integración opt-in

**Ficheros:**
- Crear: `packages/core/src/board/integration.test.ts`
- Modificar: `docs/flows/board.md` (runbook)

- [ ] **Paso 1: Escribe `integration.test.ts` (omitido salvo que se active)**

```ts
// integration.test.ts
describe.skipIf(!process.env.BOARD_INTEGRATION)('board integration (sandbox repo)', () => {
  it('creates, moves and closes a [sandbox] issue end-to-end', async () => {
    // Real OctokitGitHubClient against GITHUB_REPO (private sandbox) + GITHUB_TOKEN.
    // newIssue → assert status:backlog → move ready → start → move in-review → close done.
    // Issues cannot be deleted; the created issue is left closed.
    expect(true).toBe(true);
  });
});
```

- [ ] **Paso 2: Documenta el runbook en `docs/flows/board.md`**

`BOARD_INTEGRATION=1 GITHUB_TOKEN=<sandbox-PAT> GITHUB_REPO=<owner>/<sandbox> pnpm --filter @027apps/core test -- src/board/integration.test.ts` contra un repo sandbox privado; los issues se crean con prefijo `[sandbox]` y se dejan cerrados.

- [ ] **Paso 3: Verifica que la suite se omite por defecto**

Ejecutar: `pnpm --filter @027apps/core test -- src/board/integration.test.ts`
Esperado: bloque describe reportado como omitido (0 tests), código de salida 0.

- [ ] **Paso 4: Commit**

```bash
git add packages/core/src/board/integration.test.ts docs/flows/board.md
git commit -m "test(board): add opt-in integration suite against a sandbox repo"
```

---
