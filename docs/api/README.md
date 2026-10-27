# 027Apps API (v1)

Public guide for integrating with a 027Apps instance. This document is the **human entry point**; the normative contract is the generated **OpenAPI** document.

> **Status.** The v1 contract is defined and approved, but **not yet implemented** (today only `GET /api/health` exists as an alias of the canonical `GET /api/v1/health`). This guide describes the contract you will integrate against; once the API lands, the OpenAPI document will be served by every instance and committed to the repository for review. If something here disagrees with the OpenAPI, **the OpenAPI wins**.

## Contents

1. [Quickstart](#1-quickstart)
2. [Authentication](#2-authentication)
3. [Versioning](#3-versioning)
4. [Errors](#4-errors)
5. [Pagination](#5-pagination)
6. [Rate limiting](#6-rate-limiting)
7. [Idempotency](#7-idempotency)
8. [Dates and money](#8-dates-and-money)
9. [Modules](#9-modules)
10. [MCP](#10-mcp)
11. [OpenAPI](#11-openapi)

---

## 1. Quickstart

Every instance is **private**: you talk to the URL of the instance you were invited to, and you need a credential.

```bash
# Health (public; 200 ok, 503 degraded). Every response carries X-Request-Id.
curl -sS -i "$INSTANCE_URL/api/v1/health"

# Instance metadata (public, non-sensitive): name, version, locales, default currency…
curl -sS "$INSTANCE_URL/api/v1/instance"
```

Every response includes:

| Header | Meaning |
|---|---|
| `X-Request-Id` | Correlation id for support. Quote it when reporting an issue. |
| `Retry-After` | On `429` (and on `409` when another maintenance run is in progress). |

## 2. Authentication

There are three credentials, for three different callers. All are **scoped and revocable instantly**; API keys are **opaque** (only a hash is stored), and the mobile uses the **Supabase session JWT**.

| Caller | Credential | Header |
|---|---|---|
| Mobile app | **Supabase JWT** (the user's session) | `Authorization: Bearer <jwt>` |
| Third-party tool acting as a user | **Delegated API key** (`027_usr_…`) | `Authorization: Bearer 027_usr_…` |
| Instance tooling / administration | **Instance API key** (`027_svc_…`) | `Authorization: Bearer 027_svc_…` |

- **Scopes per action.** Each endpoint declares the scopes it needs (`expenses:read`, `users:write`, `modules:grant`, …). A delegated key is limited to `min(key scopes, user permissions)`.
- **Instance keys** carry a `role_cap` (`admin` or `super_admin`): their effective power is `min(scopes, role_cap)`. An instance key **never** acts as a user.
- **Revocation is immediate**: a revoked or expired key fails on the very next request (no cache delay).
- **The mobile app uses only the Supabase JWT**; it never uses instance or delegated keys.
- **Never put a key in a browser** or in client-side code. Keys are for servers and local tools.
- **Secrets are shown once**, at creation. Only a hash is stored; if you lose it, create a new key.

```bash
curl -sS "$INSTANCE_URL/api/v1/me" -H "Authorization: Bearer $DELEGATED_KEY"
```

## 3. Versioning

- The version is **in the URL**: `/api/v1/…`. There is no header negotiation.
- Incompatible changes (a resource shape, an error `code`) → new version `/v2`; `v1` keeps working for the agreed period.
- Additive changes (new optional fields, new endpoints, new error codes for new situations) are **not** breaking.

## 4. Errors

Every error from `/api/v1` uses the same envelope:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Validation failed",
    "request_id": "6f1c2a8e-…",
    "details": [{ "path": "email", "rule": "email", "message": "must be a valid email" }]
  }
}
```

- **`code` is the contract.** Branch on it, never on `message`. `message` is a default English text; the UI translates it locally.
- `details` appears mainly for `validation_failed` (field-level errors you can map to a form); other codes may carry non-sensitive extra information when the client needs it.
- `request_id` identifies the exact request in the server logs; quote it in support requests.
- **No internals** are ever returned: no SQL, no stack traces, no internal paths — not even in development.

### Error catalogue

| `code` | HTTP | Meaning | Retry? |
|---|---|---|---|
| `validation_failed` | 400 | Malformed input; see `details` | No — fix the request |
| `unauthorized` | 401 | Missing, invalid, revoked or expired credential | No — re-authenticate |
| `insufficient_scope` | 403 | Authenticated but the credential lacks the scope (or the role) | No — request the scope |
| `not_found` | 404 | Resource does not exist **or** you cannot see it (deliberately indistinguishable) | No |
| `conflict` | 409 | State conflict (already exists, already used, already installed) | Usually no — refresh and decide |
| `rate_limited` | 429 | Too many requests; see `Retry-After` | **Yes**, with backoff |
| `internal` | 500 | Unexpected server error (correlated by `request_id`) | **Yes**, with backoff |
| `invitation_expired` | 409 | The invitation is past `expires_at` | No — request a new invitation |
| `invitation_used` | 409 | The invitation was already redeemed (single use) | No |
| `not_a_member` | 403 | The user is not a member of the resource's group | No |
| `currency_not_enabled` | 400 | The currency is not enabled on this instance | No — pick an enabled one |
| `locale_not_available` | 400 | The locale is not served by this instance | No — pick an enabled one |
| `already_setup` | 409 | The instance already has a `super_admin`; `/setup` is closed | No |

> Error codes are part of the contract: changing one is a breaking change (see [Versioning](#3-versioning)).

## 5. Pagination

Two modes, both in v1.

**Offset/limit (default)** — for lists you navigate:

```
GET /api/v1/users?offset=0&limit=50
{ "data": [ … ], "meta": { "total": 128, "offset": 0, "limit": 50 } }
```

**Cursor** — for large or live lists (declared per resource):

```
GET /api/v1/some-list?cursor=<opaque>&limit=50
{ "data": [ … ], "meta": { "next_cursor": "<opaque>" } }
```

`limit` has a server-side maximum. Treat `next_cursor` as **opaque**; never build one yourself.

## 6. Rate limiting

Limits are applied **per identity** (user or key) on authenticated surfaces, and **per IP** on the identity-less ones, in layers:

| Layer | Default |
|---|---|
| Mobile / panel session | 120 requests/minute |
| API key | 30 requests/minute |
| Writes (mutations) | 10 requests/minute |
| Public endpoints (no identity) | 30 requests/minute per IP |

*These are starting values and are **tuneable per instance**; do not hard-code them.*

On excess: `429` with `Retry-After` (seconds) and `{ "error": { "code": "rate_limited", … } }`. Implement **exponential backoff**; do not retry in a tight loop.

## 7. Idempotency

Retries are safe for writes:

- **Creates** accept a **client-generated `id` (UUID)**. The same `id` returns the same resource; the same `id` with different content returns `conflict`.
- **Repeatable actions** (settle up, send) accept an **`Idempotency-Key`** header (or `idempotency_key` field in MCP). The same key with the **same payload** replays the stored result; a **different payload** returns `conflict`.
- Keys are remembered for **24 hours** (configurable). If the same key arrives while the first request is still **in flight**, the API answers `conflict` with `Retry-After`. The replay returns the result of *that* operation, not the current state of the resource.

```bash
curl -sS -X POST "$INSTANCE_URL/api/v1/invitations" \
  -H "Authorization: Bearer $SERVICE_KEY" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: 5f0a1c2e-…" \
  -d '{"email":"ana@example.com","name":"Ana","user_category_id":"…","modules":["split-expenses"]}'
```

## 8. Dates and money

- **Instants**: ISO 8601 in **UTC** with `Z` (`2026-10-27T09:15:00Z`).
- **Calendar dates**: `YYYY-MM-DD` (`date`), no time and no time zone — a birthday does not move with your time zone.
- **Money**: **integer minor units** plus ISO 4217 code — `{ "amount_minor": 1234, "currency": "EUR" }` (12.34 €). Never floats.
- **The server does not format** anything: you format with your own locale (`Intl.NumberFormat` in JS, `NumberFormat` on Android).

## 9. Modules

An instance has a **catalogue of modules** (e.g. Split Expenses). A module is installed **globally** on the instance and each user has access to it either because it is **public** or because it was **granted**.

| Endpoint | What it returns |
|---|---|
| `GET /api/v1/modules` | Catalogue: `key`, `name`, `version`, `state`, `is_public` |
| `GET /api/v1/me/modules` | **Your** modules (public + granted); admins see all |
| `GET /api/v1/modules/{key}` | Detail: state, version, `is_public`, its **public settings**, and its **documentation** |

**Module documentation is part of the module contract.** Each module ships, inside its package:

```
packages/<key>/
  README.md            # required: what it does, requirements, how to install/activate
  docs/api.md          # required if it adds resources to /api/v1
  docs/mcp.md          # required if it exposes MCP tools
  docs/settings.md     # required if it declares settings
  docs/events.md       # required if it declares events or realtime channels
```

The CI **fails** if a declared capability is not documented, and checks that every tool, setting, event **and realtime channel** appears **by name** in the corresponding document (`docs.api` is required when the module declares `scopes`, which is the machine-checkable signal that it adds endpoints).

`GET /modules/{key}` returns a **`docs`** block with the URLs of the documents **served by this instance** (`GET /modules/{key}/docs/{readme|api|mcp|settings|events}`), so you always link to documentation that exists and belongs to the installed package.

### Core endpoints (at a glance)

| Area | Endpoints | Notes |
|---|---|---|
| Health & instance | `GET /health`, `GET /instance` | public, non-sensitive |
| You | `GET/PATCH /me`, `GET /me/modules` | your profile and your modules |
| Users (admin) | `GET /users`, `GET/PATCH /users/{id}`, `DELETE /users/{id}` | soft-deactivate; root protected |
| Categories (admin) | `/user-categories`, `/{id}/members`, `/{id}/modules` | assign module ∈ category materializes access |
| Modules (admin) | `GET /modules`, `GET /modules/{key}`, `POST /modules/{key}/install\|activate\|deactivate\|uninstall`, `PATCH /modules/{key}` | install/uninstall require an administrator to review the schema changes |
| Access (admin) | `POST/DELETE /users/{id}/modules/{key}` | per-user grant/revoke |
| Invitations | `POST/GET /invitations`, `DELETE /invitations/{id}`, `POST /invitations/{token}/redeem` | redeem is the public join step (single use) |
| API keys | `POST/GET /api-keys`, `GET/DELETE /api-keys/{id}` | secret returned once |
| Devices | `POST/GET /devices`, `DELETE /devices/{id}` | push registration and revocation |
| Settings & currency | `GET/PATCH /settings`, `GET /settings-categories`, `GET /currencies`, `PATCH /currencies/{code}` | security settings are super-admin only |
| i18n | `GET /translations?locale=`, `GET /translations/status`, `POST /translations/import`, `PUT /translations/{locale}/{hash}` | ETag-cached |
| Operations (admin) | `GET /admin-actions`, `GET /audit`, `GET /maintenance/status`, `POST /maintenance/run` | maintenance uses an instance key |

Full request/response shapes: the generated OpenAPI (§11) or the normative spec while it is not published.

Module endpoints and tools live in the module's own documentation, not here (the Core does not duplicate them).

## 10. MCP

The same data is exposed to **AI agents** over the **Model Context Protocol**. MCP is **JSON-RPC over HTTP**, so it has its own endpoints and error model.

### 10.1 Endpoints and credentials

| Endpoint | Credential | What it exposes |
|---|---|---|
| `/mcp` | Delegated key `027_usr_…` | The **Core, as your user**: your profile, instance metadata, and your module list |
| `/mcp/admin` | Instance key `027_svc_…` (with `role_cap`) | **Administration**: invitations, users, categories, module access, non-secret settings |
| `/mcp/<module_key>` | Delegated key `027_usr_…` | **Only that module's tools** |

- Each endpoint **rejects the other credential type** (`403`). An instance key never acts as a user; a delegated key never reaches administration.
- `/mcp/<module_key>` requires the module to be **active**, **exposed** (`mcp_exposed` = `read` or `read_write`), and **accessible to you**.
- If a module is not available for any reason (unknown, disabled, not exposed, no access), the answer is a **uniform `404`** — the reason is only in server logs.

### 10.2 Transport and protocol

- **Streamable HTTP**, protocol version **`2026-07-28`**, **stateless** (no sessions, no `initialize` handshake; metadata travels per request).
- `server/discover` is available and declares the `tools` capability (no resources, no prompts, no sampling).
- `Origin`/`Host` are validated; only `POST` is used.
- SDK: `@modelcontextprotocol/server` (pinned version).

### 10.3 Core tools (`/mcp`)

| Tool | Scope | Returns |
|---|---|---|
| `profile_get` | `profile:read` | Your profile (`id`, `display_name`, `locale`, `timezone`, `role`) |
| `profile_update` | `profile:write` | Updates `display_name`, `locale`, `timezone` (**never** `role`) |
| `instance_get` | — | Non-sensitive instance metadata |
| `my_modules_list` | — | The modules you can connect to (`active` + exposed + accessible) |

### 10.4 Administration tools (`/mcp/admin`)

| Tool | Scope | Min. `role_cap` | Effect |
|---|---|---|---|
| `invitations_create` | `invitations:write` | admin | Creates an invitation (**never** returns the redeem token/link) |
| `invitations_list` | `invitations:read` | admin | List |
| `invitations_revoke` | `invitations:write` | admin | Revoke |
| `users_list` | `users:read` | admin | List (filters `q`, `module`, `category`) — **no email** in output |
| `users_get` | `users:read` | admin | User detail — **no email** |
| `users_update` | `users:write` | admin | Profile fields only |
| `users_assign_role` | `roles:assign` | admin (to `super_admin`: `super_admin`) | `admin` ↔ `user` |
| `users_deactivate` | `users:deactivate` | **super_admin** | Software deactivation (revokes sessions, modules, keys) |
| `categories_list` | `user_categories:read` | admin | List categories |
| `categories_create` | `user_categories:write` | admin | Create |
| `categories_update` | `user_categories:write` | admin | Rename |
| `categories_delete` | `user_categories:write` | admin | Delete (does **not** revoke materialized access) |
| `categories_add_member` | `user_categories:write` | admin | Add a user |
| `categories_remove_member` | `user_categories:write` | admin | Remove a user |
| `categories_assign_module` | `user_categories:write` + `modules:grant` | admin | Grant a module to a category (materializes access) |
| `categories_unassign_module` | `user_categories:write` + `modules:grant` | admin | Remove it from the template (**does not** revoke access) |
| `modules_list` | `modules:read` | admin | Catalogue (incl. `mcp_exposed`) |
| `modules_grant` | `modules:grant` | admin | Per-user access |
| `modules_revoke` | `modules:grant` | admin | Revoke per-user access |
| `settings_get` | `settings:read` | admin | Only settings marked readable for MCP |
| `settings_update` | `settings:write` | admin | Only settings marked writable for MCP (`security.*`, `connectivity.*` and `auth.*` are never exposed) |
| `admin_actions_list` | `admin_actions:read` | **super_admin** | Sensitive mutations log |

**Role invariants (always enforced):** the `/setup` owner (**root**) cannot be demoted or deactivated, and the instance always keeps **at least one active `super_admin`**. Violating either returns a domain error.

**Not available over MCP, by design:** module install/uninstall (DDL needs a human reviewing the diff), API key management (secrets are shown once), any `is_secret` setting, and destructive deletion of money data.

### 10.5 Module tools (`/mcp/<module_key>`)

- Only the tools the module declares in its manifest, documented in its `docs/mcp.md`.
- **Writes are allowed** if the module declares them: they go through the same use cases and validation as REST.
- A module exposed as `read` hides its write tools entirely; `read_write` exposes them.

### 10.6 Results

- **Input** is validated against the same schema as REST; invalid input returns a tool error with `validation_failed` and field details.
- **Output** carries `structuredContent` — **the same representation as the REST resource** — plus a `content` text block with the serialized JSON.
- `outputSchema` is published for every tool, so clients can validate responses.

### 10.7 Errors

Two channels, as the protocol defines:

**Protocol errors** (bad request, unknown tool, version/header mismatch, auth): HTTP status + JSON-RPC error.

| Situation | Response |
|---|---|
| Missing/invalid/revoked/expired key | `401` + `WWW-Authenticate` |
| Wrong key type for the endpoint, or missing scope | `403` |
| Module not available (any reason) | `404` (uniform) |
| Rate limited | `429` + `Retry-After` |
| Unsupported protocol version | `-32022` |
| Header mismatch | `-32020` |
| Malformed JSON | `-32700` |
| Invalid request / unknown tool | `-32600` / `-32601` |
| Unexpected server failure | `-32603` / HTTP 500 |

**Tool execution errors** (the tool exists and was authorized): `result.isError: true` with the domain error inside `structuredContent`:

```json
{
  "isError": true,
  "content": [{ "type": "text", "text": "{\"error\":{…}}" }],
  "structuredContent": {
    "error": {
      "code": "validation_failed",
      "message": "Validation failed",
      "details": [{ "path": "amount_minor", "rule": "int" }],
      "request_id": "6f1c2a8e-…"
    }
  }
}
```

The `code` values are the same catalogue as REST (§4). **`request_id` is present in every channel** — quote it for support.

### 10.8 Idempotency and safety

- `create` tools accept a client-generated `id` (UUID); repeatable tools accept `idempotency_key`. Same rules as §7.
- Tools are annotated with `readOnlyHint`, `destructiveHint`, `idempotentHint`.
- **Destructive tools require `confirm: true`**. This is an input requirement; whether a human confirms is decided by your MCP client (it should ask). An agent can always send `confirm: true`, so the real control is the **scopes you grant** to the key.

### 10.9 Limits

One shared budget per key (30 req/min by default, writes 10 req/min), audited per tool. Do not use MCP for bulk migrations; use REST for that.

## 11. OpenAPI

- The **OpenAPI document is generated** from the same schemas that validate requests and responses — it cannot drift from the implementation.
- Each instance **serves it** at `GET /api/v1/openapi.json` (no auth needed to read the schema; the API itself still requires credentials).
- A copy is committed to the repository at `docs/api/openapi.yaml` for review; CI fails if it is out of date.
- A browsable rendering (Swagger or an equivalent) is published by the admin panel.

*Planned detail (pending as a delta of the API spec): the served path is `/api/v1/openapi.json`, and the committed review copy lives at `docs/api/openapi.yaml`.*

Until the API is implemented, the **normative reference** for the contract is the specification: [`docs/superpowers/specs/2026-10-25-api-v1.md`](../superpowers/specs/2026-10-25-api-v1.md) and the Core surface in [`2026-10-26-core-api.md`](../superpowers/specs/2026-10-26-core-api.md).

---

## Getting help

- Errors are correlated by `request_id`: include it, never paste tokens or personal data.
- Operational issues (instance down, degraded, notifications not arriving): see the debugging guide, [`docs/guia-debugging.md`](../guia-debugging.md).
- Security issues: **do not open a public issue** — see [`SECURITY.md`](../../SECURITY.md).