# Changelog

## Sprint 22 (current) — Mobile App & Infrastructure

- **Mobile split-expenses port**: 5 screens (groups, detail, expense form, transfer, settings) with 10 DS components
- **Push notifications with deep linking**: screen/params in payload, mobile navigation handler
- **Redis cache layer**: Upstash Redis for email lookups + notification config (0€/month)
- **Beta app variant**: amber icon badge, "027Apps Beta" branding, separate bundle IDs
- **Pair login E2E tests**: 32 tests for pairing code generation, verification, and API endpoints
- **i18n mobile**: 55 translation keys across 6 languages
- 85 test files, 521 tests, 0 failures

## Sprint 21 — Mobile Foundation

- Expo SDK 56 + expo-router
- Login, register, welcome, reset-password screens
- Server URL configuration + auth flow
- Module auto-discovery system
- Group switcher component
- Lista blanca modules registry

## Sprint 20 — Split Expenses Core

- Full REST API: groups, expenses, members, tags, transfers, balances, settlements
- Integration with OpenAPI docs (7 endpoints)
- Email + push notifications for expense events

## Sprint 19 — GitHub Integration

- GitHub OAuth App install flow
- GitHub Issues auto-created from Inspiration ideas
- Comment sync between Inspiration and GitHub
- GitHub webhook endpoint

## Sprint 18 — Inspiration & Pair Login

- Inspiration app: ideas, votes, comments, status tracking
- Pair login system: QR code scanning + code rotation
- Email notifications for new ideas and status changes

## Sprint 17 — Push Notifications

- Expo push notification system
- Per-user notification preferences
- Push token registration API
- Admin push token management

## Sprint 16 — API Keys & Security

- API key management (create, list, revoke)
- Server-to-server authentication via X-API-Key header
- Rate limiting middleware
- Secret encryption for GitHub tokens

## Sprint 15 — Admin Dashboard

- Admin layout with sidebar navigation
- Dashboard with stats cards and charts
- Group management (create, view, delete)
- User management (list, edit roles, delete)

## Sprint 14 — Multitenant Groups

- Group-based data isolation
- Group members with roles (admin/member)
- Group slug in URLs
- Invitation system with email delivery

## Sprints 1-13 — Platform Foundation

- Next.js 16 App Router with Turbopack
- Supabase authentication + database
- Design System (DS) components (22 components)
- Fumadocs documentation framework
- i18n with 6 languages (next-intl)
- Apps system: manifest-based plugins with DDL migrations, route handlers, admin panels, dashboards
- Todo app
- Storybook integration (100% DS coverage)
- CI/CD with GitHub Actions + Vercel
- OpenAPI documentation with Scalar UI
