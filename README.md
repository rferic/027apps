# 027Apps

A self-hostable modular platform for families, with a web administration panel (`apps/admin`, Next.js) and an Android app (`apps/android`, Kotlin).

## Repository structure

- `apps/` — applications (admin, Android)
- `packages/` — shared packages
- `docs/` — specifications, plans, and tasks

## Commands

```bash
pnpm lint
pnpm tsc
pnpm test
```

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
