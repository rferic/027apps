# 027Apps

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./public/logo-dark.svg">
  <img alt="027Apps Logo" src="./public/logo.svg" width="240">
</picture>

**Your apps. Your group.**  
Open-source platform for group apps — for families, teams, or any collective.

[![CI](https://github.com/rferic/027apps/actions/workflows/ci.yml/badge.svg)](https://github.com/rferic/027apps/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🧭 What is 027Apps?

A unified platform where groups manage users, roles, and app permissions in one place. It provides a ready-to-use backoffice, invitation-based auth, multilingual UI, and an extensible app system so you can build custom modules for your group's needs.

Think of it as a **self-hosted app ecosystem** for your family or team — install, configure, and use apps without managing separate logins or permissions.

---

## ✨ Features

### 👥 Multi-group & Auth
- Invitation-based user management with Supabase Auth
- Group-scoped roles and permissions (admin / member)
- Persistent JWT sessions (no expiry)
- Block/unblock users

### ⚙️ Backoffice (admin panel)
- Multilingual admin panel at `/{locale}/admin`
- Collapsible vertical sidebar (state persisted across reloads)
- Dashboard with group stats and widgets
- User & administrator management with inline block/role actions
- Invitation management (create, revoke, delete)
- Profile editing with password change
- API key management with scope-based access
- Settings > General: configure active languages and default locale

### 🌍 Internationalization
- 6 supported locales: English, Spanish, Italian, Catalan, French, German
- Per-user locale preference stored in the database
- Per-group active locales configurable from the admin panel
- All UI strings translated — no hardcoded English

### 🔌 App System
- Installable app modules with `manifest.json` configuration
- Per-app permissions and role-based access
- Public views, admin panels, dashboard widgets
- REST API routes per app
- Documentation site for app developers: [`/doc`](https://027apps-eric-rf.vercel.app/en/doc)

### 📦 Available Apps

| App | Description | Views |
|-----|-------------|-------|
| **Todo** | Simple task list — create, complete, and remove to-do items | public, admin, widget, native |
| **Inspiration** *(coming soon)* | Family idea board — propose improvements, report bugs, request features | public, admin, widget |

---

## 🛠️ Stack

| Technology | Purpose |
|-----------|---------|
| Next.js 16 | Frontend framework (App Router, Turbopack) |
| React 19 | UI library |
| TypeScript | Strict typing |
| Supabase | PostgreSQL + Auth + RLS |
| Tailwind CSS v4 | Styling |
| shadcn/ui | Component library |
| next-intl | i18n management |
| Vitest | Unit testing |
| Playwright | E2E testing |
| pnpm | Package manager |
| Resend | Email delivery |
| React Email | Email templates |

---

## 🚀 Getting Started

### Requirements
- Node.js 22+
- pnpm
- Docker (for Supabase local development)

### Installation

```bash
git clone https://github.com/rferic/027apps.git
cd 027apps
pnpm install
```

### Environment Variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Fill in your Supabase credentials:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Start Local Supabase

```bash
supabase start
```

### Apply Database Migrations

```bash
# If supabase db push fails (remote already has earlier migrations), apply directly:
docker exec -i supabase_db_027apps psql -U postgres -d postgres < supabase/migrations/<file>.sql
```

### Generate Supabase Types

```bash
supabase gen types typescript --local > src/types/supabase.ts
# Remove the "Connecting to db" line at the top if present
```

### Start Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📋 Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run Vitest unit tests |
| `pnpm test:e2e` | Run Playwright E2E tests |
| `pnpm tsc --noEmit` | TypeScript type checking |

---

## 📁 Project Structure

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
public/         Static assets (logos, icons, favicon)
```

---

## 🧩 Creating Apps

See the [App Developer Guide](apps/README.md) and the [documentation site](https://027apps-eric-rf.vercel.app/en/doc) for the complete reference.

Each app lives in `apps/[slug]/` and declares its capabilities in a `manifest.json`. The platform handles:
- Installation / uninstallation (DDL, data init, rollback)
- Routing (public views, admin, widgets, REST API)
- Configuration schema and validation
- i18n integration

---

## 📄 Documentation

Full documentation is available at [027apps-eric-rf.vercel.app/en/doc](https://027apps-eric-rf.vercel.app/en/doc), including:
- API reference (authentication, endpoints, errors)
- App development guide
- Environment configuration

---

## 🤝 Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md).

### Branch & Commit Conventions

- Branch naming: `sprint/{N}-{description}`, `feature/{description}`, `fix/{description}`
- Commit format: `Sprint N: type(scope): message` (conventional commits)
- Merge: squash merge to `main` via PR
- Preview-first: push → Vercel preview → test → merge → deploy

---

## 📧 Email Setup

Notifications (new ideas, status changes, comments) use a 3-step fallback:

| Priority | Method | Env vars needed |
|---|---|---|
| 1 | **Resend** (requires verified domain) | `RESEND_API_KEY`, `SENDER_EMAIL` |
| 2 | **SMTP** (Gmail, etc. — no domain needed) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| 3 | None — returns error | — |

### Quick start with Gmail (free)

1. Enable **2-Step Verification** at https://myaccount.google.com/security
2. Generate an **App Password** at https://myaccount.google.com/apppasswords
3. Set these in Vercel → Project Settings → Environment Variables:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx   # app password, 16 chars
SMTP_FROM=your-email@gmail.com
```

---

## 📜 License

MIT
