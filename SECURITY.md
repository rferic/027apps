# Security Policy

027Apps is a **self-hosted** family platform: whoever installs an instance is its operator and owns its data. This document covers **the code in this repository**, not the infrastructure of any particular deployment.

## Reporting a vulnerability

**Do not open a public issue.** Please report privately, using either:

1. **GitHub Security Advisories** — *Security* tab → *Report a vulnerability* (preferred; keeps the report private and lets us coordinate a fix).
2. If that is unavailable, email the maintainer at the address listed on the repository profile.

Please include:

- a short description and **impact** (what an attacker gains),
- **steps to reproduce** (or a proof of concept),
- affected version/commit,
- whether the issue affects **any instance** or only a specific configuration.

**Never include real credentials, tokens, personal data or production data** in a report. Redact them; a `request_id` and a description are usually enough.

## What is in scope

- The application code: `apps/admin` (panel and `/api/v1`), `apps/android`, `packages/*`.
- The module contract and module runtime installer.
- The CI/CD workflows and release process in this repository.

## What is out of scope

- **Your own instance's infrastructure** (Vercel/Supabase/Firebase configuration, SMTP provider, DNS, hosting account security). Report those to the respective provider.
- **Compromised credentials** of your instance: rotate them (see *What to do if a credential leaks* below) and, if needed, report the underlying code flaw.
- Findings that require **physical access** to an unlocked device, or an already-compromised operator account.
- **Denial of service by volume** against your own instance (use the provider's protections).
- Reports from automated scanners without a reproducible impact.

## What to expect

- **Acknowledgement** within a reasonable time (best effort — this is a small project, not a company with an SLA).
- A **fix** and a coordinated **disclosure** once a patch is available. Please give us a reasonable window before publishing.
- **Credit** in the advisory if you want it.

## If a credential leaks

If a token, API key or secret of **your** instance is exposed:

1. **Revoke it immediately**: instance/delegated API keys from the panel, sessions from the device list, or rotate the secret in the corresponding settings.
2. Rotate the affected **environment variables** (Supabase keys, `SETTINGS_ENCRYPTION_KEY`) and re-deploy. For the master encryption key, follow the double-key rotation in the runbook.
3. Review `admin_actions` and `audit` for unexpected activity (both are correlated by `request_id`).
4. If data may have been exposed, restore from the latest backup if needed and inform the affected members of your family group.

## Security model, in one line

Every instance is **private** and invite-only; the API is the only door to the data (`/api/v1`); RLS is the second barrier; tokens are opaque and revocable; and secrets are encrypted at rest with a master key held outside the database.

For the full threat model, secrets policy and the per-task OWASP checklist, see [`docs/superpowers/specs/2026-10-26-seguridad.md`](docs/superpowers/specs/2026-10-26-seguridad.md) and [`docs/conventions/security-checklist.md`](docs/conventions/security-checklist.md).
