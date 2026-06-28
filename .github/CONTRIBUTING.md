# Contributing to 027Apps

## Branch Strategy
- `main` — production branch, protected
- `sprint/{N}-{description}` — sprint branches (e.g. `sprint/7-cicd-pipeline`)
- `feature/{modulo}-{description}` — new features (e.g. `feature/lista-compra-add-categories`)
- `fix/{modulo}-{description}` — bug fixes (e.g. `fix/recetas-fix-search`)
- `refactor/{modulo}-{description}` — code refactoring
- `docs/{modulo}-{description}` — documentation

## Commit Convention

We follow the `Sprint N: type(scope): message` format:

```
Sprint 7: ci: hardening del pipeline CI/CD
Sprint 6: feat(groups): add multitenant group membership
Sprint 5: fix(auth): correct redirect after signup
Sprint 4: refactor(api): extract response helpers
Sprint 3: docs(readme): update setup instructions
```

### Rules

- `Sprint N` — the sprint number this commit belongs to (matches the active sprint plan in `.plans/`).
- `type` — one of: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `ci`, `perf`, `style`.
- `scope` (optional) — module or area affected (`auth`, `groups`, `api`, `admin`, etc.).
- `message` — short, imperative description in lowercase ("add", "fix", "update" — not "added", "fixes", "updated").

For one-off commits outside a sprint, `type(scope): message` (without the `Sprint N:` prefix) is also acceptable.

## Pull Request Process
1. Create a `sprint/`, `feature/` or `fix/` branch from `main`
2. Make your changes following the commit convention
3. Open a PR targeting `main`
4. Ensure CI passes (lint, typecheck, tests, build)
5. Request review from at least one maintainer
6. Merge only after approval and green CI

## Getting Started
See [README.md](../README.md) for local setup instructions.

## Development Workflow

1. Find or create a GitHub issue
2. Create a feature/fix branch from `main`
3. Implement + add tests
4. Run pre-check: `pnpm install --frozen-lockfile && pnpm lint && pnpm tsc --noEmit && pnpm test --run && pnpm build`
5. Push and create a PR
6. After review + preview verification, squash merge to `main`

## Code Style

- TypeScript strict mode
- Use the Design System (`src/components/ds/`) — never duplicate components
- Follow i18n rules (see `AGENTS.md`)
- Use named exports (`export function`), not default exports
- Prefer `async/await` over raw promises

## Finding Issues

Issues are tagged with `type:` (bug/feature/new_app), `status:` (pending/reviewing/approved), and `sprint:` labels. Good first issues have the `sprint:` label.

## Review Expectations

PRs require: lint passes, tsc passes, tests pass, build succeeds, preview deploy verified. Use the pre-push hook which runs all checks automatically.
