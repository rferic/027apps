---
name: self-hosting
description: Use when a user wants to stand up their own 027apps instance (Supabase, Vercel, GitHub, email, Firebase/FCM, backups) or asks how to self-host, deploy or configure the infrastructure. Triggers on "self-host", "autoalojar", "montar mi instancia", "setup infra", "deploy my own", "configurar Supabase/Vercel".
---

# Self-hosting 027Apps

## Overview

Guide a user from an empty set of accounts to a working 027Apps preview deployment. The
canonical step-by-step guide is `docs/self-hosting.md`; the internal runbook with recovery and
secret inventory is `docs/infrastructure.md` (Spanish); CI/CD details are in
`docs/flows/cicd.md`. This skill does not duplicate them: it drives the conversation and checks
each step against the guide.

Do not ask for, print or accept secret values in chat. The user runs secret commands locally or
pastes values only in provider dashboards.

## Read first

1. `docs/self-hosting.md` — the path to follow: phases 0–9 and the verification checklist.
2. `docs/infrastructure.md` — services, limits, secrets, backups, recovery and §9 production
   activation.
3. `docs/flows/cicd.md` — rulesets, environments, secret handling and releases.
4. `docs/tasks/sprint-04-infra/README.md` and `task-01..13.md` — what was actually verified.

If a document is missing, stop and report instead of improvising.

## When to use

- The user wants to run 027Apps on their own accounts or servers.
- The user asks how to configure Supabase, Vercel, SMTP/email, Firebase/FCM, GitHub protections,
  the Android keystore or backups for their instance.
- The user asks what is missing to go live.

## When not to use

- Changes to the product code or the Core: use the feature/bugfix flows.
- CI/CD changes inside this repository: use the CI/CD flow and update `docs/flows/cicd.md`.
- Creating a new module: use the `new-module` skill.

## Workflow

Run the phases in order; do not skip a gate. After each step, run its verification and only
continue when it passes.

1. **Intake** — ask what the user already has (accounts, project, domain) and whether the goal is
   local development only or a preview/production deployment. Record the answers in the session.
2. **Prerequisites** — confirm Node/pnpm, Docker, `gh`, `keytool` (only for releases) and 2FA on
   the providers.
3. **Phase 0 — local** — clone, `pnpm install`, `supabase start`, `.env.local`, health check.
4. **Phase 1 — Supabase cloud** — create `027apps-dev`, save the DB password, copy URL and keys,
   `supabase link` + `db push`.
5. **Phase 2 — env vars and master key** — generate `SETTINGS_ENCRYPTION_KEY` locally and store it
   in the password manager, separate from backups. Explain the four variables and their scopes.
6. **Phase 3 — Vercel** — import the repo, root directory `apps/admin`, include files outside the
   root, create the frozen `production` branch and select it, add Preview env vars, enable Vercel
   Authentication.
7. **Phase 4 — email** — choose Resend or Brevo, verify a dedicated subdomain, configure custom
   SMTP in Supabase, raise the 30 messages/hour limit if needed, test invite + reset.
8. **Phase 5 — GitHub protections** — rulesets for `main` and `v*`, `release` environment with a
   required reviewer, CODEOWNERS, keep `guard-secrets` green. Do this **before** uploading the
   keystore.
9. **Phase 6 — Android keystore** (optional) — generate with `keytool`, back up the file and
   password in the password manager, upload the four secrets to the `release` environment, delete
   the local file only after confirming the backup, publish a test tag.
10. **Phase 7 — Firebase/FCM** (optional) — project, Android app, public values, service account,
    restrict the API key.
11. **Phase 8 — backups** — R2/B2 bucket, `RESTIC_PASSWORD`, session-pooler `SUPABASE_DB_URL`,
    upload the five secrets, run the workflow and do a restore drill.
12. **Phase 9 — production** — only when the Core works: follow the §9 checklist in
    `docs/infrastructure.md`.
13. **Close** — run the final verification checklist in `docs/self-hosting.md` and report what
    passed, what failed and what the user still has to do by hand.

## Guardrails

- **Never request or print secrets.** If the user pastes one, do not repeat it, do not write it to
  a file and tell them to rotate it.
- Commands that need a secret must read it from `stdin` (`gh secret set`, `keytool -storepass:env`)
  or from the password manager; no values in command history.
- Do not create production resources before the user confirms production activation. Default to
  Preview and local development.
- Do not disable protections to "make it work": fix the cause.
- If a provider's UI differs from the guide, follow the provider's current UI and report the
  difference so the guide can be updated in the same change.
- One step at a time: wait for the user's confirmation and verification output before moving on.

## Evidence to report

For each phase, report the verification command or dashboard check and its real output. For
example: `/api/health` → `{"status":"ok"}`, `gh secret list --env release` → four names,
`restic snapshots` → snapshot id and date. Do not claim a step passed without evidence.
