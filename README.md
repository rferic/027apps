# 027Apps

A self-hostable, modular platform for families. A public site presents the project, a web
administration panel runs it, and an Android app brings the modules to the phone.

## Public site

| Route | Contents |
|---|---|
| `/` | The family app: modules, screenshots and roadmap. |
| `/self-host` | The project: admin panel, API v1, MCP, stack and setup. |
| `/l/<locale>` | The same pages in the eight translated languages. |
| `/panel` | The administration panel (invitation-only, requires a session). |

The panel lives at `/panel`; `/` and `/self-host` are public and static. APKs are published on
GitHub Releases. There is no public signup: members join with an invitation.

## Repository structure

- `apps/` — applications (`admin`, Android)
- `packages/` — shared packages, including modules and the i18n catalog
- `docs/` — specifications, plans, flows and tasks

## Commands

```bash
pnpm lint
pnpm tsc
pnpm test
```

## Modules and the public site

Modules live under `packages/<key>/` and follow the contract in
[`docs/ai/module-system.md`](docs/ai/module-system.md). The public landing is static content:
it never reads the instance database.

**Shipping a module includes updating the public site.** Its catalog entry and both pages (`/`
and `/self-host`) must reflect the new state, description and three features; a module that
becomes available replaces its mockup with a real screenshot using demo data. The canonical
catalog, states and update rules live in [`docs/ai/landing.md`](docs/ai/landing.md). A module is
not done while the landing still shows it as planned after it ships, or as available before it
is.

## Self-hosting

You can run your own instance on your own accounts. The step-by-step guide covers local
development, Supabase, Vercel, transactional email, GitHub protections, the Android keystore,
optional Firebase/FCM, backups and production activation:

- [Self-hosting guide](docs/self-hosting.md)
- [Infrastructure runbook](docs/infrastructure.md) (Spanish, with recovery scenarios)
- [AI skill for guided setup](.opencode/skills/self-hosting/SKILL.md)

If you use an AI assistant, point it at the `self-hosting` skill: it walks you through the same
phases and never asks for secrets in chat.

## License

[MIT](LICENSE)
