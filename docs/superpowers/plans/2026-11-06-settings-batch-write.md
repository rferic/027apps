# Settings batch write implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the wizard installation rate limiting bug by implementing batch write settings and increasing the write limit from 10 to 30 requests/minute.

**Architecture:** New `PATCH /api/v1/settings` endpoint accepts `{ updates: [{ key, value }] }`, validates all keys before transaction, writes in a single atomic operation. The individual endpoint remains available with increased rate limiting.

**Tech Stack:** Node.js, TypeScript, Supabase, zod validation, rate limiting.

**Spec:** `docs/superpowers/specs/2026-11-06-settings-batch-write-design.md`

## Global Constraints

- Code, comments, commits, branches and GitHub surface in **English**; internal docs and conversation in **Spanish**.
- No hardcoded colors, no `any`, no `console.log`.
- Before claiming done: `pnpm lint`, `pnpm tsc`, `pnpm test`, builds affected.
- One PR for this task, branched from `main`; no merge without explicit user order.
- Branch and task setup before Task 1: create `docs/tasks/sprint-web/task-04.md` (`estado: en curso`), branch `feature/settings-batch-write` from `main`.

## Review Focus

- **Rate limiting:** Both endpoints use the new 30/min limit
- **Atomicity:** Batch operation either writes all or none
- **Error handling:** Client receives `details.key` for field-specific errors
- **Backward compatibility:** Individual endpoint still works as before

## File Structure

**Core package**
- Modify: `packages/core/src/settings/service.ts` — new `writeSettings` function
- Modify: `packages/core/src/settings/api.ts` — new `patchSettingsRoute`, `DEFAULT_WRITE_LIMIT`
- Test: `packages/core/src/settings/service.test.ts` — batch write tests
- Test: `packages/db-tests/src/api/settings.test.ts` — integration tests

**Admin package**
- Modify: `apps/admin/src/app/api/v1/settings/route.ts` — implement batch PATCH
- Modify: `apps/admin/src/app/setup/preferences-step.tsx` — single batch call
- Test: `apps/admin/src/app/setup/preferences-step.test.tsx` — regression test

**Docs**
- Create: `docs/tasks/sprint-web/task-04.md`
- Update: `docs/superpowers/specs/2026-10-26-core-api.md` — add new endpoint reference

---

### Task 1: Core service — batch write implementation

**Files:**
- Modify: `packages/core/src/settings/service.ts`
- Test: `packages/core/src/settings/service.test.ts`

**Interfaces:**
- Produces: `writeSettings(deps, caller, updates): Promise<SettingView[]>`
- Produces: atomic validation and write transaction

- [ ] **Step 1: Write the failing batch write tests**

Assert:
- Valid updates: all written in one transaction
- Invalid key: none written, returns `validation_failed` with `details.key`
- Duplicate keys: rejected with error
- Mixed valid/invalid: none written due to atomicity
- Secret encryption works as in individual writes

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm --filter @027apps/core test -- src/settings/service.test.ts`
Expected: FAIL because the function does not exist.

- [ ] **Step 3: Implement `writeSettings`**

Validate each key before transaction:
- Check existence in catalog
- Check write permissions
- Validate with zod schema

Use `deps.withTransaction` for:
- Read current values
- Merge with updates
- Validate coherence between batch keys
- Write all keys in one operation

Handle encrypted secrets with fail-closed logic.

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm --filter @027apps/core test -- src/settings/service.test.ts`
Expected: PASS.

- [ ] **Step 5: Modify `writeSetting` to delegate**

Update existing `writeSetting` to call `writeSettings` with single-element array.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/settings/service.* packages/core/src/settings/service.test.ts
git commit -m "feat(settings): add batch write functionality"
```

---

### Task 2: Core API — new endpoint and rate limit

**Files:**
- Modify: `packages/core/src/settings/api.ts`
- Test: `packages/db-tests/src/api/settings.test.ts`

**Interfaces:**
- Produces: `patchSettingsRoute` — new endpoint
- Produces: `DEFAULT_WRITE_LIMIT = 30`

- [ ] **Step 1: Write the failing endpoint tests**

Assert:
- Valid batch request: returns 200 with all updated settings
- Invalid key: returns 400 with `details.key`
- Too many updates (>30): returns 400
- Rate limited: returns 429 after 30 requests
- Individual endpoint still works with new limit

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm --filter db-tests test -- src/api/settings.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement new endpoint**

Add `patchSettingsRoute` with:
- Body validation: `{ updates: Array<{ key: string; value: any }> }`
- Rate limiting: `DEFAULT_WRITE_LIMIT = 30`
- Call `writeSettings` with validated updates
- Return array of updated settings

Update rate limit for individual endpoint to use `DEFAULT_WRITE_LIMIT`.

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm --filter db-tests test -- src/api/settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/settings/api.ts packages/db-tests/src/api/settings.test.ts
git commit -m "feat(api): add settings batch endpoint with increased rate limit"
```

---

### Task 3: Admin API integration

