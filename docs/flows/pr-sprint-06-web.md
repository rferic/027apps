# Cuerpo del PR — sprint 06 web

> Cuerpo del PR del sprint 06 web, que se abre ahora (un PR por sprint, `docs/flows/git.md` §2–3).
> El squash a `main` lo ordena el usuario. Todo el texto va en inglés, como el resto de la superficie de GitHub.
>
> **Migraciones a aplicar en orden:** `0015`, `0016` y `0017` (ver la sección *Migrations*).

---

## Título (commit resultante del squash)

```
feat(admin): ship the real admin panel on the Core API
```

## Cuerpo

### Summary

Replaces the hardcoded admin mockup (`MEMBERS_ROWS`, `NAV_ITEMS` with dead `#` anchors) with a real
panel that consumes `/api/v1`: server-rendered pages, session and role gates, instance-aware header,
nine-locale UI, and the list/detail/form patterns fixed by the UX review. One sprint, 15 tasks, no
data of example left in production code.

### Tasks

| # | Task | Outcome |
|---|---|---|
| 01 | Sprint README | Scope, task table and closing rules. |
| 02 | i18n setup + Firebase guide | 9 locales loaded per request (cookie `027_locale`), `/help/firebase` guide, `i18n:scan`/`i18n:check` gates. |
| 03 | Local dev domain | `027apps.local` through the OrbStack Caddy proxy, with `public_url` accepting `http` only on local hosts. |
| 04 | Settings batch write | `PATCH /api/v1/settings` applies an atomic `updates` batch; per-section forms only send their own keys. |
| 05 | Shell + `/modules` | Panel shell (brand, grouped nav, active item, mobile drawer) and the module catalogue. |
| 06 | Dashboard | Real KPIs with source/period, instance headline, module cards; no invented metrics. |
| 07 | Members | List with server pagination, filters (role, state, category), member detail, deactivate/restore/purge. |
| 08 | Categories + invitations | Category CRUD and member assignment; invitation creation with one-time token and revoke. |
| 09 | API keys + settings | Key creation with scopes, expiry and owner; the five settings sections with their own routes. |
| 10 | API docs | `/docs/api` renders the OpenAPI document generated from the shared zod schemas. |
| 11 | Design/UX review | Information architecture, header, list/detail/form patterns, empty/loading/error states, 375 px behaviour. |
| 12 | Public invitation redemption | `/invite/{token}` redeems an invitation without a session, with no-referrer and rate limits. |
| 13 | API-key scopes and delegated keys | Per-kind scope allowlist enforced in the guard, delegated keys per owner, 5-active-key limit. |
| 14 | Invitation and module detail pages | `/invitations/{id}` and `/modules/{key}` with breadcrumbs, metadata and grants. |
| 15 | Install modules from the panel | `/modules/install` installs a registered module and reports its state and settings. |

### What changes for the user

- **A panel that tells the truth.** Every number comes from the API; when a list is empty, loading or
  broken the page says so (translated code + copyable `request_id` + retry link) instead of showing a
  table that looks full.
- **Orientation.** Grouped navigation (Home / Users / Platform / Settings / Documentation) with
  `aria-current` on the active destination, breadcrumbs on every detail page, and mobile cards instead
  of a horizontally scrolling table.
- **Session context.** The header shows the 027Apps mark, the instance name and a user menu with the
  role, theme, language and "Log out". The theme and the language are user preferences (cookies
  `027_theme` and `027_locale`).
- **One primary action per page**, destructive actions isolated in their own card and confirmed by
  naming the object and the consequence (deactivate, purge, revoke a key or invitation, uninstall a
  module, drop the CORS origin that serves the panel).
- **Members** can be filtered by role, state and category, reactivated, and permanently deleted once
  deactivated (typing the name is required).
- **Invitations** reject an email that already has an account or a pending invitation, show the
  conflict next to the field, and offer "Create another" without leaving the page.
- **API keys** get a detail page (`/keys/{id}`): metadata, readable scopes, and edit of name, scopes
  and relative expiry. Service keys are super_admin only; delegated keys belong to their owner.
- **Modules** can be installed from the panel, and uninstall warns about active grants.
- **Settings** are five separate routes, each saving only its own category; the localization section
  picks enabled locales and currencies with a searchable multi-select.

### Migrations

Apply in order before deploying:

- `0015_api_keys_owner_policy.sql` — RLS read policy for API keys: a delegated key is visible to its
  owner and to a `super_admin` only, matching the Core guard.
- `0016_api_keys_no_direct_write.sql` — revokes `insert`/`update`/`delete` on `api_keys` from
  `authenticated` and drops the write policy: keys are written by the Core only. (Audit M1.)
- `0017_drop_instance_logo_setting.sql` — deletes the orphan `instance.logo_url` settings row left by
  `0005_instance_logo.sql`; the key left the catalog this sprint and must not survive a restore as if
  it were configurable.

### API contract (new or changed)

All under `/api/v1`, documented in `docs/api/openapi.json` (`pnpm check:openapi`).

- **Invitations by id**: `GET /invitations/{id}` returns a single invitation (state, expiry, creator,
  timestamps) and `DELETE /invitations/{id}` revokes it. The one-time token is still only returned by
  `POST /invitations`; redemption is `POST /invitations/{token}/redeem`.
- **Module grants**: `GET /modules/{key}/grants` lists the users and categories a module is granted
  to, so the detail page can show access without N+1 calls.
- **`state` filters**: `GET /api-keys` accepts `state` (`active|expired|revoked|all`) plus `kind` and
  `user`; `GET /modules` accepts `state` (`all|installed|active|disabled`) and `public` (`all|yes|no`);
  `GET /users` accepts `state` (`active|deactivated|all`, default `active`), `role` and `category`.
  Invalid values are a `400 validation_failed` and `total` always counts the filtered set.
- **`PATCH /api-keys/{id}`**: updates `name`, `scopes` and `expires_at` (nullable) of a live key; new
  scopes stay inside the key's stored `role_cap` (service) or the owner's allowlist and live module
  grants (delegated), and a key the caller does not own answers `404`.
- **Also new this sprint**: `POST /users/{id}/restore`, `DELETE /users/{id}/purge`, and
  `POST /modules/{key}/install`.

### Verification checklist

- [ ] `pnpm lint`
- [ ] `pnpm tsc`
- [ ] `pnpm test`
- [ ] `pnpm i18n:check`
- [ ] `pnpm --filter admin build` (dev server stopped)
- [ ] `pnpm check:openapi`
- [ ] db-tests: `pnpm --filter db-tests test` with `supabase db reset` (migrations `0015`–`0017` applied clean)
- [ ] Manual at 375 px and 1280 px: no horizontal scroll, tables become cards
- [ ] Manual keyboard pass: Tab reaches every control with a visible focus ring
- [ ] Manual in all 9 locales: menu labels and headers fit
- [ ] Security audit (OWASP A01, A05, A07) per task, no open high/critical findings
