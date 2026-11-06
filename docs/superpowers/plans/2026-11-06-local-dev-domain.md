# Implementation Plan — Local Development Domain (027apps.local)

**Goal:** Enable local development using `http://027apps.local` via OrbStack and Caddy proxy, adapt `public_url` validation for local HTTP origins, configure Supabase site URL, update preferences UI hints, and document the complete local workflow.

**Spec:** `docs/superpowers/specs/2026-11-06-local-dev-domain-design.md`

## Tasks

- [x] **Task 1: Next.js dev origins configuration and test**
  - Update `apps/admin/next.config.ts` to include `127.0.0.1` and `027apps.local` in `allowedDevOrigins`.
  - Create `apps/admin/src/lib/dev-origins.test.ts` to verify allowed origins behavior.

- [x] **Task 2: Core settings catalog public URL validation policy**
  - Update `packages/core/src/settings/catalog.ts` (`publicUrlSchema`) to allow `https` universally and `http` strictly for local host patterns (`localhost`, `*.localhost`, `*.local`, `*.test`, `127.0.0.1`, `[::1]`, private IPv4 ranges), enforcing pure origin format (no trailing slash, path, or query).
  - Create `packages/core/src/settings/catalog.test.ts` to test schema rules and edge cases.

- [x] **Task 3: Supabase config local site URL adjustments**
  - Update `supabase/config.toml` setting `site_url = "http://027apps.local"` and adding local redirect URLs.

- [x] **Task 4: Preferences step HTML pattern and i18n support**
  - Update `apps/admin/src/app/setup/preferences-step.tsx` with `pattern="https?://[^\s/]+"`, updated messages, and hints across 9 locales.

- [x] **Task 5: Documentation and task tracking**
  - Create `docs/flows/local-development.md` detailing requirements, proxy start/stop commands, verification, `.local` vs `.test` rationale, cookie isolation, and troubleshooting.
  - Create `docs/tasks/sprint-web/task-03.md` marking task as `en curso`.

- [ ] **Task 6: Verification**
  - Run full verification gates (`lint`, `tsc`, `test`, `i18n:check`, `build`), verify domain resolution with `curl`, and check browser interactivity.