**Files:**
- Modify: `apps/admin/src/app/api/v1/settings/route.ts`
- Test: integration test

**Interfaces:**
- Produces: Admin PATCH endpoint using `patchSettingsRoute`

- [ ] **Step 1: Write the failing integration test**

Assert:
- PATCH to admin endpoint succeeds with batch updates
- Returns same structure as core endpoint
- Field-specific errors propagate correctly

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm --filter admin test -- src/app/api/v1/settings/route.test.ts` (or equivalent)
Expected: FAIL.

- [ ] **Step 3: Implement batch PATCH in admin**

Update admin route to:
- Accept batch updates in same format as core
- Call `patchSettingsRoute` from core
- Pass through authentication and scopes

- [ ] **Step 4: Run test and verify it passes**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/app/api/v1/settings/route.ts apps/admin/src/app/api/v1/settings/route.test.ts
git commit -m "feat(admin): implement settings batch write endpoint"
```

---

### Task 4: Client — batch wizard updates

**Files:**
- Modify: `apps/admin/src/app/setup/preferences-step.tsx`
- Test: `apps/admin/src/app/setup/preferences-step.test.tsx`

**Interfaces:**
- Produces: Single API call with all 12 wizard updates
- Produces: Error handling with `details.key` for field signaling

- [ ] **Step 1: Write the failing client test**

Assert:
- Single API call with 12 updates succeeds
- On error, field message shows `Details: {message}` with `details.key`
- Individual field messages preserved

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm --filter admin test -- src/app/setup/preferences-step.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Update client to use batch**

Replace the loop of 12 individual calls with:
- Single call to `/api/v1/settings` with all updates
- Handle errors: extract `details.key` for field-specific messaging

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm --filter admin test -- src/app/setup/preferences-step.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/app/setup/preferences-step.* apps/admin/src/app/api/v1/settings/route.test.ts
git commit -m "feat(wizard): use batch settings write to avoid rate limiting"
```

---

### Task 5: Core API spec update

**Files:**
- Modify: `docs/superpowers/specs/2026-10-26-core-api.md`

**Interfaces:**
- Produces: Updated spec with new endpoint reference

- [ ] **Step 1: Add endpoint reference**

In the settings section (§3.8), add a line for the new batch endpoint:

```
| `PATCH /api/v1/settings` | actualizar múltiples settings en una transacción | `settings:write` | `is_admin()` |
```

Reference the detailed spec: `→ docs/superpowers/specs/2026-11-06-settings-batch-write-design.md`

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-10-26-core-api.md
git commit -m "docs(api): add reference to settings batch write endpoint"
```

---

### Task 6: Task documentation and verification

**Files:**
- Create: `docs/tasks/sprint-web/task-04.md`
- Verify: full test suite

**Interfaces:**
- Produces: Complete task documentation
- Produces: All tests passing

- [ ] **Step 1: Create task documentation**

Create `docs/tasks/sprint-web/task-04.md` with:
- Frontmatter: `id: sprint-web-task-04`, `titulo: "Settings batch write para evitar rate limiting"`, `area: web`, `estado: test`, `adrs: [0007]`, `plan`, `spec`
- Alcance: implementation of batch settings write and rate limit increase
- TDD: all tasks implemented with failing tests first
- DoD: tests, lint, tsc, security audit

- [ ] **Step 2: Run full verification**

Run: `pnpm lint && pnpm tsc && pnpm test && pnpm --filter admin build`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add docs/tasks/sprint-web/task-04.md
git commit -m "docs(sprint-web): create task for settings batch write"
```

---

### Task 7: Audits and close

**Files:**
- Modify: `docs/tasks/sprint-web/task-04.md` (`estado`)
- No product code unless audit finding requires it.

- [ ] **Step 1: Dispatch QA/OWASP audit**

Use `ingeniero` on the full branch diff. Check:
- Rate limiting works correctly (30/min)
- Atomicity: no partial writes on validation failure
- Error handling: `details.key` for field-specific errors
- Backward compatibility: individual endpoint still works

- [ ] **Step 2: Dispatch style review**

Use `cocinero` on the diff. Check:
- English code/comments
- No `any`, no dead code
- Semantic tokens if used
- Naming conventions

- [ ] **Step 3: Address findings**

Fix every critical/high finding and every medium with written reason if rejected. Re-run affected tests.

- [ ] **Step 4: Re-run full gates**

Run: `pnpm lint && pnpm tsc && pnpm test && pnpm --filter admin build`
Expected: all green.

- [ ] **Step 5: Mark task `finalizada` and commit**

Only after audits and gates pass. Commit task file update.

```bash
git add docs/tasks/sprint-web/task-04.md
git commit -m "docs(sprint-web): close settings batch write task"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-06-settings-batch-write.md`.

Branch strategy before Task 1: create `docs/tasks/sprint-web/task-04.md` and branch `feature/settings-batch-write` from `main`.

Suggested execution: **native** in this session, as the tasks share the core service changes and the final review needs a fresh pair of eyes.