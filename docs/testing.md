# Testing Guide

## Test Runners

| Tool | Used For | Config |
|------|----------|--------|
| Vitest | Unit tests, API tests, component tests | `vitest.config.ts` (root) |
| Storybook + Chromatic | Visual regression, interaction tests | `*.stories.tsx` |

## Running Tests

```bash
# All tests (root workspace)
pnpm test --run

# Mobile tests (separate workspace)
cd mobile && npx vitest run

# Single file
npx vitest run tests/unit/auth/pairing.test.ts

# Watch mode
pnpm test
```

## Test Location Convention

| What | Where | Examples |
|------|-------|---------|
| API endpoint tests | `tests/api/v1/` | `admin/users.test.ts` |
| Unit tests (use cases) | `tests/unit/` | `use-cases/api-keys.test.ts` |
| Unit tests (components) | `src/components/**/*.test.tsx` | `ds/button.test.tsx` |
| App-specific tests | `tests/apps/` | `permissions.test.ts` |
| Notification tests | `tests/notifications/` | `triggers.test.ts` |
| Inspiration tests | `tests/inspiration/` | `api.test.ts` |
| Mobile tests | `mobile/tests/` | `unit/auth.test.ts` |

## Mock Patterns

### Supabase Admin Client

```typescript
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClientUntyped: vi.fn(() => ({
    from: mockFrom,
    auth: { admin: { getUserById: mockGetUserById, listUsers: mockListUsers } },
  })),
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}))
```

### Next.js Route Handlers

Use `next-request` polyfill: `import { createMockRequest } from '@/test-utils'`

## Writing a New Test

1. Create the test file in the appropriate directory
2. Import `describe`, `it`, `expect` from `vitest`
3. Mock dependencies using `vi.mock()` before imports
4. Use `beforeEach` to reset mocks
5. Write at least: happy path, error case, auth check
6. Run and verify all existing tests still pass

## Test Conventions

- **Files**: `*.test.ts` for logic tests, `*.test.tsx` for component tests
- **Descriptions**: Use `it('should ...')` format
- **Mocks**: Use `vi.hoisted()` for mock state, `vi.mock()` at module level
- **Cleanup**: Vitest auto-resets mocks between files
- **Skip heavy tests**: Use `it.skip('...')` for tests that need Supabase running

## Pre-Push Hook

The pre-push hook (`.githooks/pre-push`) runs automatically:
1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm tsc --noEmit`
4. `pnpm test --run`
5. `pnpm build`

If any step fails, the push is blocked.
