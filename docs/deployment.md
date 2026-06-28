# Deployment Guide

## Prerequisites

- GitHub repository with admin access
- Vercel account (Hobby plan minimum)
- Supabase account (Free plan minimum for staging, Pro recommended for production)
- Expo account (for mobile builds)
- Upstash account (optional, for Redis cache)

## Environment Variables

### Vercel (Web)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SITE_URL` | Yes | Production URL (e.g. https://027apps.com) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (secret!) |
| `RESEND_API_KEY` | No | Resend API key for email |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis URL (caching) |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis token (caching) |
| `EXPO_ACCESS_TOKEN` | No | Expo access token for push notifications |
| `GITHUB_APP_ID` | No | GitHub App ID (Inspiration sync) |
| `GITHUB_APP_PRIVATE_KEY` | No | GitHub App private key (secret!) |

### Expo / EAS (Mobile)

Set in `app.config.ts` `extra` field or EAS secrets:

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_APP_VARIANT` | `"production"` or `"beta"` |
| `EXPO_PUBLIC_BETA_API_URL` | API URL for beta (e.g. Vercel preview) |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Production EAS project ID |
| `EXPO_PUBLIC_EAS_PROJECT_ID_BETA` | Beta EAS project ID |

## First Deployment

### 1. Supabase Setup

1. Create a Supabase project at supabase.com
2. Run `supabase link --project-ref <ref>`
3. Run `supabase db push` to apply migrations
4. Configure Auth: enable Email provider, set Site URL
5. Enable RLS on all tables (handled by migrations)

### 2. Vercel Setup

1. Import the repository in Vercel
2. Set the framework to Next.js
3. Add all required environment variables
4. Deploy
5. Configure custom domain (027apps.com)
6. Update Supabase Auth Site URL to match

### 3. Mobile Setup (EAS)

1. Install EAS CLI: `npm install -g eas-cli`
2. Login: `eas login`
3. Configure project: `eas build:configure` (in mobile/)
4. Set EAS secrets for environment variables
5. Build: `eas build --platform all --profile production`

## Environments

| Environment | Supabase | Vercel | Purpose |
|-------------|----------|--------|---------|
| Local | localhost:54321 | localhost:3000 | Development |
| Staging | supabase.co (staging ref) | vercel.app (preview) | Pre-production testing |
| Production | supabase.co (prod ref) | 027apps.com | Live |

## Database Migrations

Migrations are applied automatically via GitHub Actions:

- **Staging**: On push to `sprint/*`, `feature/*`, `fix/*` branches
- **Production**: On push to `main`

Manual migration: `supabase db push`

## Post-Deployment Checklist

- [ ] Health endpoint responds: `GET /api/health`
- [ ] Auth works: login with test account
- [ ] Apps load: Todo, Inspiration, Split Expenses
- [ ] Admin panel accessible
- [ ] Email notifications send (check SMTP or Resend)
- [ ] Push notifications work (register a test token)
- [ ] OpenAPI docs load at `/api-docs`
- [ ] Fumadocs render at `/doc`
- [ ] Mobile app can connect and login
