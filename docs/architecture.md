# 027Apps Architecture

## Overview

027Apps is a Next.js 16 monorepo with a React Native mobile app. The platform serves multiple groups (families, teams) each with their own isolated data, apps, and members.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS, Fumadocs |
| Mobile | Expo SDK 56, React Native, NativeWind, expo-router |
| Backend | Next.js Route Handlers (serverless) |
| Database | Supabase (PostgreSQL), Auth, Storage |
| Cache | Upstash Redis (optional) |
| Email | Resend (primary) / Custom SMTP (configurable) |
| Push | Expo Push API |
| Deploy | Vercel (web), EAS (mobile) |
| CI/CD | GitHub Actions |

## Data Flow

```
Browser/Mobile → Vercel Serverless → Supabase PostgreSQL
                ↓
        Route Handler (authenticate)
                ↓
        Use Case (business logic)
                ↓
        Query DB / Send Email / Send Push
                ↓
        JSON Response
```

## Request Lifecycle

1. **Incoming request** hits Next.js route handler
2. **Authentication** middleware validates JWT or API key
3. **Authorization** checks group membership and role
4. **Handler** dispatches to use-case function
5. **Use case** executes business logic, queries database
6. **Post-processing** (fire-and-forget): push notifications, emails
7. **Response** returns JSON with Server-Timing headers

## Directory Structure

```
/                           # Root monorepo
├── src/                    # Web app source
│   ├── app/                # Next.js App Router pages
│   │   ├── [locale]/       # Public + group routes
│   │   ├── (admin)/        # Admin panel routes
│   │   ├── (app)/          # Group workspace routes
│   │   └── api/v1/         # REST API handlers
│   ├── components/         # React components
│   │   ├── ds/             # Design System (22 components)
│   │   ├── composite/      # Business logic components
│   │   └── ui/             # Legacy shadcn (deprecated)
│   ├── lib/                # Core library
│   │   ├── auth/           # Authentication & pairing
│   │   ├── email/          # Email sending
│   │   ├── push/           # Push notifications
│   │   ├── supabase/       # Supabase client + admin
│   │   ├── use-cases/      # Business logic
│   │   ├── settings/       # Notification config
│   │   └── redis.ts        # Cache layer
│   └── i18n/               # Translations (6 languages)
├── apps/                   # Pluggable applications
│   ├── todo/
│   ├── inspiration/
│   └── split-expenses/
├── mobile/                 # React Native app
│   ├── app/                # expo-router screens
│   ├── src/
│   │   ├── components/ds/  # Mobile Design System (10 components)
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # API helpers, auth, i18n
│   │   └── i18n/           # Mobile translations
│   └── assets/             # Icons, splash images
├── content/                # Fumadocs markdown content
├── docs/                   # Internal documentation
├── supabase/               # Database migrations + config
├── tests/                  # Test suites
├── public/                 # Static assets + OpenAPI spec
└── scripts/                # Build/generation scripts
```

## App System

The platform has a pluggable app system. Each app in `apps/` has:
- `manifest.json` — metadata, migrations, hooks
- `migrations/` — SQL migration files
- `routes/` — API route handlers (auto-dispatched)
- `admin.tsx` — Admin panel component
- `public.tsx` — Public view component
- `dashboard.tsx` — Dashboard widget
- `mobile.ts` — Mobile module configuration

## Authentication

- **JWT**: Issued by Supabase Auth, validated on every request
- **API Key**: Server-to-server, created via admin panel
- **Pair Login**: QR code + rotating 6-digit code for mobile login

## Database

- PostgreSQL via Supabase
- Row Level Security (RLS) for data isolation
- Automatic migration tracking
- Schema cache reloaded on DDL changes

## Caching

| Layer | Technology | TTL |
|-------|-----------|-----|
| Next.js | unstable_cache (cachedQuery) | 5min–7d |
| Redis | Upstash (@upstash/redis) | 5min–1h |
| Memory | pushEnabledCache | 30s |

See `docs/infra-niveles.md` for scaling strategy.

## Monitoring

- Vercel Analytics + Logs
- Server-Timing headers on API responses
- Health endpoint: `/api/health`
