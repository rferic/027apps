# 027Apps

Open-source platform for group apps — for families, teams, or any collective.

[![CI](https://github.com/rferic/027apps/actions/workflows/ci.yml/badge.svg)](https://github.com/rferic/027apps/actions/workflows/ci.yml)

## What is this?

027Apps is a unified platform where groups manage users, roles, and app permissions in one place. It provides a ready-to-use backoffice, invitation-based auth, multilingual UI, and an extensible app system so you can build custom modules for your group's needs.

## Features

**Multi-group & Auth**
- Invitation-based user management with Supabase Auth
- Group-scoped roles and permissions (admin / member)
- Persistent JWT sessions (no expiry — users stay logged in until they sign out)
- Block/unblock users

**Backoffice (admin panel)**
- Multilingual admin panel at `/{locale}/admin`
- Collapsible vertical sidebar (state persisted across reloads)
- Dashboard with group stats
- User & administrator management with inline block/role actions
- Invitation management (create, revoke, delete)
- Profile editing with password change
- Settings > General: configure active languages and default locale

**Internationalization**
- 6 supported locales: English, Spanish, Italian, Catalan, French, German
- Per-user locale preference stored in the database
- Per-group active locales configurable from the admin panel
- All UI strings translated — no hardcoded English

**App Permissions**
- Per-app module access control
- Role-based feature toggles
- Extensible app architecture

## Stack

| Technology | Purpose |
|-----------|---------|
| Next.js 16 | Frontend framework (App Router) |
| React 19 | UI library |
| TypeScript | Strict typing |
| Supabase | PostgreSQL + Auth + RLS |
| Tailwind CSS v4 | Styling |
| shadcn/ui | Component library |
| next-intl | i18n management |
| Vitest | Unit testing |
| Playwright | E2E testing |
| pnpm | Package manager |

## Getting started

### Requirements
- Node.js 22+
- pnpm
- Docker (for Supabase local development)

### Installation

```bash
git clone https://github.com/rferic/027apps.git
cd 027app
pnpm install
```

### Environment variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Fill in your Supabase credentials:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Start local Supabase

```bash
supabase start
```

### Apply database migrations

```bash
# If supabase db push fails (remote already has earlier migrations), apply directly:
docker exec -i supabase_db_027apps psql -U postgres -d postgres < supabase/migrations/<file>.sql
```

### Generate Supabase types

```bash
supabase gen types typescript --local > src/types/supabase.ts
# Remove "Connecting to db" line at the top if present
```

### Start the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run Vitest unit tests |
| `pnpm test:e2e` | Run Playwright E2E tests |

## Project structure

```
src/
  app/          Next.js App Router pages
  components/   Shared React components
  db/           Database migrations and helpers
  i18n/         Internationalization messages
  lib/          Utilities and shared logic
  types/        TypeScript type definitions
apps/           App modules (extensible modules)
  README.md     App developer guide
.github/
  workflows/    CI and release automation
```

## Creating apps

See [apps/README.md](apps/README.md) and the documentation site at `/doc`.

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md)

## License

MIT
