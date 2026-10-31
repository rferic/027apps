---
name: new-module
description: Use when the user asks to create, plan, or define a new 027apps module, or asks how new modules are created. Triggers on "nuevo módulo", "crear módulo", "new module", "module manifest", "module spec", or when a capability should become a module package instead of Core code.
---

# New module

## Overview

Guide the creation of a 027apps module from idea to approved spec and mockup. A module is a
feature package under `packages/<key>/` with a `manifest.json`; after the spec and plan are
approved it follows `docs/flows/feature.md`. This skill does not implement the module or the
Core: it asks, analyzes, enriches, closes requirements, and produces the spec and mockup. Do
not duplicate the manifest contract; link to `docs/ai/module-system.md`.

## Read first

1. `docs/ai/module-system.md` — canonical contract: manifest, requirements, lifecycle,
   security, tests, API/MCP.
2. `docs/flows/new-module.md` — methodology and questionnaire (§1.1). Use that questionnaire as
   the source of questions; do not improvise a different list.
3. `docs/ai/manifest.schema.json` — machine-readable contract.
4. `docs/flows/feature.md` and `docs/flows/agents.md` — base feature flow and roles/gates.
5. `.opencode/skills/new-module/templates/` — `manifest.json`, `module-spec.md`, `state.md`.

Do not proceed without reading the canonical docs. If a document is missing, stop and report.

## When to use

- The user asks to create, plan, or define a new module.
- The user asks how modules are created.
- A requested capability belongs in a module rather than the Core.

## When not to use

- Changes inside an existing module: use `feature.md` or `bugfix.md`.
- Changes to the Core: use the Core flow.
- A screen, resource, or table that belongs to the Core: decide with the Core spec first.

## Workflow

Run the phases in `docs/flows/new-module.md` in order. Do not skip gates.

1. **Intake** — ask idea, need, features, and general concept. Record in `state.md`.
2. **Examples** — ask for apps that do the same or similar; extract patterns and differences.
3. **Identity and manifest** — ask name, icon/logo, and required manifest properties; propose
   defaults and validate against the schema.
4. **Analysis and enrichment** — propose an enriched idea with all features; suggest
   improvements; check fit with project entities and the Core; detect undefined, contradictory,
   or problematic points.
5. **Requirements freeze** — resolve contradictions and confirm v1 limits, non-goals, tables,
   UI/admin pages, scopes/MCP, settings/secrets, events/channels, locales, currency/dates, and
   `is_public`. Record Core dependencies and their real state.
6. **Gate: start the spec?** — ask explicitly. If no, save `state.md` and stop.
7. **Spec + mockup** — write the spec in `docs/superpowers/specs/<date>-<key>.md` using the
   template. The spec must cover security, tests, API, and MCP. Create an HTML+JS mockup in
   `docs/mockups/<key>/index.html` with mobile and admin views. Iterate until the user accepts
   both. The spec is not complete until the mockup is accepted.

After the spec and mockup are accepted, the module follows `feature.md` for the plan, TDD
implementation, review, security audit, and acceptance. Do not implement before the plan is
approved.

## Gates and stop conditions

- Do not advance without explicit user approval at: requirements closed, start spec?,
  spec + mockup accepted, plan approved, UI accepted (if applicable), acceptance, merge.
- If a Core piece is missing (registry, RLS suite, design system, i18n pipeline, installer,
  `/api/v1`, admin shell), do not invent stubs. Report it and mark the capability as blocked.
- Never mark a module `finalizada` while a declared capability lacks real verification. Use
  `test` with the list of blockers.
- Do not put secrets in the skill, spec, manifest, or mockup.

## Templates

Copy from `.opencode/skills/new-module/templates/`:

- `state.md` — resumable state: brief, analysis, requirements, dependencies, artifacts, gates,
  open questions, log.
- `module-spec.md` — spec skeleton; fill it and replace placeholders.
- `manifest.json` — manifest shape; replace placeholders and delete unused capabilities.

## Common mistakes

- Starting code without an approved spec and mockup.
- Skipping the "start the spec?" gate.
- Inventing registry, installer, or RLS suite.
- Putting `group_id` only on some tables.
- Referencing `profiles` instead of `participants`.
- Seeding scopes in the database.
- Using free hex colors in `branding.color`.
- Omitting `down` or migration digests.
- Declaring capabilities without their documentation.
- Exposing MCP `write` tools by default.
- Marking `finalizada` with Core blockers.
- Generating the spec without an accepted mockup.

## References

- `docs/ai/module-system.md`
- `docs/flows/new-module.md`
- `docs/ai/manifest.schema.json`
- `docs/flows/feature.md`
- `docs/flows/agents.md`
- `docs/conventions/security-checklist.md`
- ADRs 0004, 0007, 0008, 0009
